/**
 * FewShotSession - WebSocket handler for Few-Shot AI approach
 *
 * Chat-based protocol using chat_* events for streaming responses.
 * Supports conversation history, compaction, and created-items tracking.
 */

import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { BaseAISession } from './BaseAISession';
import { saveCreature, updateCreature } from './DynamicCreatureService';
import { saveItem, updateItem } from './DynamicItemService';
import { FewShotAI, availableModels, OnTokenCallback } from '../ai/few_shot_system';

const FEWSHOT_COST_TOKENS = 2; // Minimal charge for few-shot approach

export class FewShotSession extends BaseAISession {
    protected readonly sessionName = 'FewShot';

    // ── Static session registry (for HTTP verify endpoints) ──
    private static activeSessions = new Map<string, FewShotSession>();
    private sessionId: string;
    private wsPath: string = '';

    /** Get a connected session that supports verification (FewShotClient, not MerlinClient) */
    static getAnySession(): FewShotSession | undefined {
        // Prefer sessions connected via /api/fewshot (FewShotClient has verify handler)
        for (const session of FewShotSession.activeSessions.values()) {
            if (session.isConnected() && session.wsPath.includes('/api/fewshot')) return session;
        }
        // Fallback to any connected session
        for (const session of FewShotSession.activeSessions.values()) {
            if (session.isConnected()) return session;
        }
        return undefined;
    }

    static getSession(id: string): FewShotSession | undefined {
        return FewShotSession.activeSessions.get(id);
    }

    static getAllSessions(): FewShotSession[] {
        return Array.from(FewShotSession.activeSessions.values()).filter(s => s.isConnected());
    }

    isConnected(): boolean {
        return this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Send a verification request to the connected game client and wait for response.
     * Reuses the same tool_request/tool_response pattern as executeClientTool.
     */
    async requestVerification(verifyType: string, args: any = {}): Promise<any> {
        return this.executeClientTool('verify', { verifyType, ...args });
    }

    // AI system
    private ai: FewShotAI | null = null;

    // Conversation history for context
    private conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string; createdItem?: string }> = [];
    private lastCreatedItem: {
        type: 'creature' | 'item' | 'structure';
        name: string;
        code?: string;
        spawnedEntityIds?: string[];
        placedBlocks?: { x: number; y: number; z: number }[];
    } | null = null;
    private readonly MAX_HISTORY_LENGTH = 10;

    // Created items registry for compaction
    private createdItems: Array<{ type: string; name: string; code?: string; turnIndex: number }> = [];
    private readonly COMPACT_THRESHOLD = 30;

    // Message ID counter
    private messageCounter = 0;

