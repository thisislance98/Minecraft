/**
 * OpenCode Session - Merlin AI using OpenCode SDK with Zen
 *
 * This replaces the Gemini-based MerlinSession with OpenCode,
 * which provides access to multiple AI models (Claude, GPT, Gemini)
 * through a unified interface.
 */

import { WebSocket } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk';
import type { Session, Message, Part } from '@opencode-ai/sdk';

import { auth } from '../config';
import { addTokens, getUserTokens } from './tokenService';
import { saveCreature } from './DynamicCreatureService';
import { saveItem } from './DynamicItemService';
import { searchKnowledge, addKnowledge } from './KnowledgeService';
import { getMerlinSystemPrompt } from '../ai/merlin_prompts';
import { IncomingMessage } from 'http';

const PENDING_TOOL_CALLS = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>();

// Singleton OpenCode instance (shared across sessions)
let opencodeInstance: Awaited<ReturnType<typeof createOpencode>> | null = null;
let opencodeInitPromise: Promise<Awaited<ReturnType<typeof createOpencode>>> | null = null;

async function getOpenCodeInstance() {
    if (opencodeInstance) return opencodeInstance;

    if (!opencodeInitPromise) {
        opencodeInitPromise = createOpencode({
            hostname: '127.0.0.1',
            port: 4096,
            timeout: 10000,
            config: {
                // Use Zen for easy multi-model access, or configure your own provider
                // Default to Claude Sonnet via Zen
                model: process.env.OPENCODE_MODEL || 'opencode/claude-sonnet-4-5',
            }
        });
    }

    opencodeInstance = await opencodeInitPromise;
    console.log('[OpenCode] Server initialized at', opencodeInstance.server.url);
    return opencodeInstance;
}

export class OpenCodeSession {
    private ws: WebSocket;
    private client: ReturnType<typeof createOpencodeClient> | null = null;
    private sessionId: string | null = null;
    private userId: string | null = null;
    private headers: any;
    private cliMode: boolean = false;
    private authReady: Promise<void>;
    private authReadyResolve!: () => void;
    private isInterrupted = false;

    // Knowledge gap detection
    private lastKnowledgeSearch: { query: string; timestamp: number; resultsCount: number } | null = null;

    // Track current world context for world-scoped creature/item creation
    private currentWorldId: string = 'global';

    // Settings
    private bypassTokens: boolean = false;

    constructor(ws: WebSocket, req: IncomingMessage) {
        this.ws = ws;
        this.headers = req.headers;

        // Initialize auth ready promise
        this.authReady = new Promise((resolve) => {
            this.authReadyResolve = resolve;
        });

        // Extract token from URL
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const cliParam = url.searchParams.get('cli') === 'true';
        const secretParam = url.searchParams.get('secret');

        this.init(token, cliParam, secretParam);
    }

