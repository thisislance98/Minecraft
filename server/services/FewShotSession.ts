/**
 * FewShotSession - WebSocket handler for Few-Shot AI approach
 *
 * Uses tool-based routing and few-shot examples instead of complex SDK
 */

import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { BaseAISession } from './BaseAISession';
import { saveCreature } from './DynamicCreatureService';
import { saveItem } from './DynamicItemService';
import { FewShotAI, availableModels } from '../ai/few_shot_system';

const FEWSHOT_COST_TOKENS = 2; // Minimal charge for few-shot approach

export class FewShotSession extends BaseAISession {
    protected readonly sessionName = 'FewShot';

    // AI system
    private ai: FewShotAI | null = null;

    constructor(ws: WebSocket, req: IncomingMessage) {
        const defaultModel = process.env.FEWSHOT_MODEL || 'anthropic/claude-sonnet-4.5';
        super(ws, req, defaultModel);
    }

    protected async onInit(): Promise<void> {
        // Initialize AI system
        this.ai = new FewShotAI({
            apiKey: this.apiKey,
            model: this.model,
            siteUrl: process.env.OPENROUTER_REFERER || 'http://localhost:5173',
            siteName: 'VoxelWorld'
        });

        // Send available models to client
        this.send('models_list', { models: availableModels, current: this.model });
    }

    protected async handleMessage(msg: any): Promise<void> {
        switch (msg.type) {
            case 'input':
                await this.handleInput(msg.text, msg.context, msg.settings);
                break;
            case 'tool_response':
                this.handleToolResponse(msg.id, msg.result, msg.error);
                break;
            case 'interrupt':
                console.log('[FewShot] Interrupted by client.');
                this.isInterrupted = true;
                break;
            case 'set_model':
                this.setModel(msg.model);
                break;
            case 'get_models':
                this.send('models_list', { models: availableModels });
                break;
        }
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

    private async handleInput(text: string, context: any, settings?: any) {
        await this.authReady;

        if (!this.hasApiKey()) {
            this.sendError('OpenRouter API key not configured');
            return;
        }

        if (!this.ai) {
            this.sendError('AI system not initialized');
            return;
        }

        // Update context and settings
        this.updateWorldContext(context);
        this.updateSettings(settings);

        if (settings?.model) {
            this.setModel(settings.model);
        }

        // Check auth & balance
        if (!await this.verifyTokenBalance()) {
            return;
        }

        this.isInterrupted = false;

        // Send thinking indicator
        this.send('thinking', { message: 'Processing your request...' });

        try {
            // Process the request through the FewShot AI
            // Handle context format: client sends { x, y, z, targetX, targetZ, targetGroundY, dirX, dirZ }
            const playerPosition = context?.position || (context?.x !== undefined ? { x: context.x, y: context.y, z: context.z } : undefined);

            // Target position is where structures should be placed (in front of player, at ground level)
            const targetPosition = context?.targetX !== undefined ? {
                x: context.targetX,
                y: context.targetGroundY,  // Ground level at target
                z: context.targetZ
            } : playerPosition;

            // Player's forward direction
            const playerDirection = context?.dirX !== undefined ? {
                x: context.dirX,
                z: context.dirZ
            } : undefined;

            console.log(`[FewShot] Context received:`, context);
            console.log(`[FewShot] Player position:`, playerPosition);
            console.log(`[FewShot] Target position (with ground level):`, targetPosition);
            console.log(`[FewShot] Player direction:`, playerDirection);

            const result = await this.ai.processRequest(text, {
                playerPosition,
                targetPosition,  // Where structures should be placed (at correct ground level)
                playerDirection,
                worldName: context?.worldName || context?.worldId,
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
            await this.deductTokens(FEWSHOT_COST_TOKENS, 'FewShot Generation');

        } catch (e: any) {
            console.error('[FewShot] Error:', e);
            this.sendError('AI Error: ' + e.message);
        }
    }

    private async handleCreatureResult(result: any) {
        const { code, data } = result;
        const className = data?.className || 'CustomCreature';

        // Send the generated code to the UI for display
        if (code) {
            this.send('code', { code, language: 'javascript', description: `${className} creature code` });
        }

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
        } else if (saveResult.error?.includes('already exists')) {
            // Creature already exists - that's fine, we can still spawn it
            this.send('token', { text: `**${className}** already exists in this world. Let me spawn one for you...` });
        } else {
            this.send('token', { text: `I tried to create a creature but encountered an error: ${saveResult.error}` });
            return; // Don't try to spawn if there was a real error
        }

        // Spawn the creature in front of the player
        const spawnResult = await this.executeClientTool('spawn_creature', {
            type: className,
            count: 1
        });

        if (spawnResult?.success) {
            this.send('token', { text: `\n\n${className} has been spawned in front of you!` });
        } else {
            this.send('token', { text: `\n\nCouldn't spawn the creature: ${spawnResult?.error}` });
        }
    }

    private async handleItemResult(result: any) {
        const { code, icon, data } = result;
        const className = data?.className || 'CustomItem';

        // Send the generated code to the UI for display
        if (code) {
            this.send('code', { code, language: 'javascript', description: `${className} item code` });
        }

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
        const code = result.code || '';

        if (blocks.length === 0) {
            this.send('token', { text: `I couldn't generate any blocks for that structure.` });
            return;
        }

        this.send('token', { text: `Building structure with ${blocks.length} blocks...` });

        // Send the generated code if available
        if (code) {
            this.send('code', { code, language: 'javascript', description: 'Structure generation code' });
        }

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
}