    constructor(ws: WebSocket, req: IncomingMessage) {
        const defaultModel = process.env.FEWSHOT_MODEL || 'anthropic/claude-opus-4.6';
        super(ws, req, defaultModel);

        // Track which WebSocket path this session was created from
        this.wsPath = req.url || '';

        // Register in static registry
        this.sessionId = `fewshot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        FewShotSession.activeSessions.set(this.sessionId, this);
        console.log(`[FewShot] Session registered: ${this.sessionId} (path: ${this.wsPath})`);
    }

    protected onClose(): void {
        FewShotSession.activeSessions.delete(this.sessionId);
        console.log(`[FewShot] Session unregistered: ${this.sessionId}`);
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

    private generateMessageId(): string {
        return `msg_${++this.messageCounter}_${Date.now()}`;
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

    /**
     * Compact conversation history when it gets too long.
     * Template-based: summarizes old messages while preserving created items.
     */
    private compactHistory(): void {
        if (this.conversationHistory.length <= this.COMPACT_THRESHOLD) return;

        console.log(`[FewShot] Compacting conversation history (${this.conversationHistory.length} messages)`);

        const halfIdx = Math.floor(this.conversationHistory.length / 2);
        const oldMessages = this.conversationHistory.slice(0, halfIdx);
        const recentMessages = this.conversationHistory.slice(halfIdx);

        // Build template summary of old messages
        const createdSummary = this.createdItems
            .filter(item => item.turnIndex < halfIdx)
            .map(item => `- Created ${item.type}: ${item.name}`)
            .join('\n');

        const userRequests = oldMessages
            .filter(m => m.role === 'user')
            .map(m => `- "${m.content.substring(0, 80)}"`)
            .slice(-5)
            .join('\n');

        const summary = `[Conversation Summary]\nPrevious requests:\n${userRequests || '(none)'}\n\nCreated items so far:\n${createdSummary || '(none)'}`;

        this.conversationHistory = [
            { role: 'system', content: summary },
            ...recentMessages
        ];

        console.log(`[FewShot] Compacted to ${this.conversationHistory.length} messages`);
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

        // Generate message ID for this AI response
        const messageId = this.generateMessageId();

        // Emit chat_start
        this.send('chat_start', { messageId });

        try {
            // Process the request through the FewShot AI
            const playerPosition = context?.position || (context?.x !== undefined ? { x: context.x, y: context.y, z: context.z } : undefined);

            const targetPosition = context?.targetX !== undefined ? {
                x: context.targetX,
                y: context.targetGroundY,
                z: context.targetZ
            } : playerPosition;

            const playerDirection = context?.dirX !== undefined ? {
                x: context.dirX,
                z: context.dirZ
            } : undefined;

            console.log(`[FewShot] Context received:`, context);
            console.log(`[FewShot] Player position:`, playerPosition);
            console.log(`[FewShot] Target position (with ground level):`, targetPosition);
            if (editContext?.isEdit) {
                console.log(`[FewShot] Edit mode: ${editContext.type} "${editContext.name}"`);
            }

            // Add user message to history
            this.conversationHistory.push({ role: 'user', content: text });

            // Compact if needed
            this.compactHistory();

            // Build the enhanced text prompt with edit context
            let enhancedText = text;
            if (editContext?.isEdit) {
                enhancedText = `[EDIT MODE] I want to modify the existing ${editContext.type} named "${editContext.name}". Here is the current code:\n\n\`\`\`javascript\n${editContext.existingCode}\n\`\`\`\n\nThe user wants to: ${text}\n\nPlease update the code while keeping the same class name "${editContext.name}".`;
            }

            // Create onToken callback that emits chat_token events
            const onToken: OnTokenCallback = (tokenText: string) => {
                if (!this.isInterrupted) {
                    this.send('chat_token', { messageId, text: tokenText });
                }
            };

            const result = await this.ai.processRequest(enhancedText, {
                playerPosition,
                targetPosition,
                playerDirection,
                worldName: context?.worldName || context?.worldId,
                userId: this.userId || undefined,
                conversationHistory: this.conversationHistory.slice(-this.MAX_HISTORY_LENGTH),
                lastCreatedItem: this.lastCreatedItem,
                editContext: editContext
            }, category || 'custom', onToken);

            console.log(`[FewShot] Result:`, { type: result.type, success: result.success });

            if (!result.success) {
                this.send('chat_token', { messageId, text: result.error || 'Something went wrong.' });
                this.send('chat_end', { messageId });
                return;
            }

            // Handle each result type - emit chat_code and chat_action events
            switch (result.type) {
                case 'creature':
                    await this.handleCreatureResult(result, messageId, editContext);
                    break;

                case 'item':
                    await this.handleItemResult(result, messageId, editContext);
                    break;

                case 'structure':
                    await this.handleStructureResult(result, messageId, context);
                    break;

                case 'spawn':
                    await this.handleSpawnResult(result, messageId, context);
                    break;

                case 'give':
                    await this.handleGiveResult(result, messageId);
                    break;

                case 'blocks':
                    await this.handleBlocksResult(result, messageId, context);
                    break;

                case 'chat':
                    // Chat text was already streamed via onToken
                    // If there was no streaming (non-streaming fallback), send the message
                    if (result.message && !result.usage) {
                        this.send('chat_token', { messageId, text: result.message });
                    }
                    break;

                default:
                    this.send('chat_token', { messageId, text: 'I processed your request but am not sure how to respond.' });
            }

