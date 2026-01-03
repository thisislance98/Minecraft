
import { WebSocket } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAntigravitySystemPrompt } from '../ai/antigravity_prompt';
import { getAntigravityTools } from '../ai/antigravity_tools';

import { auth } from '../config';
import { addTokens, getUserTokens } from './tokenService';
import { saveCreature } from './DynamicCreatureService';
import { saveItem } from './DynamicItemService';
import { IncomingMessage } from 'http';

const PENDING_TOOL_CALLS = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>();
const LOCK_FILE = path.join(process.cwd(), '.ai_lock');

export class AntigravitySession {
    private ws: WebSocket;
    private genAI: GoogleGenerativeAI;
    private model: any;
    private contents: any[] = [];
    private userId: string | null = null;
    private headers: any;
    private cliMode: boolean = false;

    // Pricing Configuration (Gemini 3.0 Flash)
    private PRICE_INPUT_1M = 0.50;      // $0.50 per 1M input tokens
    private PRICE_OUTPUT_1M = 3.00;     // $3.00 per 1M output tokens
    private OVERHEAD_MULTIPLIER = 2.5;  // 60% Profit Margin (1 / 0.40)
    private USD_PER_GAME_TOKEN = 0.001; // $1.00 = 1000 Tokens (from Stripe config)

