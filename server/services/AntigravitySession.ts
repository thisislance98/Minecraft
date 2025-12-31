
import { WebSocket } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAntigravitySystemPrompt } from '../ai/antigravity_prompt';
import { getAntigravityTools } from '../ai/antigravity_tools';

import { auth } from '../config';
import { addTokens, getUserTokens } from './tokenService';
import { IncomingMessage } from 'http';

const PENDING_TOOL_CALLS = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>();

export class AntigravitySession {
    private ws: WebSocket;
    private genAI: GoogleGenerativeAI;
    private model: any;
    private contents: any[] = [];
    private userId: string | null = null;
    private COST_PER_REQUEST = 10;

    constructor(ws: WebSocket, apiKey: string, req: IncomingMessage) {
        this.ws = ws;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            tools: getAntigravityTools(),
            systemInstruction: getAntigravitySystemPrompt()
        });

        // Extract token from URL
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        this.init(token);
    }

    private async init(token: string | null) {
        // Verify Auth asynchronously
        if (token) {
            try {
                if (!auth) throw new Error('Auth service unavailable');
                const decoded = await auth.verifyIdToken(token);
                this.userId = decoded.uid;
                console.log(`[Antigravity] Authenticated user: ${this.userId}`);
                this.sendBalanceUpdate();
            } catch (e) {
                console.error('[Antigravity] Auth failed:', e);
                this.send('error', { message: 'Authentication failed' });
            }
        } else {
            console.log('[Antigravity] No auth token provided. Running as guest (limited?).');
        }

        this.ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'input') {
                    await this.handleInput(msg.text, msg.context);
                } else if (msg.type === 'tool_response') {
                    this.handleToolResponse(msg.id, msg.result, msg.error);
                } else if (msg.type === 'interrupt') {
                    console.log('[Antigravity] Interrupted by client.');
                    // Actual cancellation logic would require an AbortController passing to generateContentStream
                    // For now, we set a flag and stop processing further chunks
                    this.isInterrupted = true;
                }
            } catch (e: any) {
                console.error('Error handling message:', e);
                this.sendError(e.message);
            }
        });
    }

    private isInterrupted = false;

    private send(type: string, payload: any) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...payload }));
        }
    }

    private sendError(message: string) {
        this.send('error', { message });
    }

    private async handleInput(text: string, context: any) {
        const contextStr = context ? `\n[Context: ${JSON.stringify(context)}]` : '';
        const fullMessage = text + contextStr;

        // Add user message to contents
        this.contents.push({
            role: 'user',
            parts: [{ text: fullMessage }]
        });

        try {
            await this.generateAndProcess();
        } catch (e: any) {
            console.error("Gemini Error:", e);
            this.sendError("AI Error: " + e.message);
        }
    }

    private async generateAndProcess() {
        // 1. Check Balance
        if (this.userId) {
            const currentBalance = await getUserTokens(this.userId);
            if (currentBalance < this.COST_PER_REQUEST) {
                this.send('error', { message: 'Insufficient tokens. Please purchase more to continue using AI.' });
                return;
            }
        }

        console.log('[Antigravity] Starting generation with thinking config...');
        this.isInterrupted = false; // Reset flag

        try {
            // Use streaming with thinking config
            const request: any = {
                contents: this.contents,
                generationConfig: {
                    thinkingConfig: { include_thoughts: true }
                }
            };

            const result = await this.model.generateContentStream(request);

            let accumulatedText = '';
            const capturedSignatures: string[] = [];

            for await (const chunk of result.stream) {
                if (this.isInterrupted) {
                    console.log('[Antigravity] Generation aborted in stream loop.');
                    this.send('error', { message: 'Generation aborted.' });
                    return; // Break out of method strictly
                }

                // Handle Thoughts
                if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
                    const parts = chunk.candidates[0].content.parts;
                    for (const part of parts) {
                        // @ts-ignore
                        if (part.thoughtSignature) {
                            // @ts-ignore
                            capturedSignatures.push(part.thoughtSignature);
                        }
                        // @ts-ignore
                        if (part.thought) {
                            this.send('thought', { text: part.text });
                            // @ts-ignore
                        } else if (part.text) {
                            accumulatedText += part.text;
                            this.send('token', { text: part.text });
                        }
                    }
                }
            }

            // After stream finishes, get the final aggregated response object to handle function calls reliably
            const response = await result.response;
            const content = response.candidates[0].content;

            // Patch signatures back into function calls
            if (content.parts && capturedSignatures.length > 0) {
                let sigIndex = 0;
                for (const part of content.parts) {
                    if (part.functionCall) {
                        // @ts-ignore
                        part.thoughtSignature = capturedSignatures[sigIndex++];
                    }
                }
            }

            // Add full model response to history
            this.contents.push(content);

            const finalToolCalls = response.functionCalls();
            if (finalToolCalls && finalToolCalls.length > 0) {
                if (this.isInterrupted) return; // Don't run tools if aborted
                await this.executeTools(finalToolCalls);
            }
        } catch (e: any) {
            // Ignore abort errors usually, but log others
            if (this.isInterrupted) return;
            console.error("[Antigravity] Stream Error FULL:", e);
            this.sendError("Stream Error: " + e.message);
        } finally {
            if (!this.isInterrupted) {
                this.send('complete', {});

                // Deduct cost if successful (and authenticated)
                if (this.userId) {
                    try {
                        await addTokens(this.userId, -this.COST_PER_REQUEST, 'ai_usage', 'Gemini Prompts');
                        this.sendBalanceUpdate();
                    } catch (e) {
                        console.error('[Antigravity] Failed to deduct tokens:', e);
                    }
                }
            }
        }
    }

    private async sendBalanceUpdate() {
        if (!this.userId) return;
        const balance = await getUserTokens(this.userId);
        this.send('balance_update', { tokens: balance });
    }

    private async executeTools(toolCalls: any[]) {
        const functionResponseParts = [];

        for (const call of toolCalls) {
            const { name, args } = call;
            let result;

            // Notify client of tool usage
            this.send('tool_start', { name, args });

            try {
                if (this.isServerTool(name)) {
                    result = await this.executeServerTool(name, args);
                } else if (this.isClientTool(name)) {
                    result = await this.executeClientTool(name, args);
                } else {
                    result = { error: `Unknown tool ${name}` };
                }
            } catch (e: any) {
                result = { error: e.message };
            }

            // Build function response part per official docs pattern
            functionResponseParts.push({
                functionResponse: {
                    name: name,
                    response: (typeof result === 'object' && result !== null) ? result : { result: result }
                }
            });

            this.send('tool_end', { name, result });
        }

        // Append function responses as a USER message
        this.contents.push({
            role: 'user',
            parts: functionResponseParts
        });

        // Call model again with updated contents
        await this.generateAndProcess();
    }

    private isServerTool(name: string) {
        return ['view_file', 'list_dir', 'write_to_file', 'replace_file_content'].includes(name);
    }

    private isClientTool(name: string) {
        return ['spawn_creature', 'teleport_player', 'get_scene_info'].includes(name);
    }

    // SERVER TOOL EXECUTORS
    private async executeServerTool(name: string, args: any) {
        const cwd = process.cwd();

        switch (name) {
            case 'list_dir': {
                const targetPath = path.resolve(cwd, args.DirectoryPath || '.');
                const projectRoot = path.resolve(cwd, '..');
                if (!targetPath.startsWith(cwd) && !targetPath.startsWith(projectRoot)) {
                    throw new Error("Access Denied: Can only read within project directory");
                }
                const files = await fs.readdir(targetPath, { withFileTypes: true });
                return { files: files.slice(0, 50).map(f => ({ name: f.name, isDir: f.isDirectory() })) };
            }
            case 'view_file': {
                const targetPath = path.resolve(cwd, args.AbsolutePath);
                const projectRoot = path.resolve(cwd, '..');
                if (!targetPath.startsWith(cwd) && !targetPath.startsWith(projectRoot)) {
                    throw new Error("Access Denied: Can only read within project directory");
                }
                const content = await fs.readFile(targetPath, 'utf8');
                return { content: content.slice(0, 10000) };
            }
            case 'write_to_file': {
                const targetPath = path.resolve(cwd, args.TargetFile);
                const projectRoot = path.resolve(cwd, '..');
                if (!targetPath.startsWith(cwd) && !targetPath.startsWith(projectRoot)) {
                    throw new Error("Access Denied: Can only write within project directory");
                }
                await fs.mkdir(path.dirname(targetPath), { recursive: true });
                await fs.writeFile(targetPath, args.CodeContent);
                return { success: true, path: args.TargetFile };
            }
            case 'replace_file_content': {
                const targetPath = path.resolve(cwd, args.TargetFile);
                const projectRoot = path.resolve(cwd, '..');
                if (!targetPath.startsWith(cwd) && !targetPath.startsWith(projectRoot)) {
                    throw new Error("Access Denied: Can only edit within project directory");
                }
                const content = await fs.readFile(targetPath, 'utf8');
                const newContent = content.replace(args.TargetContent, args.ReplacementContent);
                if (newContent === content) return { error: "Target content not found" };
                await fs.writeFile(targetPath, newContent);
                return { success: true };
            }
            default:
                return { error: `Server tool ${name} not implemented` };
        }
    }

    // CLIENT TOOL EXECUTOR
    private async executeClientTool(name: string, args: any) {
        return new Promise((resolve, reject) => {
            const callId = Math.random().toString(36).substring(7);
            PENDING_TOOL_CALLS.set(callId, { resolve, reject });

            this.send('tool_request', {
                id: callId,
                name,
                args
            });

            // Timeout after 30s
            setTimeout(() => {
                if (PENDING_TOOL_CALLS.has(callId)) {
                    PENDING_TOOL_CALLS.delete(callId);
                    resolve({ error: "Client timed out" });
                }
            }, 30000);
        });
    }

    private handleToolResponse(id: string, result: any, error: any) {
        const pending = PENDING_TOOL_CALLS.get(id);
        if (pending) {
            PENDING_TOOL_CALLS.delete(id);
            if (error) pending.resolve({ error });
            else pending.resolve(result);
        }
    }
}