            // Send cost info
            if (result.usage) {
                const costInfo = this.calculateCost(
                    result.usage.promptTokens,
                    result.usage.completionTokens
                );
                this.send('chat_cost', {
                    messageId,
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

            // Emit chat_end
            this.send('chat_end', { messageId });

            // Also emit legacy events for backwards compat
            this.send('complete', {});

            // Deduct tokens
            const tokensToDeduct = result.usage
                ? this.calculateCost(result.usage.promptTokens, result.usage.completionTokens).gameTokens
                : FEWSHOT_COST_TOKENS;
            await this.deductTokens(tokensToDeduct, 'FewShot Generation');

        } catch (e: any) {
            console.error('[FewShot] Error:', e);
            this.send('chat_error', { messageId, error: e.message });
            this.send('chat_end', { messageId });
        }
    }

    private async handleCreatureResult(result: any, messageId: string, editContext?: any) {
        const { code, data } = result;
        const className = data?.className || 'CustomCreature';
        // isEdit can come from the AI tool call (data.isEdit) or from explicit editContext
        const isEdit = data?.isEdit === true || (editContext?.isEdit && editContext?.type === 'creature');

        // Send the generated code as a chat_code event
        if (code) {
            this.send('chat_code', { messageId, code, language: 'javascript', description: `${className} creature code` });
        }

        // If this is an edit, despawn old creatures first
        if (isEdit && this.lastCreatedItem?.type === 'creature' && this.lastCreatedItem.spawnedEntityIds?.length) {
            console.log(`[FewShot] Edit mode: despawning ${this.lastCreatedItem.spawnedEntityIds.length} old ${this.lastCreatedItem.name} entities`);
            this.send('chat_token', { messageId, text: `\n\nRemoving the old ${this.lastCreatedItem.name}...` });

            const despawnResult = await this.executeClientTool('despawn_creatures', {
                entityIds: this.lastCreatedItem.spawnedEntityIds
            });

            if (despawnResult?.success) {
                console.log(`[FewShot] Despawned ${despawnResult.removed} old entities`);
            } else {
                console.warn(`[FewShot] Failed to despawn old entities:`, despawnResult?.error);
            }
        }

        let saveResult;
        let responseText = '';

        if (isEdit) {
            const editName = editContext?.name || this.lastCreatedItem?.name || className;
            saveResult = await updateCreature(editName, {
                code: code,
                description: `AI-modified creature`
            }, this.currentWorldId);

            if (saveResult.success) {
                responseText = `\n\nI've updated the **${editName}** creature! Spawning the updated version...`;
                this.send('chat_token', { messageId, text: responseText });
            } else {
                responseText = `\n\nI tried to update the creature but encountered an error: ${saveResult.error}`;
                this.send('chat_token', { messageId, text: responseText });
                return;
            }
        } else {
            saveResult = await saveCreature({
                name: className,
                code: code,
                description: `AI-generated creature`,
                createdBy: this.userId || 'anonymous',
                createdAt: Date.now()
            }, this.currentWorldId);

            if (saveResult.success) {
                responseText = `\n\nI created a new creature called **${className}**! Spawning it now...`;
                this.send('chat_token', { messageId, text: responseText });
            } else if (saveResult.error?.includes('already exists')) {
                responseText = `\n\n**${className}** already exists. Spawning one for you...`;
                this.send('chat_token', { messageId, text: responseText });
            } else {
                responseText = `\n\nI tried to create a creature but encountered an error: ${saveResult.error}`;
                this.send('chat_token', { messageId, text: responseText });
                return;
            }
        }

        // Track what was created
        const creatureName = isEdit ? (editContext?.name || this.lastCreatedItem?.name || className) : className;

        // Spawn the creature
        const spawnResult = await this.executeClientTool('spawn_creature', {
            type: creatureName,
            count: 1
        });

        if (spawnResult?.success) {
            const position = spawnResult.position;
            const posStr = position ? ` at (${position.x}, ${position.y}, ${position.z})` : '';
            this.send('chat_token', { messageId, text: `\n\n${creatureName} has been spawned${posStr}!` });

            // Emit chat_action with coordinates
            this.send('chat_action', {
                messageId,
                action: 'spawn_creature',
                name: creatureName,
                position: position || null
            });

            // Store spawned entity IDs for future edits
            this.lastCreatedItem = {
                type: 'creature',
                name: creatureName,
                code,
                spawnedEntityIds: spawnResult.spawned || []
            };
        } else {
            this.send('chat_token', { messageId, text: `\n\nCouldn't spawn the creature: ${spawnResult?.error}` });
            // Still track the created item even if spawn failed
            this.lastCreatedItem = { type: 'creature', name: creatureName, code };
        }

        this.createdItems.push({ type: 'creature', name: creatureName, code, turnIndex: this.conversationHistory.length });

        // Add to conversation history
        this.conversationHistory.push({
            role: 'assistant',
            content: `Created creature: ${creatureName}`,
            createdItem: creatureName
        });
    }

    private async handleItemResult(result: any, messageId: string, editContext?: any) {
        const { code, icon, data } = result;
        const className = data?.className || 'CustomItem';
        const isEdit = editContext?.isEdit && editContext?.type === 'item';

        // Send code
        if (code) {
            this.send('chat_code', { messageId, code, language: 'javascript', description: `${className} item code` });
        }

        const itemIdMatch = code.match(/super\s*\(\s*['"]([^'"]+)['"]/);
        const itemName = isEdit ? editContext.name : className;
        const itemId = itemIdMatch ? itemIdMatch[1] : itemName.replace(/Item$/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

        let saveResult;

        if (isEdit) {
            saveResult = await updateItem(editContext.name, {
                code: code,
                icon: icon || editContext.existingIcon || '',
                description: `AI-modified item`
            }, this.currentWorldId);

            if (saveResult.success) {
                this.send('chat_token', { messageId, text: `\n\nI've updated the **${editContext.name}** item!` });

                const giveResult = await this.executeClientTool('give_item', { item: itemId, count: 1 });
                if (giveResult?.success) {
                    this.send('chat_token', { messageId, text: `\n\nAdded the updated ${editContext.name} to your inventory!` });
                    this.send('chat_action', { messageId, action: 'give_item', name: editContext.name });
                }
            } else {
                this.send('chat_token', { messageId, text: `\n\nError updating item: ${saveResult.error}` });
            }
        } else {
            saveResult = await saveItem({
                name: className,
                code: code,
                icon: icon || '',
                description: `AI-generated item`
            }, this.currentWorldId);

            if (saveResult.success) {
                this.send('chat_token', { messageId, text: `\n\nI created a new item called **${className}**!` });

                const giveResult = await this.executeClientTool('give_item', { item: itemId, count: 1 });
                if (giveResult?.success) {
                    this.send('chat_token', { messageId, text: `\n\nAdded ${className} to your inventory!` });
                    this.send('chat_action', { messageId, action: 'give_item', name: className });
                }
            } else {
                this.send('chat_token', { messageId, text: `\n\nError creating item: ${saveResult.error}` });
            }
        }

        // Track created item
        this.lastCreatedItem = { type: 'item', name: itemName, code };
        this.createdItems.push({ type: 'item', name: itemName, turnIndex: this.conversationHistory.length });

        this.conversationHistory.push({
            role: 'assistant',
            content: `Created item: ${itemName}`,
            createdItem: itemName
        });
    }

    private async handleStructureResult(result: any, messageId: string, context: any) {
        const blocks = result.data?.blocks || [];
        const code = result.code || '';
        const isEdit = result.data?.isEdit === true;

        if (blocks.length === 0) {
            this.send('chat_token', { messageId, text: `\n\nI couldn't generate any blocks for that structure.` });
            return;
        }

        // If this is an edit, clear old blocks first
        if (isEdit && this.lastCreatedItem?.type === 'structure' && this.lastCreatedItem.placedBlocks?.length) {
            console.log(`[FewShot] Edit mode: clearing ${this.lastCreatedItem.placedBlocks.length} old blocks`);
            this.send('chat_token', { messageId, text: `\n\nClearing the old structure...` });

            const clearResult = await this.executeClientTool('clear_blocks', {
                blocks: this.lastCreatedItem.placedBlocks
            });

            if (clearResult?.success) {
                console.log(`[FewShot] Cleared ${clearResult.cleared} old blocks`);
            } else {
                console.warn(`[FewShot] Failed to clear old blocks:`, clearResult?.error);
            }
        }

        this.send('chat_token', { messageId, text: `\n\nBuilding structure with ${blocks.length} blocks...` });

        if (code) {
            this.send('chat_code', { messageId, code, language: 'javascript', description: 'Structure generation code' });
        }

        // Place blocks in batches
        const batchSize = 100;
        let centerPos: any = null;
        for (let i = 0; i < blocks.length; i += batchSize) {
            const batch = blocks.slice(i, i + batchSize);
            const setResult = await this.executeClientTool('set_blocks', { blocks: batch });

            if (!setResult?.success) {
                this.send('chat_token', { messageId, text: `\n\nError placing blocks: ${setResult?.error}` });
                return;
            }
            if (setResult?.position) {
                centerPos = setResult.position;
            }
        }

        this.send('chat_token', { messageId, text: `\n\nStructure complete! ${blocks.length} blocks placed.` });

        // Calculate center of structure for action badge
        if (!centerPos && blocks.length > 0) {
            let sumX = 0, sumY = 0, sumZ = 0;
            for (const b of blocks) {
                sumX += b.x; sumY += b.y; sumZ += b.z;
            }
            centerPos = {
                x: Math.round(sumX / blocks.length),
                y: Math.round(sumY / blocks.length),
                z: Math.round(sumZ / blocks.length)
            };
        }

        this.send('chat_action', {
            messageId,
            action: 'build_structure',
            name: 'Structure',
            position: centerPos
        });

        // Store placed block positions for future edits
        const placedBlocks = blocks.map((b: any) => ({ x: b.x, y: b.y, z: b.z }));
        this.lastCreatedItem = { type: 'structure', name: 'Structure', code, placedBlocks };
        this.createdItems.push({ type: 'structure', name: 'Structure', turnIndex: this.conversationHistory.length });

        this.conversationHistory.push({
            role: 'assistant',
            content: `Built structure with ${blocks.length} blocks`,
        });
    }

    private async handleSpawnResult(result: any, messageId: string, context: any) {
        const { creature, count } = result.data;

        const spawnResult = await this.executeClientTool('spawn_creature', {
            type: creature,
            count: count
        });

        if (spawnResult?.success) {
            this.send('chat_token', { messageId, text: `\n\nSpawned ${count} ${creature}${count > 1 ? 's' : ''}!` });
            this.send('chat_action', {
                messageId,
                action: 'spawn_creature',
                name: creature,
                position: spawnResult.position || null
            });
        } else {
            this.send('chat_token', { messageId, text: `\n\nFailed to spawn ${creature}: ${spawnResult?.error}` });
        }
    }

    private async handleGiveResult(result: any, messageId: string) {
        const { item, count } = result.data;

        const giveResult = await this.executeClientTool('give_item', {
            item: item,
            count: count
        });

        if (giveResult?.success) {
            this.send('chat_token', { messageId, text: `\n\nGave you ${count} ${item}${count > 1 ? 's' : ''}!` });
            this.send('chat_action', { messageId, action: 'give_item', name: item });
        } else {
            this.send('chat_token', { messageId, text: `\n\nFailed to give ${item}: ${giveResult?.error}` });
        }
    }

    private async handleBlocksResult(result: any, messageId: string, context: any) {
        const blocks = result.data || [];

        if (blocks.length === 0) {
            this.send('chat_token', { messageId, text: `\n\nNo blocks to place.` });
            return;
        }

        const setResult = await this.executeClientTool('set_blocks', { blocks });

        if (setResult?.success) {
            this.send('chat_token', { messageId, text: `\n\nPlaced ${blocks.length} block${blocks.length > 1 ? 's' : ''}!` });
        } else {
            this.send('chat_token', { messageId, text: `\n\nFailed to place blocks: ${setResult?.error}` });
        }
    }
}