    constructor(ws: WebSocket, apiKey: string, req: IncomingMessage) {
        this.ws = ws;
        this.headers = req.headers;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            tools: getAntigravityTools(),
            systemInstruction: getAntigravitySystemPrompt()
        });

        // Extract token from URL
        // Extract token from URL
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const cliParam = url.searchParams.get('cli') === 'true'; // CLI bypass via URL
        const secretParam = url.searchParams.get('secret');

        this.init(token, cliParam, secretParam);
    }

    private async init(token: string | null, cliMode: boolean = false, secretParam: string | null = null) {
        // Validate CLI Mode - Require Secret Code
        const headerSecret = this.headers['x-antigravity-secret'];
        const validSecret = 'asdf123';

        // Only enable CLI mode if the secret is correct (either from header or URL param)
        if (cliMode || this.headers['x-antigravity-client'] === 'cli') {
            if (headerSecret === validSecret || secretParam === validSecret) {
                this.cliMode = true;
                console.log('[Antigravity] CLI Mode enabled (Valid Secret)');
            } else {
                console.warn('[Antigravity] CLI Mode attempt rejected: Invalid or missing secret');
                this.cliMode = false;
            }
        } else {
            this.cliMode = false;
        }

        // Register Event Handlers IMMEDIATELEY to handle early errors/disconnects without crashing
        this.ws.on('error', (err) => {
            console.error('[Antigravity] WebSocket error:', err);
        });

        this.ws.on('close', () => {
            console.log(`[Antigravity] Session closed for user: ${this.userId || 'guest'}`);
            this.isInterrupted = true;
        });

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
        // 0. Set Lock File
        try {
            await fs.writeFile(LOCK_FILE, String(Date.now()));
        } catch (e) {
            console.error('[Antigravity] Failed to set lock file:', e);
        }

        // 1. Check Auth & Balance
        const isCli = this.cliMode; // Trusted CLI mode (already verified secret in init)

        if (!this.userId && !isCli) {
            this.send('error', { message: 'Authentication required. Please sign in to use this feature.' });
            return;
        }

        if (this.userId && !isCli) {
            const currentBalance = await getUserTokens(this.userId);
            if (currentBalance < 5) { // Minimum threshold to start a request
                this.send('error', { message: 'Insufficient tokens. Please purchase more to continue using AI.' });
                return;
            }
        }

        console.log('[Antigravity] Starting generation with thinking config...');
        this.isInterrupted = false; // Reset flag

        let result: any;
        let thoughtCharCount = 0;
        let usageMetadata: any = null; // Lifted to outer scope for finally block access

        try {
            // Use streaming with thinking config
            // Note: SDK uses snake_case for these parameters
            const request: any = {
                contents: this.contents,
                generationConfig: {
                    thinkingConfig: {
                        include_thoughts: true,
                        thinking_level: 'low'  // Use low thinking for Gemini 3 - faster output
                    }
                }
            };

            result = await this.model.generateContentStream(request);
            console.log('[Antigravity] Stream started...');

            let accumulatedText = '';
            const capturedSignatures: string[] = [];
            let chunkCount = 0;

            for await (const chunk of result.stream) {
                chunkCount++;
                console.log(`[Antigravity] Chunk #${chunkCount} received`);
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
                            // @ts-ignore
                            thoughtCharCount += part.text.length;
                            this.send('thought', { text: part.text });
                            // @ts-ignore
                        } else if (part.text) {
                            accumulatedText += part.text;
                            this.send('token', { text: part.text });
                        }
                    }
                }
            }

            console.log(`[Antigravity] Stream complete. Total chunks: ${chunkCount}, Total text chars: ${accumulatedText.length}`);

            // After stream finishes, get the final aggregated response object to handle function calls reliably
            const response = await result.response;
            usageMetadata = response.usageMetadata; // Capture for finally block
            console.log('[Antigravity] Final response received:', JSON.stringify(usageMetadata));

            const content = response.candidates?.[0]?.content;
            if (!content) {
                console.error('[Antigravity] No content in response! Candidates:', JSON.stringify(response.candidates));
                this.sendError('AI produced no output. Please try again.');
                return;
            }
            console.log('[Antigravity] Content parts count:', content.parts?.length);

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

            // Report Token Usage
            if (usageMetadata) {
                const thoughtTokens = Math.ceil(thoughtCharCount / 4); // Estimate
                this.send('token_usage', {
                    promptTokens: usageMetadata.promptTokenCount,
                    candidatesTokens: usageMetadata.candidatesTokenCount,
                    thoughtTokens: thoughtTokens,
                    totalTokens: usageMetadata.totalTokenCount + thoughtTokens
                });
            }

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
            // RELEASE LOCK
            try {
                if (await fs.stat(LOCK_FILE).catch(() => false)) {
                    await fs.unlink(LOCK_FILE);
                }
            } catch (e) {
                console.error('[Antigravity] Failed to release lock file:', e);
            }

            if (!this.isInterrupted) {
                this.send('complete', {});

                // Deduct cost if successful (and authenticated, and NOT CLI)
                // Calculate Cost & Deduct Tokens
                if (this.userId && !isCli && usageMetadata) {
                    try {
                        const usage = usageMetadata;
                        const thoughtTokens = Math.ceil(thoughtCharCount / 4);

                        const inputCost = (usage.promptTokenCount / 1000000) * this.PRICE_INPUT_1M;
                        const outputCost = ((usage.candidatesTokenCount + thoughtTokens) / 1000000) * this.PRICE_OUTPUT_1M;
                        const totalApiCost = inputCost + outputCost;

                        // Apply Profit Margin and Convert to Game Tokens
                        const targetRevenue = totalApiCost * this.OVERHEAD_MULTIPLIER;
                        const tokensToDeduct = Math.ceil(targetRevenue / this.USD_PER_GAME_TOKEN);

                        // Ensure minimum 1 token deduction if any usage occurred
                        const finalDeduction = Math.max(1, tokensToDeduct);

                        console.log(`[Antigravity] Cost: $${totalApiCost.toFixed(6)} -> Charge: ${finalDeduction} tokens`);

                        await addTokens(this.userId, -finalDeduction, 'ai_usage', 'Gemini Generation');
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
        return ['view_file', 'list_dir', 'write_to_file', 'replace_file_content', 'create_creature', 'create_item'].includes(name);
    }

    private isClientTool(name: string) {
        const clientTools = ['spawn_creature', 'teleport_player', 'get_scene_info', 'update_entity', 'patch_entity', 'set_blocks'];
        console.log(`[Antigravity] Checking tool '${name}'. Server: ${this.isServerTool(name)}, Client: ${clientTools.includes(name)}`);
        return clientTools.includes(name);
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
                const lines = content.split('\n');

                // Handle StartLine and EndLine (1-indexed)
                const startLine = args.StartLine ? Math.max(1, args.StartLine) : 1;
                const endLine = args.EndLine ? Math.min(lines.length, args.EndLine) : lines.length;

                // Extract the requested line range
                const selectedLines = lines.slice(startLine - 1, endLine);
                const result = selectedLines.join('\n');

                // Include metadata about what was returned
                return {
                    content: result.slice(0, 15000),  // Increased limit for line-specific requests
                    totalLines: lines.length,
                    startLine: startLine,
                    endLine: Math.min(endLine, startLine + selectedLines.length - 1),
                    truncated: result.length > 15000
                };
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
            case 'create_creature': {
                const { name, code, description } = args;

                if (!name || !code) {
                    return { error: 'Missing required fields: name and code' };
                }

                const result = await saveCreature({
                    name,
                    code,
                    description: description || '',
                    createdBy: this.userId || 'anonymous',
                    createdAt: Date.now()
                });

                if (result.success) {
                    return {
                        success: true,
                        message: `Created creature '${name}'. It is now available for all players to spawn!`,
                        creatureName: name
                    };
                } else {
                    return { error: result.error };
                }
            }

            case 'create_item': {
                const { name, code, icon, description } = args;
                if (!name || !code || !icon) {
                    return { error: 'Missing required fields: name, code, and icon' };
                }

                const result = await saveItem({
                    name,
                    code,
                    icon,
                    description: description || ''
                });

                if (result.success) {
                    return {
                        success: true,
                        message: `Created item '${name}'. It is now available for all players to use!`,
                        itemName: name
                    };
                } else {
                    return { error: result.error };
                }
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
