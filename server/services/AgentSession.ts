/**
 * AgentSession - WebSocket handler for Claude Agent SDK-powered Merlin AI
 *
 * Replaces FewShotSession. Uses the Claude Agent SDK's query() function
 * to give Claude autonomous access to skill files and examples.
 * Claude reads the skills, generates code, and writes output to a well-known
 * file. This session then processes the output (saves to Firebase, spawns
 * creatures, places blocks, etc.).
 *
 * No custom MCP tools — Claude uses built-in Read/Write/Glob/Grep tools.
 */

import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { BaseAISession } from './BaseAISession';
import { saveCreature, updateCreature } from './DynamicCreatureService';
import { saveItem, updateItem } from './DynamicItemService';
import { StreamingCodeExtractor } from '../ai/few_shot_system';
import * as fs from 'fs';
import * as path from 'path';

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const GENERATED_DIR = path.resolve(__dirname, '../ai/generated');

// Query timeout (5 minutes max for a single agent query)
const QUERY_TIMEOUT_MS = 5 * 60 * 1000;

// ── Available Models ──
// Only Claude models since we use the Agent SDK (not OpenRouter)
const AVAILABLE_MODELS = [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'medium', description: 'Fast & powerful' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', cost: 'high', description: 'Strongest, 1M context' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', cost: 'medium', description: 'Great balance, 1M context' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', cost: 'very-low', description: 'Fast and cheap' },
];

// Map OpenRouter-style model names (e.g. "anthropic/claude-haiku-4.5") to Agent SDK names
const MODEL_ALIASES: Record<string, string> = {
    'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6',
    'anthropic/claude-opus-4-6': 'claude-opus-4-6',
    'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5',
    'anthropic/claude-haiku-4-5': 'claude-haiku-4-5',
    'anthropic/claude-haiku-4.5': 'claude-haiku-4-5',
    'anthropic/claude-sonnet-4.5': 'claude-sonnet-4-5',
    'anthropic/claude-sonnet-4.6': 'claude-sonnet-4-6',
    'anthropic/claude-opus-4.6': 'claude-opus-4-6',
};

