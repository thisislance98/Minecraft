/**
 * FewShotSession - WebSocket handler for Few-Shot AI approach
 *
 * Uses tool-based routing and few-shot examples instead of complex SDK
 */

import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { auth } from '../config';
import { addTokens, getUserTokens } from './tokenService';
import { saveCreature } from './DynamicCreatureService';
import { saveItem } from './DynamicItemService';
import { FewShotAI, availableModels } from '../ai/few_shot_system';

const PENDING_TOOL_CALLS = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>();

export class FewShotSession {
    private ws: WebSocket;
    private userId: string | null = null;
    private headers: any;
    private cliMode: boolean = false;
    private authReady: Promise<void>;
    private authReadyResolve!: () => void;
    private isInterrupted = false;

    // AI system
    private ai: FewShotAI | null = null;

    // Model configuration
    private model: string;
    private apiKey: string;

    // Track current world context
    private currentWorldId: string = 'global';

    // Settings
    private bypassTokens: boolean = false;

    // Pricing (adjusted for cheaper models)
    private PRICE_INPUT_1M = 0.25;  // Haiku pricing as default
    private PRICE_OUTPUT_1M = 1.25;
    private OVERHEAD_MULTIPLIER = 1.5;
    private USD_PER_GAME_TOKEN = 0.001;

    constructor(ws: WebSocket, req: IncomingMessage) {
        this.ws = ws;
        this.headers = req.headers;

        // Get API key and model from environment
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.model = process.env.FEWSHOT_MODEL || 'anthropic/claude-3-haiku';

        if (!this.apiKey) {
            console.error('[FewShot] CRITICAL: Missing OPENROUTER_API_KEY');
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

        this.init(token, cliParam, secretParam);
    }

    private async init(token: string | null, cliMode: boolean = false, secretParam: string | null = null) {
        // Validate CLI Mode
        const headerSecret = this.headers['x-antigravity-secret'];
        const validSecret = process.env.CLI_SECRET || 'asdf123';

        if (validSecret && (cliMode || this.headers['x-antigravity-client'] === 'cli')) {
            if (headerSecret === validSecret || secretParam === validSecret) {
                this.cliMode = true;
                console.log('[FewShot] CLI Mode enabled');
            }
        }

        // Register WebSocket handlers
        this.ws.on('error', (err) => {
            console.error('[FewShot] WebSocket error:', err);
        });

        this.ws.on('close', () => {
            console.log(`[FewShot] Session closed for user: ${this.userId || 'guest'}`);
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
                    console.log('[FewShot] Interrupted by client.');
                    this.isInterrupted = true;
                } else if (msg.type === 'set_model') {
                    this.setModel(msg.model);
                } else if (msg.type === 'get_models') {
                    this.send('models_list', { models: availableModels });
                }
            } catch (e: any) {
                console.error('[FewShot] Error handling message:', e);
                this.sendError(e.message);
            }
        });

        // Verify Auth
        if (token) {
            try {
                if (!auth) throw new Error('Auth service unavailable');
                const decoded = await auth.verifyIdToken(token);
                this.userId = decoded.uid;
                console.log(`[FewShot] Authenticated user: ${this.userId}`);
                this.sendBalanceUpdate();
            } catch (e) {
                console.error('[FewShot] Auth failed:', e);
                this.send('error', { message: 'Authentication failed' });
            }
        }

        // Initialize AI system
        this.ai = new FewShotAI({
            apiKey: this.apiKey,
            model: this.model,
            siteUrl: process.env.OPENROUTER_REFERER || 'http://localhost:5173',
            siteName: 'VoxelWorld'
        });

        console.log(`[FewShot] Session initialized with model: ${this.model}`);

        // Send available models to client
        this.send('models_list', { models: availableModels, current: this.model });

