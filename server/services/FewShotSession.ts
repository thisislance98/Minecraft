/**
 * FewShotSession - WebSocket handler for Few-Shot AI approach
 *
 * Uses tool-based routing and few-shot examples instead of complex SDK
 */

import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { BaseAISession } from './BaseAISession';
import { saveCreature, updateCreature } from './DynamicCreatureService';
import { saveItem, updateItem } from './DynamicItemService';
import { FewShotAI, availableModels } from '../ai/few_shot_system';

const FEWSHOT_COST_TOKENS = 2; // Minimal charge for few-shot approach

export class FewShotSession extends BaseAISession {
    protected readonly sessionName = 'FewShot';

    // AI system
    private ai: FewShotAI | null = null;

    // Conversation history for context
    private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; createdItem?: string }> = [];
    private lastCreatedItem: { type: 'creature' | 'item' | 'structure'; name: string; code?: string } | null = null;
    private readonly MAX_HISTORY_LENGTH = 10;

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

        // Update pricing based on initial model
        this.updatePricing(this.model);

        // Send available models to client
        this.send('models_list', { models: availableModels, current: this.model });
    }

    protected async handleMessage(msg: any): Promise<void> {
        switch (msg.type) {
            case 'input':
                await this.handleInput(msg.text, msg.context, msg.settings, msg.editContext, msg.category);
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

    private async handleInput(text: string, context: any, settings?: any, editContext?: any, category?: string) {
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
        const thinkingMsg = editContext?.isEdit
            ? `Editing ${editContext.type} "${editContext.name}"...`
            : 'Processing your request...';
        this.send('thinking', { message: thinkingMsg });

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
            if (editContext?.isEdit) {
                console.log(`[FewShot] Edit mode: ${editContext.type} "${editContext.name}"`);
            }

            // Add user message to history
            this.conversationHistory.push({ role: 'user', content: text });

            // Build the enhanced text prompt with edit context
            let enhancedText = text;
            if (editContext?.isEdit) {
                enhancedText = `[EDIT MODE] I want to modify the existing ${editContext.type} named "${editContext.name}". Here is the current code:\n\n\`\`\`javascript\n${editContext.existingCode}\n\`\`\`\n\nThe user wants to: ${text}\n\nPlease update the code while keeping the same class name "${editContext.name}".`;
            }

            const result = await this.ai.processRequest(enhancedText, {
                playerPosition,
                targetPosition,  // Where structures should be placed (at correct ground level)
                playerDirection,
                worldName: context?.worldName || context?.worldId,
                userId: this.userId || undefined,
                conversationHistory: this.conversationHistory.slice(-this.MAX_HISTORY_LENGTH),
                lastCreatedItem: this.lastCreatedItem,
                editContext: editContext  // Pass edit context to AI
            }, category || 'custom');

            console.log(`[FewShot] Result:`, result);

            if (!result.success) {
                this.send('token', { text: result.error || 'Something went wrong.' });
                this.send('complete', {});
                return;
            }

            // Handle each result type
            switch (result.type) {
                case 'creature':
                    await this.handleCreatureResult(result, editContext);
                    break;

                case 'item':
                    await this.handleItemResult(result, editContext);
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

            // Send cost info if usage data is available
            if (result.usage) {
                const costInfo = this.calculateCost(
                    result.usage.promptTokens,
                    result.usage.completionTokens
                );
                this.send('cost_info', {
                    inputTokens: costInfo.inputTokens,
                    outputTokens: costInfo.outputTokens,
                    cachedTokens: costInfo.cachedTokens,
                    inputCostUSD: costInfo.inputCostUSD,
                    outputCostUSD: costInfo.outputCostUSD,
                    totalCostUSD: costInfo.totalCostUSD,
                    model: this.model
                });
                console.log(`[FewShot] Cost: $${costInfo.totalCostUSD.toFixed(6)} (${costInfo.inputTokens} in / ${costInfo.outputTokens} out)`);
            }

            this.send('complete', {});

            // Deduct tokens based on actual usage or minimal fallback
            const tokensToDeduct = result.usage
                ? this.calculateCost(result.usage.promptTokens, result.usage.completionTokens).gameTokens
                : FEWSHOT_COST_TOKENS;
            await this.deductTokens(tokensToDeduct, 'FewShot Generation');

        } catch (e: any) {
            console.error('[FewShot] Error:', e);
            this.sendError('AI Error: ' + e.message);
        }
    }

    private async handleCreatureResult(result: any, editContext?: any) {
        const { code, data } = result;
        const className = data?.className || 'CustomCreature';
        const isEdit = editContext?.isEdit && editContext?.type === 'creature';

        // Send the generated code to the UI for display
        if (code) {
            this.send('code', { code, language: 'javascript', description: `${className} creature code` });
        }

        let saveResult;
        let responseText = '';

        if (isEdit) {
            // Update existing creature
            saveResult = await updateCreature(editContext.name, {
                code: code,
                description: `AI-modified creature`
            }, this.currentWorldId);

            if (saveResult.success) {
                responseText = `I've updated the **${editContext.name}** creature!\n\nLet me spawn the updated version for you...`;
                this.send('token', { text: responseText });
            } else {
                responseText = `I tried to update the creature but encountered an error: ${saveResult.error}`;
                this.send('token', { text: responseText });
                return;
            }
        } else {
            // Save new creature
            saveResult = await saveCreature({
                name: className,
                code: code,
                description: `AI-generated creature`,
                createdBy: this.userId || 'anonymous',
                createdAt: Date.now()
            }, this.currentWorldId);

            if (saveResult.success) {
                responseText = `I created a new creature called **${className}**!\n\nLet me spawn it for you...`;
                this.send('token', { text: responseText });
            } else if (saveResult.error?.includes('already exists')) {
                // Creature already exists - that's fine, we can still spawn it
                responseText = `**${className}** already exists in this world. Let me spawn one for you...`;
                this.send('token', { text: responseText });
            } else {
                responseText = `I tried to create a creature but encountered an error: ${saveResult.error}`;
                this.send('token', { text: responseText });
                return; // Don't try to spawn if there was a real error
            }
        }

        // Track what was created for conversation context
        const creatureName = isEdit ? editContext.name : className;
        this.lastCreatedItem = { type: 'creature', name: creatureName, code };

        // Spawn the creature in front of the player
        const spawnResult = await this.executeClientTool('spawn_creature', {
            type: creatureName,
            count: 1
        });

        if (spawnResult?.success) {
            responseText += `\n\n${creatureName} has been spawned in front of you!`;
            this.send('token', { text: `\n\n${creatureName} has been spawned in front of you!` });
        } else {
            responseText += `\n\nCouldn't spawn the creature: ${spawnResult?.error}`;
            this.send('token', { text: `\n\nCouldn't spawn the creature: ${spawnResult?.error}` });
        }

        // Add assistant response to history
        this.conversationHistory.push({
            role: 'assistant',
            content: responseText,
            createdItem: creatureName
        });
    }

    private async handleItemResult(result: any, editContext?: any) {
        const { code, icon, data } = result;
        const className = data?.className || 'CustomItem';
        const isEdit = editContext?.isEdit && editContext?.type === 'item';

        // Send the generated code to the UI for display
        if (code) {
            this.send('code', { code, language: 'javascript', description: `${className} item code` });
        }

        // Extract item ID from the code
        const itemIdMatch = code.match(/super\s*\(\s*['"]([^'"]+)['"]/);
        const itemName = isEdit ? editContext.name : className;
        const itemId = itemIdMatch ? itemIdMatch[1] : itemName.replace(/Item$/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

        let saveResult;

        if (isEdit) {
            // Update existing item
            saveResult = await updateItem(editContext.name, {
                code: code,
                icon: icon || editContext.existingIcon || '',
                description: `AI-modified item`
            }, this.currentWorldId);

            if (saveResult.success) {
                this.send('token', { text: `I've updated the **${editContext.name}** item!` });

                // Give the updated item to the player
                const giveResult = await this.executeClientTool('give_item', {
                    item: itemId,
                    count: 1
                });

                if (giveResult?.success) {
                    this.send('token', { text: `\n\nI've added the updated ${editContext.name} to your inventory!` });
                } else {
                    this.send('token', { text: `\n\nThe item was updated but I couldn't add it to your inventory: ${giveResult?.error}` });
                }
            } else {
                this.send('token', { text: `I tried to update the item but encountered an error: ${saveResult.error}` });
            }
        } else {
            // Save new item
            saveResult = await saveItem({
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
