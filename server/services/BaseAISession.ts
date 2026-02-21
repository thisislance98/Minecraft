/**
 * BaseAISession - Shared functionality for AI WebSocket sessions
 *
 * Provides common authentication, token management, WebSocket handling,
 * and client tool execution for AI sessions.
 */

import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { auth } from '../config';
import { addTokens, getUserTokens } from './tokenService';

// Pending client tool calls - stored per-session to avoid memory leaks
type PendingCall = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutId: NodeJS.Timeout;
};

// Constants
const CLIENT_TOOL_TIMEOUT_MS = 30000;
const MIN_TOKEN_BALANCE = 5;

/**
 * Model pricing configuration
 * Prices are per million tokens (approximate rates)
 */
export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
    // Claude models (both dot and dash formats for matching flexibility)
    'opus-4-6': { inputPer1M: 5.00, outputPer1M: 25.00 },
    'opus-4.6': { inputPer1M: 5.00, outputPer1M: 25.00 },
    'opus-4-5': { inputPer1M: 5.00, outputPer1M: 25.00 },
    'opus-4.5': { inputPer1M: 5.00, outputPer1M: 25.00 },
    'sonnet-4-6': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'sonnet-4.6': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'sonnet-4-5': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'sonnet-4.5': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'sonnet-4': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'haiku-4-5': { inputPer1M: 0.80, outputPer1M: 4.00 },
    'haiku-4.5': { inputPer1M: 0.80, outputPer1M: 4.00 },
    'haiku': { inputPer1M: 0.80, outputPer1M: 4.00 },
    // GPT models
    'gpt-5.2-pro': { inputPer1M: 21.00, outputPer1M: 168.00 },
    'gpt-5.2-codex': { inputPer1M: 1.75, outputPer1M: 14.00 },
    'gpt-5.1-codex': { inputPer1M: 1.75, outputPer1M: 14.00 },
    'gpt-5.1': { inputPer1M: 1.25, outputPer1M: 10.00 },
    'gpt-5.2': { inputPer1M: 1.25, outputPer1M: 10.00 },
    'gpt-5-mini': { inputPer1M: 0.40, outputPer1M: 1.60 },
    'gpt-4.1-mini': { inputPer1M: 0.40, outputPer1M: 1.60 },
    // Gemini models
    'gemini-3-pro': { inputPer1M: 2.00, outputPer1M: 12.00 },
    'gemini-3-flash': { inputPer1M: 0.50, outputPer1M: 3.00 },
    'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.60 },
    // DeepSeek models
    'deepseek': { inputPer1M: 0.14, outputPer1M: 0.28 },
    // Default fallback
    'default': { inputPer1M: 1.00, outputPer1M: 5.00 },
};

export abstract class BaseAISession {
    protected ws: WebSocket;
    protected userId: string | null = null;
    protected headers: any;
    protected cliMode: boolean = false;
    protected authReady: Promise<void>;
    protected authReadyResolve!: () => void;
    protected isInterrupted = false;

    // Model configuration
    protected model: string;
    protected apiKey: string;

    // World context
    protected currentWorldId: string = 'global';

    // Settings
    protected bypassTokens: boolean = false;

    // Pricing
    protected PRICE_INPUT_1M = 0.25;
    protected PRICE_OUTPUT_1M = 1.25;
    protected OVERHEAD_MULTIPLIER = 1.5;
    protected USD_PER_GAME_TOKEN = 0.001;

    // Pending client tool calls (per-session to avoid memory leaks)
    private pendingToolCalls = new Map<string, PendingCall>();

    // Session name for logging
    protected abstract readonly sessionName: string;