    private async init(token: string | null, cliMode: boolean = false, secretParam: string | null = null) {
        // Validate CLI Mode
        // Default secret for local development (same as worlds.ts) - only require explicit CLI_SECRET in production
        const headerSecret = this.headers['x-antigravity-secret'];
        const validSecret = process.env.CLI_SECRET || 'asdf123';

        if (validSecret && (cliMode || this.headers['x-antigravity-client'] === 'cli')) {
            if (headerSecret === validSecret || secretParam === validSecret) {
                this.cliMode = true;
                console.log('[OpenCode] CLI Mode enabled');
            }
        }

        // Register WebSocket handlers
        this.ws.on('error', (err) => {
            console.error('[OpenCode] WebSocket error:', err);
        });

        this.ws.on('close', () => {
            console.log(`[OpenCode] Session closed for user: ${this.userId || 'guest'}`);
            this.isInterrupted = true;
        });

        this.ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'input') {
                    await this.handleInput(msg.text, msg.context, msg.settings);
                } else if (msg.type === 'tool_response') {
                    this.handleToolResponse(msg.id, msg.result, msg.error);
                } else if (msg.type === 'interrupt') {
                    console.log('[OpenCode] Interrupted by client.');
                    this.isInterrupted = true;
                    if (this.sessionId && this.client) {
                        await this.client.session.abort({ path: { id: this.sessionId } });
                    }
                }
            } catch (e: any) {
                console.error('[OpenCode] Error handling message:', e);
                this.sendError(e.message);
            }
        });

        // Verify Auth
        if (token) {
            try {
                if (!auth) throw new Error('Auth service unavailable');
                const decoded = await auth.verifyIdToken(token);
                this.userId = decoded.uid;
                console.log(`[OpenCode] Authenticated user: ${this.userId}`);
                this.sendBalanceUpdate();
            } catch (e) {
                console.error('[OpenCode] Auth failed:', e);
                this.send('error', { message: 'Authentication failed' });
            }
        }

        // Initialize OpenCode client
        try {
            const opencode = await getOpenCodeInstance();
            this.client = opencode.client;

            // Create a new session for this user
            const session = await this.client.session.create({
                body: { title: `Merlin Session - ${this.userId || 'guest'}` }
            });
            this.sessionId = session.data?.id || null;
            console.log('[OpenCode] Session created:', this.sessionId);

            // Inject system prompt as context (without triggering AI response)
            if (this.sessionId) {
                const systemPrompt = getMerlinSystemPrompt();
                await this.client.session.prompt({
                    path: { id: this.sessionId },
                    body: {
                        noReply: true,
                        parts: [{ type: 'text', text: systemPrompt }]
                    }
                });
                console.log('[OpenCode] System prompt injected');
            }
        } catch (e: any) {
            console.error('[OpenCode] Failed to initialize:', e);
            this.sendError('Failed to initialize AI: ' + e.message);
        }

        this.authReadyResolve();
    }

    private send(type: string, payload: any) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...payload }));
        }
    }

    private sendError(message: string) {
        this.send('error', { message });
    }

    private async sendBalanceUpdate() {
        if (!this.userId) return;
        const balance = await getUserTokens(this.userId);
        this.send('balance_update', { tokens: balance });
    }

    private async handleInput(text: string, context: any, settings?: any) {
        await this.authReady;

        if (!this.client || !this.sessionId) {
            this.sendError('AI session not initialized');
            return;
        }

        // Update world context
        if (context?.worldId) {
            this.currentWorldId = context.worldId;
        }

        // Update bypass tokens setting
        if (settings?.bypassTokens !== undefined) {
            this.bypassTokens = settings.bypassTokens;
        }

        // Check auth & balance
        const skipTokenChecks = this.cliMode || this.bypassTokens;
        if (!this.userId && !skipTokenChecks) {
            this.send('error', { message: 'Authentication required.' });
            return;
        }

        if (this.userId && !skipTokenChecks) {
            const balance = await getUserTokens(this.userId);
            if (balance < 5) {
                this.send('error', { message: 'Insufficient tokens.' });
                return;
            }
        }

        this.isInterrupted = false;

        // Build context string
        const contextStr = context ? `\n[Context: ${JSON.stringify(context)}]` : '';
        const fullMessage = text + contextStr;

        try {
            // Subscribe to events for streaming
            const events = await this.client.event.subscribe();

            // Send the prompt
            const promptPromise = this.client.session.prompt({
                path: { id: this.sessionId },
                body: {
                    parts: [{ type: 'text', text: fullMessage }]
                }
            });

            // Process streaming events
            for await (const event of events.stream) {
                if (this.isInterrupted) break;

                await this.handleOpenCodeEvent(event);
            }

            // Wait for prompt to complete
            const result = await promptPromise;

            this.send('complete', {});

        } catch (e: any) {
            if (!this.isInterrupted) {
                console.error('[OpenCode] Error:', e);
                this.sendError('AI Error: ' + e.message);
            }
        }
    }

    private async handleOpenCodeEvent(event: any) {
        const { type, properties } = event;

        switch (type) {
            case 'part.text.delta':
                // Streaming text token
                this.send('token', { text: properties.delta });
                break;

            case 'part.thinking.delta':
                // Thinking/reasoning token
                this.send('thought', { text: properties.delta });
                break;

            case 'part.tool.start':
                // Tool execution starting
                this.send('tool_start', {
                    name: properties.name,
                    args: properties.input
                });
                break;

            case 'part.tool.result':
                // Tool execution completed
                this.send('tool_end', {
                    name: properties.name,
                    result: properties.output
                });

                // Handle our custom game tools that need client-side execution
                if (this.isClientTool(properties.name)) {
                    const result = await this.executeClientTool(properties.name, properties.input);
                    // The result is already handled by OpenCode's tool system
                }
                break;

            case 'message.complete':
                // Message finished
                break;

            case 'session.updated':
                // Session state changed
                break;
        }
    }

    private isClientTool(name: string): boolean {
        return ['spawn_creature', 'teleport_player', 'get_scene_info', 'update_entity',
                'patch_entity', 'set_blocks', 'run_verification', 'capture_screenshot',
                'capture_video', 'capture_logs'].includes(name);
    }

    private async executeClientTool(name: string, args: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const callId = Math.random().toString(36).substring(7);
            PENDING_TOOL_CALLS.set(callId, { resolve, reject });

            this.send('tool_request', { id: callId, name, args });

            // Timeout after 30s
            setTimeout(() => {
                if (PENDING_TOOL_CALLS.has(callId)) {
                    PENDING_TOOL_CALLS.delete(callId);
                    resolve({ error: 'Client timed out' });
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

    // Server-side tool handlers for knowledge and creature/item creation
    async handleServerTool(name: string, args: any): Promise<any> {
        switch (name) {
            case 'search_knowledge': {
                const { query, category } = args;
                console.log(`[OpenCode] Knowledge search: "${query}"`);
                const results = searchKnowledge(query, category);
                this.lastKnowledgeSearch = {
                    query,
                    timestamp: Date.now(),
                    resultsCount: results.length
                };
                return {
                    success: true,
                    count: results.length,
                    results: results.map(r => ({
                        id: r.id,
                        category: r.category,
                        title: r.title,
                        content: r.content.slice(0, 500),
                        tags: r.tags
                    }))
                };
            }

            case 'add_knowledge': {
                const { category, title, content, tags } = args;
                const result = await addKnowledge({ category, title, content, tags });
                return result.success
                    ? { success: true, message: `Knowledge '${title}' stored`, id: result.id }
                    : { error: result.error };
            }

            case 'create_creature': {
                const { name, code, description } = args;
                if (!name || !code) return { error: 'Missing name or code' };

                const result = await saveCreature({
                    name,
                    code,
                    description: description || '',
                    createdBy: this.userId || 'anonymous',
                    createdAt: Date.now()
                }, this.currentWorldId);

                return result.success
                    ? { success: true, message: `Created creature '${name}'`, worldId: this.currentWorldId }
                    : { error: result.error };
            }

            case 'create_item': {
                const { name, code, icon, description } = args;
                if (!name || !code || !icon) return { error: 'Missing name, code, or icon' };

                const result = await saveItem({
                    name,
                    code,
                    icon,
                    description: description || ''
                }, this.currentWorldId);

                return result.success
                    ? { success: true, message: `Created item '${name}'`, worldId: this.currentWorldId }
                    : { error: result.error };
            }

            default:
                return { error: `Unknown server tool: ${name}` };
        }
    }
}

// Cleanup function for graceful shutdown
export async function shutdownOpenCode() {
    if (opencodeInstance) {
        console.log('[OpenCode] Shutting down server...');
        opencodeInstance.server.close();
        opencodeInstance = null;
        opencodeInitPromise = null;
    }
}