/** Normalize model ID: strip "anthropic/" prefix, convert dots to dashes */
function normalizeModelId(modelId: string): string {
    if (MODEL_ALIASES[modelId]) return MODEL_ALIASES[modelId];
    // Strip any provider prefix like "anthropic/"
    let normalized = modelId.replace(/^[a-z]+\//, '');
    // Convert dots to dashes (claude-haiku-4.5 → claude-haiku-4-5)
    normalized = normalized.replace(/(\d+)\.(\d+)/, '$1-$2');
    return normalized;
}

// ── System Prompt ──

const MERLIN_SYSTEM_PROMPT = `You are **Merlin**, a wise and creative AI wizard inside a voxel game (like Minecraft). Players talk to you through a chat panel and ask you to create creatures, items, and structures.

## How You Work

You have access to Read, Write, Glob, and Grep tools to explore this project's codebase. The project contains **skill files** that document exactly how to create each type of game entity, and **example files** with working reference implementations.

### Creating Things — Step by Step

1. **Read the relevant skill file** (ALWAYS do this first):
   - Creatures → \`.claude/skills/implementing-creatures.md\`
   - Items → \`.claude/skills/implementing-items.md\`
   - Structures → \`.claude/skills/implementing-structures.md\`

2. **Read examples** for reference code:
   - Creatures → \`server/ai/examples/creatures.ts\`
   - Items → \`server/ai/examples/items.ts\`
   - Structures → \`server/ai/examples/structures.ts\`

3. **Generate the code** following the exact patterns from the skill files. Be creative and detailed — players love impressive visuals with lots of geometry.

4. **Write the output** to \`server/ai/generated/_output.json\` with this exact JSON format:

**For creatures:**
\`\`\`json
{
  "type": "creature",
  "name": "DragonAnimal",
  "description": "A fire-breathing dragon with animated wings",
  "code": "class DragonAnimal extends Animal {\\n  constructor(game, x, y, z, seed) {\\n    super(game, x, y, z, seed);\\n    ...\\n  }\\n  createBody() {\\n    ...\\n  }\\n}"
}
\`\`\`

**For items:**
\`\`\`json
{
  "type": "item",
  "name": "FireWandItem",
  "description": "A wand that shoots fireballs",
  "code": "class FireWandItem extends WandItem {\\n  constructor() {\\n    super('fire_wand', 'Fire Wand');\\n    ...\\n  }\\n  getMesh() {\\n    ...\\n  }\\n}",
  "icon": "<svg viewBox=\\"0 0 64 64\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"
}
\`\`\`

**For structures:**
\`\`\`json
{
  "type": "structure",
  "name": "SmallHouse",
  "description": "A cozy wooden house",
  "code": "const px = Math.floor(playerPosition.x) + 5;\\nconst py = Math.floor(playerPosition.y);\\nconst pz = Math.floor(playerPosition.z);\\nconst blocks = [];\\n// ... generate blocks ...\\nreturn blocks;"
}
\`\`\`

## Critical Rules

- **ALWAYS write \`server/ai/generated/_output.json\`** when creating something. This is how the game processes your creation. Without this file, nothing happens in the game.
- The \`code\` field must be a JSON-escaped string (newlines as \\n, quotes escaped).
- Creature class names: PascalCase, descriptive (e.g., \`GiantSpider\`, \`CrystalGolem\`)
- Item class names: MUST end with \`Item\` (e.g., \`IceSwordItem\`, \`HealingPotionItem\`)
- Structure code: receives \`playerPosition\` as the only argument, must \`return blocks\` array
- Do NOT include markdown code fences in the JSON code field — just the raw code string.

## Editing / Modifying Existing Creations

When the player says things like "make it bigger", "change the color", "add wings", etc.:
1. Read the current code from \`server/ai/generated/_output.json\` (it has the last creation)
2. Modify the code as requested
3. Write the updated \`_output.json\` with \`"isEdit": true\` added to the JSON

## Chat-Only Responses

If the player asks a question, makes conversation, or asks about game mechanics, just respond conversationally. Do NOT write \`_output.json\` for non-creation requests.

## Personality

You are Merlin — wise, enthusiastic, and a bit whimsical. You love creating things and get excited about creative requests. Keep responses concise but warm.`;

// ── AgentSession Class ──

export class AgentSession extends BaseAISession {
    protected readonly sessionName = 'Agent';

    // ── Static session registry (for HTTP verify endpoints) ──
    private static activeSessions = new Map<string, AgentSession>();
    private sessionRegistryId: string;
    private wsPath: string = '';

    /** Get a connected session that supports verification */
    static getAnySession(): AgentSession | undefined {
        for (const session of AgentSession.activeSessions.values()) {
            if (session.isConnected() && session.wsPath.includes('/api/fewshot')) return session;
        }
        for (const session of AgentSession.activeSessions.values()) {
            if (session.isConnected()) return session;
        }
        return undefined;
    }

    static getSession(id: string): AgentSession | undefined {
        return AgentSession.activeSessions.get(id);
    }

    static getAllSessions(): AgentSession[] {
        return Array.from(AgentSession.activeSessions.values()).filter(s => s.isConnected());
    }

    isConnected(): boolean {
        return this.ws.readyState === WebSocket.OPEN;
    }

    /** Send a verification request to the connected game client */
    async requestVerification(verifyType: string, args: any = {}): Promise<any> {
        return this.executeClientTool('verify', { verifyType, ...args });
    }

    // ── Agent SDK session state ──
    private agentSessionId: string | null = null;
    private abortController: AbortController | null = null;
    private isProcessing = false;  // Prevent concurrent queries

    // ── Message tracking ──
    private messageCounter = 0;

    // ── Conversation history for context continuity ──
    private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // ── Track last creation for edit/replace ──
    private lastCreation: {
        type: 'creature' | 'item' | 'structure';
        name: string;
        code?: string;
        spawnedEntityIds?: string[];
        placedBlocks?: { x: number; y: number; z: number }[];
    } | null = null;

    constructor(ws: WebSocket, req: IncomingMessage) {
        // Normalize the model from the URL query param before passing to super
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const rawModel = url.searchParams.get('model');
        const defaultModel = rawModel ? normalizeModelId(rawModel) : 'claude-sonnet-4-6';
        if (rawModel && rawModel !== defaultModel) {
            console.log(`[Agent] Normalized model: "${rawModel}" → "${defaultModel}"`);
            // Update the URL param so BaseAISession gets the correct model
            url.searchParams.set('model', defaultModel);
            (req as any).url = url.pathname + url.search;
        }
        // The Agent SDK uses its own auth (Claude CLI), so we don't need an API key env var
        super(ws, req, defaultModel, 'ANTHROPIC_API_KEY');

        this.wsPath = req.url || '';
        this.sessionRegistryId = `agent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        AgentSession.activeSessions.set(this.sessionRegistryId, this);
        console.log(`[Agent] Session registered: ${this.sessionRegistryId} (path: ${this.wsPath})`);
    }

    protected onClose(): void {
        AgentSession.activeSessions.delete(this.sessionRegistryId);
        if (this.abortController) {
            this.abortController.abort();
        }
        console.log(`[Agent] Session unregistered: ${this.sessionRegistryId}`);
    }

    protected async onInit(): Promise<void> {
        // Ensure generated directory exists
        fs.mkdirSync(GENERATED_DIR, { recursive: true });

        // Update pricing based on current model
        this.updatePricing(this.model);

        // Send available models to client
        this.send('models_list', { models: AVAILABLE_MODELS, current: this.model });

        console.log(`[Agent] Session initialized, Claude Agent SDK ready, model: ${this.model}`);
    }

    protected async handleMessage(msg: any): Promise<void> {
        switch (msg.type) {
            case 'input':
                await this.handleInput(msg.text, msg.context, msg.settings, msg.editContext);
                break;
            case 'tool_response':
                this.handleToolResponse(msg.id, msg.result, msg.error);
                break;
            case 'interrupt':
                console.log('[Agent] Interrupted by client');
                this.isInterrupted = true;
                if (this.abortController) {
                    this.abortController.abort();
                }
                break;
            case 'set_model':
                this.setModel(msg.model);
                break;
            case 'get_models':
                this.send('models_list', { models: AVAILABLE_MODELS, current: this.model });
                break;
        }
    }

    private setModel(modelId: string) {
        if (!modelId) return;

        const normalized = normalizeModelId(modelId);
        const validModel = AVAILABLE_MODELS.find(m => m.id === normalized);
        if (!validModel) {
            this.sendError(`Invalid model: ${modelId} (normalized: ${normalized})`);
            return;
        }

        this.model = normalized;
        this.updatePricing(modelId);

        // Reset session when model changes so next query uses the new model
        this.agentSessionId = null;

        console.log(`[Agent] Model changed to: ${modelId}`);
        this.send('model_changed', { model: modelId });
    }

    private generateMessageId(): string {
        return `msg_${++this.messageCounter}_${Date.now()}`;
    }

    // ── Main Input Handler ──

    private async handleInput(text: string, context: any, settings?: any, editContext?: any) {
        await this.authReady;

        // Prevent concurrent queries — this was causing the "stuck" bug
        if (this.isProcessing) {
            console.warn('[Agent] Already processing a query, ignoring new input');
            this.send('chat_error', { error: 'Still processing previous request. Please wait or click interrupt.' });
            return;
        }

        // Update context and settings
        this.updateWorldContext(context);
        this.updateSettings(settings);

        // Check auth & balance
        if (!await this.verifyTokenBalance()) return;

        this.isInterrupted = false;
        this.isProcessing = true;
        const messageId = this.generateMessageId();

        this.send('chat_start', { messageId });

        try {
            // Get player context from the browser client
            const playerCtx = await this.executeClientTool('verify', { verifyType: 'player' });

            // Build the prompt with player context
            let prompt = text;
            if (playerCtx && !playerCtx.error) {
                const pos = playerCtx.position;
                const dir = playerCtx.direction;
                prompt = `[Player Context] Position: (${pos.x}, ${pos.y}, ${pos.z})`;
                if (dir) {
                    prompt += `, Looking: (${dir.x}, ${dir.y}, ${dir.z})`;
                }
                prompt += `\n\n${text}`;
            }

            // If this is a follow-up, include conversation history for context
            // (instead of relying on Agent SDK resume, which can hang/fail)
            if (this.conversationHistory.length > 0) {
                const historyStr = this.conversationHistory
                    .slice(-6) // Last 3 exchanges
                    .map(h => `${h.role === 'user' ? 'Player' : 'Merlin'}: ${h.content.substring(0, 500)}`)
                    .join('\n\n');
                prompt = `[Previous Conversation]\n${historyStr}\n\n[Current Request]\n${prompt}`;
            }

            // If edit mode, enhance the prompt
            if (editContext?.isEdit && this.lastCreation) {
                prompt = `[EDIT MODE] The player wants to modify the existing ${this.lastCreation.type} "${this.lastCreation.name}".\nThe current code is in server/ai/generated/_output.json.\n\nTheir request: ${text}\n\nRead the current _output.json to see the existing code, modify it as requested, and write the updated version with "isEdit": true.`;
            } else if (this.lastCreation) {
                // Even without explicit edit mode, include last creation context
                prompt += `\n\n[Last Creation] You previously created a ${this.lastCreation.type} called "${this.lastCreation.name}". If the player refers to "it" or wants changes, modify the existing creation.`;
            }

            // Clean up old output file
            const outputPath = path.join(GENERATED_DIR, '_output.json');
            try {
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } catch (e) {
                // Ignore cleanup errors
            }

            // Create abort controller for this request
            this.abortController = new AbortController();

            // Run the Agent SDK query — always start fresh (no resume)
            // Resume was causing hangs when the subprocess from a previous query had exited
            console.log(`[Agent] Starting query: "${text.substring(0, 80)}..."`);
            console.log(`[Agent] Model: ${this.model}`);

            // Build a clean env without Claude Code markers to avoid "cannot launch inside another session" error
            const CLAUDE_ENV_BLOCKLIST = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION'];
            const cleanEnv: Record<string, string> = {};
            for (const [key, value] of Object.entries(process.env)) {
                if (!CLAUDE_ENV_BLOCKLIST.includes(key) && value !== undefined) {
                    cleanEnv[key] = value;
                }
            }
            // Debug: log blocked env vars (only if any were found)
            const blocked = CLAUDE_ENV_BLOCKLIST.filter(k => process.env[k]);
            if (blocked.length > 0) {
                console.log(`[Agent] Env cleanup: blocked ${blocked.length} Claude Code env vars`);
            }

            // Set up a timeout to abort the query if it takes too long
            const timeoutId = setTimeout(() => {
                console.warn(`[Agent] Query timed out after ${QUERY_TIMEOUT_MS / 1000}s, aborting`);
                if (this.abortController) {
                    this.abortController.abort();
                }
            }, QUERY_TIMEOUT_MS);

            const q = query({
                prompt,
                options: {
                    cwd: PROJECT_ROOT,
                    systemPrompt: MERLIN_SYSTEM_PROMPT,
                    allowedTools: ['Read', 'Write', 'Glob', 'Grep'],
                    model: this.model as any,
                    // Don't use resume — it causes hangs when the previous subprocess has exited.
                    // Instead, we pass conversation history in the prompt.
                    includePartialMessages: true,
                    maxTurns: 15,
                    permissionMode: 'bypassPermissions',
                    allowDangerouslySkipPermissions: true,
                    abortController: this.abortController,
                    env: cleanEnv,
                    stderr: (data: string) => {
                        // Only log actual errors, not status noise
                        if (data.includes('Error') || data.includes('error') || data.includes('WARN')) {
                            console.error(`[Agent:stderr] ${data.trimEnd()}`);
                        }
                    },
                }
            });

            // Token tracking: deduplicate by message ID per the Agent SDK docs
            // "All messages with the same id field report identical usage"
            // "You should only charge users once per step"
            const processedMessageIds = new Set<string>();
            let totalInputTokens = 0;
            let totalOutputTokens = 0;
            let totalCacheReadTokens = 0;
            let totalCacheCreationTokens = 0;
            let authoritativeCostUSD: number | null = null;  // From result.usage.total_cost_usd
            let fullAssistantText = '';

            // Streaming code extraction: intercept Write tool content for _output.json
            const codeExtractor = new StreamingCodeExtractor();
            let writeToolAccumContent = '';  // Accumulated content arg for the active Write tool call
            let activeWriteToolUseId: string | null = null;  // The tool_use_id of the Write call we're tracking

            for await (const message of q) {
                if (this.isInterrupted) {
                    console.log('[Agent] Query interrupted');
                    break;
                }

                // Debug: log message types (exclude noisy token events)
                if (message.type !== 'stream_event') {
                    console.log(`[Agent:debug] Message type: ${message.type}`);
                } else {
                    const se = message as any;
                    const evType = se.event?.type;
                    const deltaType = se.event?.delta?.type;
                    if (evType !== 'content_block_delta' || (deltaType !== 'text_delta' && deltaType !== 'input_json_delta')) {
                        console.log(`[Agent:debug] stream_event: ${evType}, parent=${se.parent_tool_use_id}, delta=${deltaType || 'n/a'}, block=${se.event?.content_block?.type || 'n/a'}, name=${se.event?.content_block?.name || 'n/a'}`);
                    }
                }

                // Stream text tokens to the browser and intercept Write tool for code streaming
                if (message.type === 'stream_event') {
                    const streamMsg = message as any;
                    const event = streamMsg.event;
                    const parentToolId = streamMsg.parent_tool_use_id;

                    // Main-agent text streaming (no parent tool = top-level assistant text)
                    if (parentToolId === null || parentToolId === undefined) {
                        if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
                            const tokenText = event.delta.text;
                            this.send('chat_token', { messageId, text: tokenText });
                            fullAssistantText += tokenText;
                        }

                        // Detect Write tool call start — look for tool_use content_block_start
                        if (event?.type === 'content_block_start' && event?.content_block?.type === 'tool_use') {
                            const toolName = event.content_block.name;
                            console.log(`[Agent] Tool use start: ${toolName} (id: ${event.content_block.id})`);
                            if (toolName === 'Write') {
                                activeWriteToolUseId = event.content_block.id || null;
                                writeToolAccumContent = '';
                                console.log(`[Agent] Tracking Write tool for code streaming`);
                            }
                        }

                        // Accumulate Write tool input_json_delta
                        if (event?.type === 'content_block_delta' && event?.delta?.type === 'input_json_delta' && activeWriteToolUseId) {
                            const jsonChunk = event.delta.partial_json || '';
                            writeToolAccumContent += jsonChunk;

                            // Try extracting code from the accumulated JSON content
                            // The Write tool's content parameter contains the _output.json,
                            // which has a "code" field inside it
                            if (!codeExtractor.isComplete()) {
                                const newCode = codeExtractor.extractNewCode(writeToolAccumContent);
                                if (newCode && !this.isInterrupted) {
                                    this.send('chat_code_token', { messageId, code: newCode });
                                }
                            }
                        }

                        // Reset on content_block_stop for the Write tool
                        if (event?.type === 'content_block_stop' && activeWriteToolUseId) {
                            console.log(`[Agent] Write tool content_block_stop. Accumulated ${writeToolAccumContent.length} chars. Extractor started=${codeExtractor.hasStarted()}, complete=${codeExtractor.isComplete()}`);
                            activeWriteToolUseId = null;
                        }
                    }

                    // Also check tool use events from subtools (parent_tool_use_id set)
                    // The Agent SDK wraps built-in tools and the Write call may come as a subtool
                    if (parentToolId) {
                        if (event?.type === 'content_block_start' && event?.content_block?.type === 'tool_use') {
                            const toolName = event.content_block.name;
                            console.log(`[Agent] Subtool use start: ${toolName} (parent: ${parentToolId})`);
                            if (toolName === 'Write' || toolName === 'write') {
                                activeWriteToolUseId = event.content_block.id || parentToolId;
                                writeToolAccumContent = '';
                                console.log(`[Agent] Tracking subtool Write for code streaming`);
                            }
                        }

                        if (event?.type === 'content_block_delta' && event?.delta?.type === 'input_json_delta' && activeWriteToolUseId) {
                            const jsonChunk = event.delta.partial_json || '';
                            writeToolAccumContent += jsonChunk;

                            if (!codeExtractor.isComplete()) {
                                const newCode = codeExtractor.extractNewCode(writeToolAccumContent);
                                if (newCode && !this.isInterrupted) {
                                    this.send('chat_code_token', { messageId, code: newCode });
                                }
                            }
                        }

                        if (event?.type === 'content_block_stop' && activeWriteToolUseId) {
                            console.log(`[Agent] Subtool Write content_block_stop. Accumulated ${writeToolAccumContent.length} chars. Extractor started=${codeExtractor.hasStarted()}, complete=${codeExtractor.isComplete()}`);
                            activeWriteToolUseId = null;
                        }
                    }
                }

                // Accumulate token usage from assistant messages, deduplicating by message ID
                // Per SDK docs: multiple messages in the same turn share the same ID and usage
                if (message.type === 'assistant') {
                    const assistantMsg = message as any;
                    const msgId = assistantMsg.message?.id || assistantMsg.id;
                    if (msgId && !processedMessageIds.has(msgId) && assistantMsg.message?.usage) {
                        processedMessageIds.add(msgId);
                        const usage = assistantMsg.message.usage;
                        totalInputTokens += usage.input_tokens || 0;
                        totalOutputTokens += usage.output_tokens || 0;
                        totalCacheReadTokens += usage.cache_read_input_tokens || 0;
                        totalCacheCreationTokens += usage.cache_creation_input_tokens || 0;
                    }
                }

                // Capture authoritative usage from the result message
                if (message.type === 'result') {
                    const result = message as any;

                    // The result message contains authoritative cumulative usage
                    if (result.usage?.total_cost_usd !== undefined) {
                        authoritativeCostUSD = result.usage.total_cost_usd;
                    }

                    // Use modelUsage if available (per-model breakdown, most accurate)
                    if (result.modelUsage) {
                        let modelTotalInput = 0, modelTotalOutput = 0;
                        let modelTotalCacheRead = 0, modelTotalCacheCreation = 0;
                        let modelTotalCostUSD = 0;
                        for (const [modelName, usage] of Object.entries(result.modelUsage)) {
                            const mu = usage as any;
                            modelTotalInput += mu.inputTokens || 0;
                            modelTotalOutput += mu.outputTokens || 0;
                            modelTotalCacheRead += mu.cacheReadInputTokens || 0;
                            modelTotalCacheCreation += mu.cacheCreationInputTokens || 0;
                            modelTotalCostUSD += mu.costUSD || 0;
                            console.log(`[Agent] modelUsage[${modelName}]: ${mu.inputTokens || 0} in / ${mu.outputTokens || 0} out, cache: ${mu.cacheReadInputTokens || 0} read / ${mu.cacheCreationInputTokens || 0} create, $${(mu.costUSD || 0).toFixed(6)}`);
                        }
                        // Prefer modelUsage totals as they are the most accurate
                        totalInputTokens = modelTotalInput;
                        totalOutputTokens = modelTotalOutput;
                        totalCacheReadTokens = modelTotalCacheRead;
                        totalCacheCreationTokens = modelTotalCacheCreation;
                        if (modelTotalCostUSD > 0) {
                            authoritativeCostUSD = modelTotalCostUSD;
                        }
                    }

                    console.log(`[Agent] Query complete: ${totalInputTokens} in / ${totalOutputTokens} out, cache: ${totalCacheReadTokens} read / ${totalCacheCreationTokens} create, turns: ${result.num_turns || '?'}, authCost: ${authoritativeCostUSD !== null ? '$' + authoritativeCostUSD.toFixed(6) : 'N/A'}`);
                }
            }

            clearTimeout(timeoutId);

            // Save conversation history for context in follow-up messages
            this.conversationHistory.push({ role: 'user', content: text });
            if (fullAssistantText) {
                this.conversationHistory.push({ role: 'assistant', content: fullAssistantText });
            }
            // Keep history bounded
            if (this.conversationHistory.length > 10) {
                this.conversationHistory = this.conversationHistory.slice(-10);
            }

            // Process any generated output (creature/item/structure)
            await this.processOutput(messageId, context);

            // Send cost info
            if (totalInputTokens > 0 || totalOutputTokens > 0) {
                const costInfo = this.calculateCost(totalInputTokens, totalOutputTokens, totalCacheReadTokens);

                // Use the authoritative cost from the SDK if available (more accurate than our manual calc)
                const finalCostUSD = authoritativeCostUSD !== null ? authoritativeCostUSD : costInfo.totalCostUSD;
                const gameTokens = authoritativeCostUSD !== null
                    ? Math.max(1, Math.ceil((authoritativeCostUSD * this.OVERHEAD_MULTIPLIER) / this.USD_PER_GAME_TOKEN))
                    : costInfo.gameTokens;

                this.send('chat_cost', {
                    messageId,
                    inputTokens: costInfo.inputTokens,
                    outputTokens: costInfo.outputTokens,
                    cachedTokens: totalCacheReadTokens,
                    cacheCreationTokens: totalCacheCreationTokens,
                    inputCostUSD: costInfo.inputCostUSD,
                    outputCostUSD: costInfo.outputCostUSD,
                    totalCostUSD: finalCostUSD,
                    model: this.model
                });
                console.log(`[Agent] Cost: $${finalCostUSD.toFixed(6)} (${costInfo.inputTokens} in / ${costInfo.outputTokens} out, ${totalCacheReadTokens} cache-read, ${totalCacheCreationTokens} cache-create)${authoritativeCostUSD !== null ? ' [authoritative]' : ' [estimated]'}`);
                await this.deductTokens(gameTokens, 'Agent Generation');
            }

            this.send('chat_end', { messageId });

        } catch (e: any) {
            console.error('[Agent] Error:', e.message);
            if (e.exitCode !== undefined) {
                console.error(`[Agent] Process exit code: ${e.exitCode}`);
            }
            if (e.stderr) {
                console.error(`[Agent] stderr: ${e.stderr}`);
            }

            // If resume caused the error, reset session ID so next attempt starts fresh
            this.agentSessionId = null;

            this.send('chat_error', { messageId, error: e.message });
            this.send('chat_end', { messageId });
        } finally {
            this.isProcessing = false;
            this.abortController = null;
        }
    }

    // ── Output Processing ──

    private async processOutput(messageId: string, context: any) {
        const outputPath = path.join(GENERATED_DIR, '_output.json');

        if (!fs.existsSync(outputPath)) {
            console.log('[Agent] No _output.json found — chat-only response');
            return;
        }

        try {
            const raw = fs.readFileSync(outputPath, 'utf-8');
            const output = JSON.parse(raw);
            console.log(`[Agent] Processing output: type=${output.type}, name="${output.name}"`);

            switch (output.type) {
                case 'creature':
                    await this.processCreature(output, messageId);
                    break;
                case 'item':
                    await this.processItem(output, messageId);
                    break;
                case 'structure':
                    await this.processStructure(output, messageId, context);
                    break;
                default:
                    console.warn(`[Agent] Unknown output type: ${output.type}`);
            }
        } catch (e: any) {
            console.error('[Agent] Error processing _output.json:', e);
            this.send('chat_token', { messageId, text: `\n\nError processing the creation: ${e.message}` });
        }
    }

    // ── Creature Processing ──

    private async processCreature(output: any, messageId: string) {
        const { name, code, description, isEdit } = output;

        // Send code block to the UI
        this.send('chat_code', { messageId, code, language: 'javascript', description: `${name} creature code` });

        // If editing, despawn old creatures first
        if (isEdit && this.lastCreation?.type === 'creature' && this.lastCreation.spawnedEntityIds?.length) {
            console.log(`[Agent] Edit mode: despawning ${this.lastCreation.spawnedEntityIds.length} old ${this.lastCreation.name} entities`);
            this.send('chat_token', { messageId, text: `\n\nRemoving the old ${this.lastCreation.name}...` });
            const despawnResult = await this.executeClientTool('despawn_creatures', {
                entityIds: this.lastCreation.spawnedEntityIds
            });
            if (despawnResult?.success) {
                console.log(`[Agent] Despawned ${despawnResult.removed} old entities`);
            }
        }

        // Save to Firebase
        let saveResult;
        const creatureName = isEdit ? (this.lastCreation?.name || name) : name;

        if (isEdit && this.lastCreation?.name) {
            saveResult = await updateCreature(this.lastCreation.name, {
                code,
                description: description || 'AI-modified creature'
            }, this.currentWorldId);

            if (saveResult.success) {
                this.send('chat_token', { messageId, text: `\n\nUpdated **${creatureName}**! Spawning the new version...` });
            } else {
                this.send('chat_token', { messageId, text: `\n\nError updating creature: ${saveResult.error}` });
                return;
            }
        } else {
            saveResult = await saveCreature({
                name: creatureName,
                code,
                description: description || 'AI-generated creature',
                createdBy: this.userId || 'anonymous',
                createdAt: Date.now()
            }, this.currentWorldId);

            if (saveResult.success) {
                this.send('chat_token', { messageId, text: `\n\nCreated **${creatureName}**! Spawning it now...` });
            } else if (saveResult.error?.includes('already exists')) {
                this.send('chat_token', { messageId, text: `\n\n**${creatureName}** already exists. Spawning one for you...` });
            } else {
                this.send('chat_token', { messageId, text: `\n\nError saving creature: ${saveResult.error}` });
                return;
            }
        }

        // Spawn the creature via client tool
        const spawnResult = await this.executeClientTool('spawn_creature', {
            type: creatureName,
            count: 1
        });

        if (spawnResult?.success) {
            const pos = spawnResult.position;
            const posStr = pos ? ` at (${pos.x}, ${pos.y}, ${pos.z})` : '';
            this.send('chat_token', { messageId, text: `\n\n${creatureName} has been spawned${posStr}!` });
            this.send('chat_action', {
                messageId,
                action: 'spawn_creature',
                name: creatureName,
                position: pos || null
            });

            this.lastCreation = {
                type: 'creature',
                name: creatureName,
                code,
                spawnedEntityIds: spawnResult.spawned || []
            };
        } else {
            this.send('chat_token', { messageId, text: `\n\nCouldn't spawn the creature: ${spawnResult?.error}` });
            this.lastCreation = { type: 'creature', name: creatureName, code };
        }
    }

    // ── Item Processing ──

    private async processItem(output: any, messageId: string) {
        const { name, code, icon, description, isEdit } = output;

        // Send code block to UI
        this.send('chat_code', { messageId, code, language: 'javascript', description: `${name} item code` });

        // Extract item ID from super() call
        const itemIdMatch = code.match(/super\s*\(\s*['"]([^'"]+)['"]/);
        const itemId = itemIdMatch
            ? itemIdMatch[1]
            : name.replace(/Item$/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

        const itemName = isEdit ? (this.lastCreation?.name || name) : name;

        let saveResult;
        if (isEdit && this.lastCreation?.type === 'item') {
            saveResult = await updateItem(this.lastCreation.name, {
                code,
                icon: icon || '',
                description: description || 'AI-modified item'
            }, this.currentWorldId);
        } else {
            saveResult = await saveItem({
                name: itemName,
                code,
                icon: icon || '',
                description: description || 'AI-generated item'
            }, this.currentWorldId);
        }

        if (saveResult.success) {
            this.send('chat_token', { messageId, text: `\n\n${isEdit ? 'Updated' : 'Created'} **${itemName}**!` });

            const giveResult = await this.executeClientTool('give_item', { item: itemId, count: 1 });
            if (giveResult?.success) {
                this.send('chat_token', { messageId, text: ` Added to your inventory!` });
                this.send('chat_action', { messageId, action: 'give_item', name: itemName });
            }
        } else {
            this.send('chat_token', { messageId, text: `\n\nError saving item: ${saveResult.error}` });
        }

        this.lastCreation = { type: 'item', name: itemName, code };
    }

    // ── Structure Processing ──

    private async processStructure(output: any, messageId: string, context: any) {
        const { code, name, description, isEdit } = output;

        // Send code block to UI
        this.send('chat_code', { messageId, code, language: 'javascript', description: 'Structure generation code' });

        // If editing, clear old blocks first
        if (isEdit && this.lastCreation?.type === 'structure' && this.lastCreation.placedBlocks?.length) {
            console.log(`[Agent] Edit mode: clearing ${this.lastCreation.placedBlocks.length} old blocks`);
            this.send('chat_token', { messageId, text: `\n\nClearing the old structure...` });
            await this.executeClientTool('clear_blocks', {
                blocks: this.lastCreation.placedBlocks
            });
        }

        // Determine player/target position for structure placement
        const playerPosition = context?.position || (context?.x !== undefined
            ? { x: context.x, y: context.y, z: context.z }
            : { x: 0, y: 64, z: 0 });

        const targetPosition = context?.targetX !== undefined
            ? { x: context.targetX, y: context.targetGroundY || context.targetY || playerPosition.y, z: context.targetZ }
            : playerPosition;

        // Execute structure code to get blocks array
        let blocks: any[];
        try {
            const structureFn = new Function('playerPosition', code);
            blocks = structureFn(targetPosition);
        } catch (e: any) {
            console.error('[Agent] Structure code execution error:', e);
            this.send('chat_token', { messageId, text: `\n\nError executing structure code: ${e.message}` });
            return;
        }

        if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
            this.send('chat_token', { messageId, text: `\n\nNo blocks were generated.` });
            return;
        }

        this.send('chat_token', { messageId, text: `\n\nBuilding with ${blocks.length} blocks...` });

        // Place blocks in batches of 100
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

        // Calculate center if not provided
        if (!centerPos && blocks.length > 0) {
            let sumX = 0, sumY = 0, sumZ = 0;
            for (const b of blocks) { sumX += b.x; sumY += b.y; sumZ += b.z; }
            centerPos = {
                x: Math.round(sumX / blocks.length),
                y: Math.round(sumY / blocks.length),
                z: Math.round(sumZ / blocks.length)
            };
        }

        this.send('chat_token', { messageId, text: `\n\nStructure complete! ${blocks.length} blocks placed.` });
        this.send('chat_action', {
            messageId,
            action: 'build_structure',
            name: name || 'Structure',
            position: centerPos
        });

        // Track placed blocks for future edits
        this.lastCreation = {
            type: 'structure',
            name: name || 'Structure',
            code,
            placedBlocks: blocks.map((b: any) => ({ x: b.x, y: b.y, z: b.z }))
        };
    }
}