    constructor(ws: WebSocket, req: IncomingMessage, defaultModel: string, apiKeyEnvVar: string = 'OPENROUTER_API_KEY') {
        this.ws = ws;
        this.headers = req.headers;

        // Get API key and model from environment
        this.apiKey = process.env[apiKeyEnvVar] || '';
        this.model = defaultModel;

        if (!this.apiKey) {
            console.error(`[BaseAISession] CRITICAL: Missing ${apiKeyEnvVar}`);
        }

        // Initialize auth ready promise
        this.authReady = new Promise((resolve) => {
            this.authReadyResolve = resolve;
        });

        // Extract params from URL
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const cliParam = url.searchParams.get('cli') === 'true';
        const secretParam = url.searchParams.get('secret');
        const modelParam = url.searchParams.get('model');

        if (modelParam) {
            this.model = modelParam;
        }

        // Use setImmediate to ensure subclass fields are initialized before initBase runs
        setImmediate(() => this.initBase(token, cliParam, secretParam));
    }

    /**
     * Initialize base session functionality
     */
    private async initBase(token: string | null, cliMode: boolean, secretParam: string | null) {
        // Validate CLI Mode
        const headerSecret = this.headers['x-antigravity-secret'];
        const validSecret = process.env.CLI_SECRET;

        if (!validSecret) {
            console.warn(`[${this.sessionName}] WARNING: CLI_SECRET not set, CLI mode disabled`);
        }

        if (validSecret && (cliMode || this.headers['x-antigravity-client'] === 'cli')) {
            if (headerSecret === validSecret || secretParam === validSecret) {
                this.cliMode = true;
                console.log(`[${this.sessionName}] CLI Mode enabled`);
            }
        }

        // Register WebSocket handlers
        this.ws.on('error', (err) => {
            console.error(`[${this.sessionName}] WebSocket error:`, err);
        });

        this.ws.on('close', () => {
            console.log(`[${this.sessionName}] Session closed for user: ${this.userId || 'guest'}`);
            this.isInterrupted = true;
            this.cleanupPendingCalls();
            this.onClose();
        });

        this.ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                await this.handleMessage(msg);
            } catch (e: any) {
                console.error(`[${this.sessionName}] Error handling message:`, e);
                this.sendError(e.message);
            }
        });

        // Verify Auth
        if (token) {
            try {
                if (!auth) throw new Error('Auth service unavailable');
                const decoded = await auth.verifyIdToken(token);
                this.userId = decoded.uid;
                console.log(`[${this.sessionName}] Authenticated user: ${this.userId}`);
                this.sendBalanceUpdate();
            } catch (e) {
                console.error(`[${this.sessionName}] Auth failed:`, e);
                this.send('error', { message: 'Authentication failed' });
            }
        }

        // Call subclass initialization
        await this.onInit();

        console.log(`[${this.sessionName}] Session initialized with model: ${this.model}`);
        this.authReadyResolve();
    }

    /**
     * Override in subclass to perform custom initialization
     */
    protected abstract onInit(): Promise<void>;

    /**
     * Override in subclass to handle WebSocket messages
     */
    protected abstract handleMessage(msg: any): Promise<void>;

    /**
     * Override in subclass to perform cleanup on close
     */
    protected onClose(): void {
        // Default: no-op, subclasses can override
    }

    /**
     * Send a message to the client
     */
    protected send(type: string, payload: any) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...payload }));
        }
    }

    /**
     * Send an error message to the client
     */
    protected sendError(message: string) {
        this.send('error', { message });
    }

    /**
     * Send updated balance to client
     */
    protected async sendBalanceUpdate() {
        if (!this.userId) return;
        const balance = await getUserTokens(this.userId);
        this.send('balance_update', { tokens: balance });
    }

    /**
     * Check if token checks should be skipped
     */
    protected shouldSkipTokenChecks(): boolean {
        return this.cliMode || this.bypassTokens;
    }

    /**
     * Verify user has sufficient tokens
     * @returns true if user can proceed, false if not
     */
    protected async verifyTokenBalance(): Promise<boolean> {
        if (this.shouldSkipTokenChecks()) return true;

        if (!this.userId) {
            this.send('error', { message: 'Authentication required.' });
            return false;
        }

        const balance = await getUserTokens(this.userId);
        if (balance < MIN_TOKEN_BALANCE) {
            this.send('error', { message: 'Insufficient tokens.' });
            return false;
        }

        return true;
    }

    /**
     * Deduct tokens from user's balance
     */
    protected async deductTokens(amount: number, reason: string = 'AI Generation') {
        if (!this.userId || this.shouldSkipTokenChecks()) return;

        try {
            await addTokens(this.userId, -amount, 'ai_usage', reason);
            this.sendBalanceUpdate();
            console.log(`[${this.sessionName}] Deducted ${amount} tokens`);
        } catch (e) {
            console.error(`[${this.sessionName}] Failed to deduct tokens:`, e);
        }
    }

    /**
     * Update pricing based on model ID
     */
    protected updatePricing(modelId: string) {
        // Find matching pricing by checking if model ID contains the key
        for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
            if (key !== 'default' && modelId.includes(key)) {
                this.PRICE_INPUT_1M = pricing.inputPer1M;
                this.PRICE_OUTPUT_1M = pricing.outputPer1M;
                return;
            }
        }
        // Use default pricing
        const defaultPricing = MODEL_PRICING['default'];
        this.PRICE_INPUT_1M = defaultPricing.inputPer1M;
        this.PRICE_OUTPUT_1M = defaultPricing.outputPer1M;
    }

    /**
     * Calculate cost from token usage
     */
    protected calculateCost(inputTokens: number, outputTokens: number, cachedTokens: number = 0) {
        const CACHE_DISCOUNT = 0.1;
        const uncachedTokens = inputTokens - cachedTokens;

        const inputCost = ((uncachedTokens / 1000000) * this.PRICE_INPUT_1M) +
                          ((cachedTokens / 1000000) * this.PRICE_INPUT_1M * CACHE_DISCOUNT);
        const outputCost = (outputTokens / 1000000) * this.PRICE_OUTPUT_1M;
        const totalCost = (inputCost + outputCost) * this.OVERHEAD_MULTIPLIER;
        const tokensToDeduct = Math.max(1, Math.ceil(totalCost / this.USD_PER_GAME_TOKEN));

        return {
            inputTokens,
            outputTokens,
            cachedTokens,
            inputCostUSD: inputCost,
            outputCostUSD: outputCost,
            totalCostUSD: totalCost,
            gameTokens: tokensToDeduct,
            model: this.model
        };
    }

    /**
     * Execute a client-side tool via WebSocket
     */
    protected async executeClientTool(name: string, args: any): Promise<any> {
        return new Promise((resolve) => {
            const callId = this.generateCallId();

            const timeoutId = setTimeout(() => {
                if (this.pendingToolCalls.has(callId)) {
                    this.pendingToolCalls.delete(callId);
                    resolve({ error: 'Client timed out' });
                }
            }, CLIENT_TOOL_TIMEOUT_MS);

            this.pendingToolCalls.set(callId, { resolve, reject: resolve, timeoutId });
            this.send('tool_request', { id: callId, name, args });
        });
    }

    /**
     * Handle tool response from client
     */
    protected handleToolResponse(id: string, result: any, error: any) {
        const pending = this.pendingToolCalls.get(id);
        if (pending) {
            clearTimeout(pending.timeoutId);
            this.pendingToolCalls.delete(id);
            pending.resolve(error ? { error } : result);
        }
    }

    /**
     * Generate a unique call ID
     */
    private generateCallId(): string {
        return Math.random().toString(36).substring(7);
    }

    /**
     * Clean up all pending tool calls (called on session close)
     */
    private cleanupPendingCalls() {
        for (const [id, pending] of this.pendingToolCalls) {
            clearTimeout(pending.timeoutId);
            pending.resolve({ error: 'Session closed' });
        }
        this.pendingToolCalls.clear();
    }

    /**
     * Update world context
     */
    protected updateWorldContext(context: any) {
        if (context?.worldId) {
            this.currentWorldId = context.worldId;
        }
    }

    /**
     * Update settings from client message
     */
    protected updateSettings(settings: any) {
        if (settings?.bypassTokens !== undefined) {
            this.bypassTokens = settings.bypassTokens;
        }
    }

    /**
     * Check if API key is configured
     */
    protected hasApiKey(): boolean {
        return !!this.apiKey;
    }
}