        this.authReadyResolve();
    }

    private setModel(modelId: string) {
        if (!modelId) return;

        // Validate model exists
        const validModel = availableModels.find(m => m.id === modelId);
        if (!validModel) {
            this.sendError(`Invalid model: ${modelId}`);
            return;
        }

        this.model = modelId;
        if (this.ai) {
            this.ai.setModel(modelId);
        }

        // Update pricing based on model
        this.updatePricing(modelId);

        console.log(`[FewShot] Model changed to: ${modelId}`);
        this.send('model_changed', { model: modelId });
    }

    private updatePricing(modelId: string) {
        // Approximate pricing per million tokens (July 2025 rates from OpenRouter)
        if (modelId.includes('opus-4.6') || modelId.includes('opus-4.5')) {
            this.PRICE_INPUT_1M = 5.00;
            this.PRICE_OUTPUT_1M = 25.00;
        } else if (modelId.includes('sonnet-4.5') || modelId.includes('sonnet-4')) {
            this.PRICE_INPUT_1M = 3.00;
            this.PRICE_OUTPUT_1M = 15.00;
        } else if (modelId.includes('haiku-4.5') || modelId.includes('haiku')) {
            this.PRICE_INPUT_1M = 0.80;
            this.PRICE_OUTPUT_1M = 4.00;
        } else if (modelId.includes('gpt-5.2-pro')) {
            this.PRICE_INPUT_1M = 21.00;
            this.PRICE_OUTPUT_1M = 168.00;
        } else if (modelId.includes('gpt-5.2-codex') || modelId.includes('gpt-5.1-codex')) {
            this.PRICE_INPUT_1M = 1.75;
            this.PRICE_OUTPUT_1M = 14.00;
        } else if (modelId.includes('gpt-5.1') || modelId.includes('gpt-5.2')) {
            this.PRICE_INPUT_1M = 1.25;
            this.PRICE_OUTPUT_1M = 10.00;
        } else if (modelId.includes('gpt-5-mini') || modelId.includes('gpt-4.1-mini')) {
            this.PRICE_INPUT_1M = 0.40;
            this.PRICE_OUTPUT_1M = 1.60;
        } else if (modelId.includes('gemini-3-pro')) {
            this.PRICE_INPUT_1M = 2.00;
            this.PRICE_OUTPUT_1M = 12.00;
        } else if (modelId.includes('gemini-3-flash')) {
            this.PRICE_INPUT_1M = 0.50;
            this.PRICE_OUTPUT_1M = 3.00;
        } else if (modelId.includes('gemini-2.5-flash')) {
            this.PRICE_INPUT_1M = 0.15;
            this.PRICE_OUTPUT_1M = 0.60;
        } else if (modelId.includes('deepseek')) {
            this.PRICE_INPUT_1M = 0.14;
            this.PRICE_OUTPUT_1M = 0.28;
        } else {
            // Default fallback
            this.PRICE_INPUT_1M = 1.00;
            this.PRICE_OUTPUT_1M = 5.00;
        }
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

        if (!this.apiKey) {
            this.sendError('OpenRouter API key not configured');
            return;
        }

        if (!this.ai) {
            this.sendError('AI system not initialized');
            return;
        }

        // Update world context
        if (context?.worldId) {
            this.currentWorldId = context.worldId;
        }

        // Update settings
        if (settings?.bypassTokens !== undefined) {
            this.bypassTokens = settings.bypassTokens;
        }
        if (settings?.model) {
            this.setModel(settings.model);
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

        // Send thinking indicator
        this.send('thinking', { message: 'Processing your request...' });

        try {
            // Process the request through the FewShot AI
            const result = await this.ai.processRequest(text, {
                playerPosition: context?.position,
                playerDirection: context?.direction,
                worldName: context?.worldName,
                userId: this.userId || undefined
            });

            console.log(`[FewShot] Result:`, result);

            if (!result.success) {
                this.send('token', { text: result.error || 'Something went wrong.' });
                this.send('complete', {});
                return;
            }

            // Handle each result type
            switch (result.type) {
                case 'creature':
                    await this.handleCreatureResult(result);
                    break;

                case 'item':
                    await this.handleItemResult(result);
                    break;

                case 'structure':
                    await this.handleStructureResult(result, context);
                    break;

                case 'spawn':
                    await this.handleSpawnResult(result, context);
                    break;

                case 'give':
                    await this.handleGiveResult(result);
                    break;

                case 'blocks':
                    await this.handleBlocksResult(result, context);
                    break;

                case 'chat':
                    this.send('token', { text: result.message || 'Hello!' });
                    break;

                default:
                    this.send('token', { text: 'I processed your request but am not sure how to respond.' });
            }

            this.send('complete', {});

            // Deduct tokens (minimal for few-shot approach)
            if (this.userId && !skipTokenChecks) {
                await this.deductMinimalTokens();
            }

        } catch (e: any) {
            console.error('[FewShot] Error:', e);
            this.sendError('AI Error: ' + e.message);
        }
    }

    private async handleCreatureResult(result: any) {
        const { code, data } = result;
        const className = data?.className || 'CustomCreature';

        // Save the creature
        const saveResult = await saveCreature({
            name: className,
            code: code,
            description: `AI-generated creature`,
            createdBy: this.userId || 'anonymous',
            createdAt: Date.now()
        }, this.currentWorldId);

        if (saveResult.success) {
            this.send('token', { text: `I created a new creature called **${className}**!\n\nLet me spawn it for you...` });

            // Spawn the creature in front of the player
            const spawnResult = await this.executeClientTool('spawn_creature', {
                type: className,
                count: 1
            });

            if (spawnResult?.success) {
                this.send('token', { text: `\n\n${className} has been spawned in front of you!` });
            } else {
                this.send('token', { text: `\n\nThe creature was created but I couldn't spawn it: ${spawnResult?.error}` });
            }
        } else {
            this.send('token', { text: `I tried to create a creature but encountered an error: ${saveResult.error}` });
        }
    }

    private async handleItemResult(result: any) {
        const { code, icon, data } = result;
        const className = data?.className || 'CustomItem';

        // Extract item ID from the code
        const itemIdMatch = code.match(/super\s*\(\s*['"]([^'"]+)['"]/);
        const itemId = itemIdMatch ? itemIdMatch[1] : className.replace(/Item$/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

        // Save the item
        const saveResult = await saveItem({
            name: className,
            code: code,
            icon: icon || '',
            description: `AI-generated item`
        }, this.currentWorldId);

        if (saveResult.success) {
            this.send('token', { text: `I created a new item called **${className}**!` });

            // Give the item to the player
            const giveResult = await this.executeClientTool('give_item', {
                item: itemId,
                count: 1
            });

            if (giveResult?.success) {
                this.send('token', { text: `\n\nI've added ${className} to your inventory!` });
            } else {
                this.send('token', { text: `\n\nThe item was created but I couldn't add it to your inventory: ${giveResult?.error}` });
            }
        } else {
            this.send('token', { text: `I tried to create an item but encountered an error: ${saveResult.error}` });
        }
    }

    private async handleStructureResult(result: any, context: any) {
        const blocks = result.data?.blocks || [];

        if (blocks.length === 0) {
            this.send('token', { text: `I couldn't generate any blocks for that structure.` });
            return;
        }

        this.send('token', { text: `Building structure with ${blocks.length} blocks...` });

        // Place blocks in batches
        const batchSize = 100;
        for (let i = 0; i < blocks.length; i += batchSize) {
            const batch = blocks.slice(i, i + batchSize);
            const setResult = await this.executeClientTool('set_blocks', { blocks: batch });

            if (!setResult?.success) {
                this.send('token', { text: `\n\nEncountered an error placing blocks: ${setResult?.error}` });
                return;
            }
        }

        this.send('token', { text: `\n\nStructure complete! ${blocks.length} blocks placed.` });
    }

    private async handleSpawnResult(result: any, context: any) {
        const { creature, count } = result.data;

        const spawnResult = await this.executeClientTool('spawn_creature', {
            type: creature,
            count: count
        });

        if (spawnResult?.success) {
            this.send('token', { text: `Spawned ${count} ${creature}${count > 1 ? 's' : ''}!` });
        } else {
            this.send('token', { text: `Failed to spawn ${creature}: ${spawnResult?.error}` });
        }
    }

    private async handleGiveResult(result: any) {
        const { item, count } = result.data;

        const giveResult = await this.executeClientTool('give_item', {
            item: item,
            count: count
        });

        if (giveResult?.success) {
            this.send('token', { text: `Gave you ${count} ${item}${count > 1 ? 's' : ''}!` });
        } else {
            this.send('token', { text: `Failed to give ${item}: ${giveResult?.error}` });
        }
    }

    private async handleBlocksResult(result: any, context: any) {
        const blocks = result.data || [];

        if (blocks.length === 0) {
            this.send('token', { text: `No blocks to place.` });
            return;
        }

        const setResult = await this.executeClientTool('set_blocks', { blocks });

        if (setResult?.success) {
            this.send('token', { text: `Placed ${blocks.length} block${blocks.length > 1 ? 's' : ''}!` });
        } else {
            this.send('token', { text: `Failed to place blocks: ${setResult?.error}` });
        }
    }

    private async executeClientTool(name: string, args: any): Promise<any> {
        return new Promise((resolve) => {
            const callId = Math.random().toString(36).substring(7);
            PENDING_TOOL_CALLS.set(callId, { resolve, reject: resolve });

            this.send('tool_request', { id: callId, name, args });

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
            pending.resolve(error ? { error } : result);
        }
    }

    private async deductMinimalTokens() {
        if (!this.userId) return;

        // Few-shot uses smaller prompts, so charge minimal tokens
        const tokensToDeduct = 2; // Minimal charge for few-shot

        try {
            await addTokens(this.userId, -tokensToDeduct, 'ai_usage', 'FewShot Generation');
            this.sendBalanceUpdate();
            console.log(`[FewShot] Deducted ${tokensToDeduct} tokens`);
        } catch (e) {
            console.error('[FewShot] Failed to deduct tokens:', e);
        }
    }
}
