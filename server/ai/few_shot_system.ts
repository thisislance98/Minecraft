/**
 * Few-Shot AI System
 * Main handler for the few-shot example-based AI approach
 *
 * Routing is handled by the UI category buttons.
 * For "custom" category, semantic similarity against all example pools picks the best category.
 * Each handler uses tool calling for structured output with fallback text extraction.
 */

import {
    getCreaturePrompt,
    getItemPrompt,
    getStructurePrompt,
    getChatPrompt
} from './few_shot_prompts';
import { getCreatureTools, getItemTools, getStructureTools } from './few_shot_tools';
import { unifiedExampleIndex, UnifiedExample } from './examples/UnifiedExampleIndex';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Available models - Latest from OpenRouter API (July 2025)
export const availableModels = [
    // Claude (Anthropic) - Latest 2025
    { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', cost: 'high', description: 'Strongest, 1M context' },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', cost: 'medium', description: 'Best balance, 1M context' },
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', cost: 'medium', description: 'Fast & powerful' },
    { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', cost: 'very-low', description: 'Fast and cheap' },

    // GPT (OpenAI) - Latest 2025
    { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro', cost: 'high', description: 'Most advanced GPT' },
    { id: 'openai/gpt-5.2-codex', name: 'GPT-5.2 Codex', cost: 'medium', description: 'Optimized for coding' },
    { id: 'openai/gpt-5.1', name: 'GPT-5.1', cost: 'medium', description: 'Frontier model, 400K ctx' },
    { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', cost: 'low', description: 'Fast and affordable' },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', cost: 'very-low', description: 'Budget GPT, 1M context' },

    // Gemini (Google) - Latest 2025
    { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', cost: 'medium', description: 'Google flagship' },
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', cost: 'low', description: 'Fast Google model' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'very-low', description: 'Budget, 1M context' },

    // Budget options
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', cost: 'very-low', description: 'Very cheap, good coding' },
];

interface FewShotConfig {
    apiKey: string;
    model?: string;
    siteUrl?: string;
    siteName?: string;
}

interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdItem?: string;
}

interface LastCreatedItem {
    type: 'creature' | 'item' | 'structure';
    name: string;
    code?: string;
}

interface FewShotContext {
    playerPosition?: { x: number; y: number; z: number };
    targetPosition?: { x: number; y: number; z: number };
    playerDirection?: { x: number; z: number };
    worldName?: string;
    userId?: string;
    conversationHistory?: ConversationMessage[];
    lastCreatedItem?: LastCreatedItem | null;
    editContext?: any;
}

interface FewShotResult {
    success: boolean;
    type: 'creature' | 'item' | 'structure' | 'spawn' | 'give' | 'blocks' | 'chat' | 'error';
    data?: any;
    message?: string;
    code?: string;
    icon?: string;
    error?: string;
    usage?: TokenUsage;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
}

export type OnTokenCallback = (text: string) => void;
export type OnCodeTokenCallback = (code: string) => void;

/**
 * StreamingCodeExtractor — incrementally extracts the "code" field value
 * from accumulated tool-call argument JSON as it streams in.
 *
 * State machine:
 *  1. Scan accumulated args for the pattern `"code":"` (or `"code" : "`)
 *  2. Once found, track lastEmitIndex and process new chars:
 *     - Regular char → emit
 *     - `\` + next → unescape JSON string encoding (\n, \t, \\, \", etc.)
 *     - `\` at buffer end → hold back (incomplete escape)
 *     - Unescaped `"` → code value complete, stop
 */
export class StreamingCodeExtractor {
    private codeStarted = false;
    private codeComplete = false;
    private codeFieldIndex = -1; // index of the opening quote of the code value
    private lastEmitIndex = 0;   // how far we've processed into the code value
    private pendingBackslash = false;

    /**
     * Call this each time the accumulated tool args string grows.
     * Returns newly decoded code characters (empty string if none).
     */
    extractNewCode(accumulatedArgs: string): string {
        if (this.codeComplete) return '';

        // Phase 1: Find the start of the "code" field value
        if (!this.codeStarted) {
            // Look for "code" : " pattern (with optional whitespace)
            const pattern = /"code"\s*:\s*"/;
            const match = accumulatedArgs.match(pattern);
            if (!match || match.index === undefined) return '';

            // Mark the index right after the opening quote of the value
            this.codeFieldIndex = match.index + match[0].length;
            this.codeStarted = true;
            this.lastEmitIndex = 0;
        }

        // Phase 2: Process characters from where we left off
        const valueStr = accumulatedArgs.slice(this.codeFieldIndex);
        let result = '';
        let i = this.lastEmitIndex;

        while (i < valueStr.length) {
            const ch = valueStr[i];

            if (this.pendingBackslash) {
                // We had a backslash from the previous call
                this.pendingBackslash = false;
                result += this.unescapeChar(ch);
                i++;
                continue;
            }

            if (ch === '\\') {
                // Check if there's a next character
                if (i + 1 < valueStr.length) {
                    const next = valueStr[i + 1];
                    result += this.unescapeChar(next);
                    i += 2;
                } else {
                    // Backslash at end of buffer — hold back
                    this.pendingBackslash = true;
                    i++;
                    break;
                }
                continue;
            }

            if (ch === '"') {
                // Unescaped quote → code value is complete
                this.codeComplete = true;
                break;
            }

            result += ch;
            i++;
        }

        this.lastEmitIndex = i;
        return result;
    }

    private unescapeChar(ch: string): string {
        switch (ch) {
            case 'n': return '\n';
            case 't': return '\t';
            case 'r': return '\r';
            case '\\': return '\\';
            case '"': return '"';
            case '/': return '/';
            case 'b': return '\b';
            case 'f': return '\f';
            default: return '\\' + ch; // Unknown escape, preserve as-is
        }
    }

    isComplete(): boolean {
        return this.codeComplete;
    }

    hasStarted(): boolean {
        return this.codeStarted;
    }
}

export class FewShotAI {
    private config: FewShotConfig;
    private model: string;

    // Track accumulated token usage across multiple API calls
    private accumulatedUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };

    constructor(config: FewShotConfig) {
        this.config = config;
        this.model = config.model || 'anthropic/claude-haiku-4.5';
    }

    setModel(modelId: string) {
        this.model = modelId;
        console.log(`[FewShotAI] Model set to: ${modelId}`);
    }

    getModel(): string {
        return this.model;
    }

    resetUsage(): void {
        this.accumulatedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };
    }

    getAccumulatedUsage(): TokenUsage {
        return { ...this.accumulatedUsage };
    }

    /**
     * Check if current model is an Anthropic Claude model (supports cache_control)
     */
    private isAnthropicModel(): boolean {
        return this.model.startsWith('anthropic/');
    }

    /**
     * Format the system message with cache_control for Anthropic models.
     * For Anthropic models via OpenRouter, the system prompt is sent as a
     * content-block array with cache_control on the last block to enable
     * prompt caching (system prompt + skill files + examples stay warm).
     * Non-Anthropic models get a plain string (unchanged behavior).
     */
    private formatSystemMessage(systemPrompt: string): { role: string; content: string | any[] } {
        if (this.isAnthropicModel()) {
            return {
                role: 'system',
                content: [
                    {
                        type: 'text',
                        text: systemPrompt,
                        cache_control: { type: 'ephemeral' }
                    }
                ]
            };
        }
        return { role: 'system', content: systemPrompt };
    }

    /**
     * Accumulate token usage from an API response, including cache metrics
     */
    private accumulateUsage(usage: any, label: string = '') {
        if (!usage) return;

        // Debug: log raw usage object to see what OpenRouter returns
        console.log(`[FewShotAI] Raw usage object:`, JSON.stringify(usage));

        this.accumulatedUsage.promptTokens += usage.prompt_tokens || 0;
        this.accumulatedUsage.completionTokens += usage.completion_tokens || 0;
        this.accumulatedUsage.totalTokens += usage.total_tokens || 0;

        // Track cache tokens — OpenRouter may use different field names:
        // Anthropic native: cache_read_input_tokens / cache_creation_input_tokens
        // OpenAI compat: prompt_tokens_details.cached_tokens
        const cacheRead = usage.cache_read_input_tokens
            || usage.prompt_tokens_details?.cached_tokens
            || usage.native_tokens_prompt_cache_read
            || 0;
        const cacheCreation = usage.cache_creation_input_tokens
            || usage.native_tokens_prompt_cache_write
            || 0;
        this.accumulatedUsage.cachedTokens += cacheRead;

        const prefix = label ? `[FewShotAI] ${label}` : '[FewShotAI]';
        const cacheInfo = cacheRead > 0 || cacheCreation > 0
            ? ` (cache read: ${cacheRead}, cache write: ${cacheCreation})`
            : '';
        console.log(`${prefix} Token usage: ${usage.prompt_tokens} in / ${usage.completion_tokens} out${cacheInfo} (total accumulated: ${this.accumulatedUsage.totalTokens})`);
    }

    // ============================================================
    // CATEGORY RESOLUTION
    // ============================================================

    /**
     * Resolve the final category.
     * - creature / item / build / fix → pass through directly
     * - custom → use unified example index semantic similarity to pick the best category
     * - chat detection for greetings / help
     */
    async resolveCategory(category: string, text: string, lastCreatedItem?: LastCreatedItem | null): Promise<string> {
        // Direct categories from the UI pass through
        if (category === 'creature' || category === 'item' || category === 'build' || category === 'fix') {
            return category;
        }

        // For "custom" (or missing category), use semantic similarity
        console.log(`[FewShotAI] Resolving custom category via unified index for: "${text}"`);

        // Quick chat detection for very short greetings/help
        const lower = text.toLowerCase().trim();
        const chatPatterns = /^(hi|hello|hey|help|what can you do|how does this work|thanks|thank you)\b/;
        if (chatPatterns.test(lower)) {
            console.log(`[FewShotAI] Resolved to: chat (greeting/help pattern)`);
            return 'chat';
        }

        // Edit detection: if there's a lastCreatedItem and the message looks like
        // a modification request (short, referential), route to the same category
        if (lastCreatedItem) {
            const editPatterns = /^(make (it|the|them)|change (it|the|its|their)|add |remove |give (it|the|them)|bigger|smaller|taller|shorter|faster|slower|more |less |different |another color|red|blue|green|yellow|pink|purple|orange|white|black|now make|update|modify|edit|fix|improve|enhance|also )/i;
            const isReferential = editPatterns.test(lower) ||
                (lower.length < 60 && !lower.includes('create') && !lower.includes('build') && !lower.includes('spawn') && !lower.includes('craft') &&
                 (lower.includes('it') || lower.includes('the ') || lower.includes('its ') || lower.includes('more') || lower.includes('less')));

            if (isReferential) {
                const mappedCategory = lastCreatedItem.type === 'structure' ? 'build' : lastCreatedItem.type;
                console.log(`[FewShotAI] Edit detected: "${text}" refers to last created ${lastCreatedItem.type} "${lastCreatedItem.name}" → routing to ${mappedCategory}`);
                return mappedCategory;
            }
        }

        try {
            const resolved = await unifiedExampleIndex.resolveCategory(text);

            // Map unified category names to the handler names
            if (resolved === 'structure') {
                console.log(`[FewShotAI] Resolved to: build (via unified index)`);
                return 'build';
            }
            console.log(`[FewShotAI] Resolved to: ${resolved} (via unified index)`);
            return resolved;

        } catch (err: any) {
            console.error(`[FewShotAI] Semantic resolution failed, defaulting to creature:`, err.message);
            return 'creature';
        }
    }

    // ============================================================
    // MAIN ENTRY POINT
    // ============================================================

    /**
     * Main entry point — process a user request.
     * Category comes from the UI; for "custom" it is resolved via semantic similarity.
     */
    async processRequest(userMessage: string, context: FewShotContext, category: string = 'custom', onToken?: OnTokenCallback, onCodeToken?: OnCodeTokenCallback): Promise<FewShotResult> {
        console.log(`[FewShotAI] Processing: "${userMessage}" | category=${category} | model=${this.model} | streaming=${!!onToken}`);

        this.resetUsage();

        try {
            // Resolve category (pass-through for explicit, semantic for custom)
            // Pass lastCreatedItem so edit-detection can route to the correct handler
            const resolved = await this.resolveCategory(category, userMessage, context.lastCreatedItem);
            console.log(`[FewShotAI] Resolved category: ${resolved}`);

            // Map handler category to unified index category for example search
            const exampleCategory = resolved === 'build' ? 'structure' : resolved as 'creature' | 'item' | 'structure';

            // Fetch relevant examples from unified index (skip for chat)
            let examples: UnifiedExample[] = [];
            if (resolved !== 'chat') {
                examples = await unifiedExampleIndex.search(userMessage, {
                    category: exampleCategory,
                    topK: 3,
                    maxTotalChars: 15000
                });
            }

            let result: FewShotResult;

            switch (resolved) {
                case 'creature':
                    result = await this.handleCreateCreature(userMessage, context, examples, onToken, onCodeToken);
                    break;
                case 'item':
                    result = await this.handleCreateItem(userMessage, context, examples, onToken, onCodeToken);
                    break;
                case 'build':
                    result = await this.handleCreateStructure(userMessage, context, examples, onToken, onCodeToken);
                    break;
                case 'chat':
                    result = await this.handleChat(userMessage, context, onToken);
                    break;
                default:
                    // "fix" and any other unknown → treat as creature for now
                    result = await this.handleCreateCreature(userMessage, context, examples, onToken, onCodeToken);
                    break;
            }

            // Attach accumulated token usage to the result
            result.usage = this.getAccumulatedUsage();
            return result;

        } catch (error: any) {
            console.error('[FewShotAI] Error:', error);
            return {
                success: false,
                type: 'error',
                error: error.message || 'An error occurred',
                usage: this.getAccumulatedUsage()
            };
        }
    }

    // ============================================================
    // HANDLERS (one LLM call each, with tool-calling extraction)
    // ============================================================

    /**
     * Handle creature creation — uses create_creature tool for structured output
     */
    private async handleCreateCreature(description: string, context: FewShotContext, examples: UnifiedExample[] = [], onToken?: OnTokenCallback, onCodeToken?: OnCodeTokenCallback): Promise<FewShotResult> {
        // If we have a last created creature, include its code in the description
        // so the AI can decide whether this is an edit (and set isEdit=true in the tool call)
        let modifiedDescription = description;
        if (context.lastCreatedItem?.type === 'creature' && context.lastCreatedItem.code) {
            modifiedDescription = `${description}\n\n[CONTEXT] The player previously created a creature called "${context.lastCreatedItem.name}". Here is its code:\n\`\`\`javascript\n${context.lastCreatedItem.code}\n\`\`\`\nIf the player is asking to modify/change this creature, set isEdit=true in the tool call and keep the same class name "${context.lastCreatedItem.name}". If they want something entirely new, set isEdit=false or omit it.`;
        }

        const prompt = getCreaturePrompt(modifiedDescription, context, examples);

        const callFn = onToken ? this.callOpenRouterStreaming.bind(this) : this.callOpenRouter.bind(this);
        const response = await callFn(prompt, modifiedDescription, getCreatureTools(), context.conversationHistory, onToken, onCodeToken);

        // Try tool-call extraction first
        const toolResult = this.extractToolCallArgs(response, 'create_creature');
        let code: string | null = null;
        let className: string | null = null;

        let isEdit = false;

        if (toolResult) {
            code = toolResult.code || null;
            className = toolResult.className || null;
            isEdit = toolResult.isEdit === true;
            console.log(`[FewShotAI] Creature extracted via tool call: ${className}, isEdit=${isEdit}`);
        }

        // Fallback: extract from text content
        if (!code) {
            console.log('[FewShotAI] Falling back to text extraction for creature');
            code = this.extractCode(response.content);
        }

        if (!code) {
            console.error('[FewShotAI] Failed to extract creature code from response');
            return { success: false, type: 'error', error: 'Failed to generate creature code' };
        }

        if (!className) {
            className = this.extractClassName(code);
        }

        // Validate the code
        const validation = this.validateCreatureCode(code);
        if (!validation.valid) {
            console.log('[FewShotAI] Creature validation failed:', validation.errors);
            const fixedCode = this.attemptCodeFix(code, validation.errors, 'creature');
            if (fixedCode) {
                const revalidation = this.validateCreatureCode(fixedCode);
                if (revalidation.valid) {
                    return { success: true, type: 'creature', code: fixedCode, data: { className: this.extractClassName(fixedCode), isEdit } };
                }
            }
            return { success: false, type: 'error', error: `Invalid creature code: ${validation.errors.join(', ')}` };
        }

        return { success: true, type: 'creature', code, data: { className, isEdit } };
    }

    /**
     * Handle item creation — uses create_item tool for structured output
     */
    private async handleCreateItem(description: string, context: FewShotContext, examples: UnifiedExample[] = [], onToken?: OnTokenCallback, onCodeToken?: OnCodeTokenCallback): Promise<FewShotResult> {
        const prompt = getItemPrompt(description, context, examples);

        const callFn = onToken ? this.callOpenRouterStreaming.bind(this) : this.callOpenRouter.bind(this);
        const response = await callFn(prompt, description, getItemTools(), context.conversationHistory, onToken, onCodeToken);

        // Try tool-call extraction first
        const toolResult = this.extractToolCallArgs(response, 'create_item');
        let code: string | null = null;
        let icon: string | null = null;
        let className: string | null = null;

        if (toolResult) {
            code = toolResult.code || null;
            icon = toolResult.icon || null;
            className = toolResult.className || null;
            console.log(`[FewShotAI] Item extracted via tool call: ${className}`);
        }

        // Fallback: extract from text content
        if (!code && response.content) {
            console.log('[FewShotAI] Falling back to text extraction for item');
            // Try JSON parse first (old format)
            try {
                const jsonMatch = response.content.match(/\{[\s\S]*"className"[\s\S]*"code"[\s\S]*"icon"[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    code = parsed.code || null;
                    icon = parsed.icon || null;
                    className = parsed.className || null;
                }
            } catch (e) {
                // ignore
            }
            if (!code) code = this.extractCode(response.content);
            if (!icon) icon = this.extractSvg(response.content);
        }

        if (!code) {
            return { success: false, type: 'error', error: 'Failed to generate item code' };
        }

        if (!className) {
            className = this.extractClassName(code);
        }

        // Validate the code
        const validation = this.validateItemCode(code);
        if (!validation.valid) {
            console.log('[FewShotAI] Item validation failed:', validation.errors);
            const fixedCode = this.attemptCodeFix(code, validation.errors, 'item');
            if (fixedCode) {
                const revalidation = this.validateItemCode(fixedCode);
                if (revalidation.valid) {
                    code = fixedCode;
                }
            }
            if (!this.validateItemCode(code).valid) {
                return { success: false, type: 'error', error: `Invalid item code: ${validation.errors.join(', ')}` };
            }
        }

        if (!icon) {
            icon = this.generateDefaultIcon();
        }

        return { success: true, type: 'item', code, icon, data: { className } };
    }

    /**
     * Handle structure creation — uses create_structure tool for structured output
     */
    private async handleCreateStructure(description: string, context: FewShotContext, examples: UnifiedExample[] = [], onToken?: OnTokenCallback, onCodeToken?: OnCodeTokenCallback): Promise<FewShotResult> {
        // If we have a last created structure, include its code so the AI can decide if this is an edit
        let modifiedDescription = description;
        if (context.lastCreatedItem?.type === 'structure' && context.lastCreatedItem.code) {
            modifiedDescription = `${description}\n\n[CONTEXT] The player previously built a structure. Here is its code:\n\`\`\`javascript\n${context.lastCreatedItem.code}\n\`\`\`\nIf the player is asking to modify/change this structure, set isEdit=true in the tool call. If they want something entirely new, set isEdit=false or omit it.`;
        }

        const prompt = getStructurePrompt(modifiedDescription, context, examples);

        const callFn = onToken ? this.callOpenRouterStreaming.bind(this) : this.callOpenRouter.bind(this);
        const response = await callFn(prompt, modifiedDescription, getStructureTools(), context.conversationHistory, onToken, onCodeToken);

        // Try tool-call extraction first
        const toolResult = this.extractToolCallArgs(response, 'create_structure');
        let code: string | null = null;
        let isEdit = false;

        if (toolResult) {
            code = toolResult.code || null;
            isEdit = toolResult.isEdit === true;
            console.log(`[FewShotAI] Structure code extracted via tool call, isEdit=${isEdit}`);
        }

        // Fallback: extract from text content
        if (!code) {
            console.log('[FewShotAI] Falling back to text extraction for structure');
            code = this.extractCode(response.content);
        }

        if (!code) {
            return { success: false, type: 'error', error: 'Failed to generate structure code' };
        }

        // Execute the structure code to get blocks
        try {
            const blocks = this.executeStructureCode(code, context);
            return { success: true, type: 'structure', data: { blocks, isEdit }, code };
        } catch (e: any) {
            return { success: false, type: 'error', error: `Structure code error: ${e.message}` };
        }
    }

    /**
     * Handle chat / greeting — no LLM call needed for simple cases
     */
    private async handleChat(userMessage: string, context: FewShotContext, onToken?: OnTokenCallback): Promise<FewShotResult> {
        const prompt = getChatPrompt(context);

        const callFn = onToken ? this.callOpenRouterStreaming.bind(this) : this.callOpenRouter.bind(this);
        const response = await callFn(prompt, userMessage, null, context.conversationHistory, onToken);

        return { success: true, type: 'chat', message: response.content || 'Hello! I\'m Merlin. Ask me to create creatures, items, or build structures!' };
    }

    // ============================================================
    // TOOL CALL EXTRACTION
    // ============================================================

    /**
     * Extract arguments from a tool call response.
     * Returns parsed args object or null if no tool call found.
     */
    private extractToolCallArgs(response: any, expectedTool: string): any | null {
        if (!response.tool_calls || response.tool_calls.length === 0) {
            return null;
        }

        const toolCall = response.tool_calls[0];
        if (toolCall.function.name !== expectedTool) {
            console.warn(`[FewShotAI] Expected tool ${expectedTool} but got ${toolCall.function.name}`);
            // Still try to use the args
        }

        try {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            console.log(`[FewShotAI] Tool call ${toolCall.function.name} parsed successfully`);
            return args;
        } catch (parseError: any) {
            console.error('[FewShotAI] Failed to parse tool arguments:', parseError.message);
            return null;
        }
    }

    // ============================================================
    // OPENROUTER API
    // ============================================================

    /**
     * Call OpenRouter API
     */
    private async callOpenRouter(systemPrompt: string, userMessage: string, tools: any[] | null, conversationHistory?: ConversationMessage[]): Promise<any> {
        const messages: any[] = [
            this.formatSystemMessage(systemPrompt)
        ];

        // Add conversation history if provided
        if (conversationHistory && conversationHistory.length > 0) {
            for (const msg of conversationHistory) {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }

        // Add current user message
        messages.push({ role: 'user', content: userMessage });

        const body: any = {
            model: this.model,
            messages,
            temperature: 0.7,
            max_tokens: 20000
        };

        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = 'auto';
        }

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': this.config.siteUrl || 'http://localhost:5173',
                'X-Title': this.config.siteName || 'VoxelWorld'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const data: any = await response.json();
        console.log('[FewShotAI] API Response data keys:', Object.keys(data));
        console.log('[FewShotAI] API Response choices:', data.choices?.length);
        console.log('[FewShotAI] API Response message keys:', Object.keys(data.choices?.[0]?.message || {}));

        // Accumulate token usage (including cache metrics for Anthropic models)
        this.accumulateUsage(data.usage);

        return data.choices[0].message;
    }

    /**
     * Call OpenRouter API with streaming enabled
     * Streams text tokens via onToken callback, accumulates tool call JSON silently
     * Returns same shape as non-streaming callOpenRouter
     */
    private async callOpenRouterStreaming(
        systemPrompt: string,
        userMessage: string,
        tools: any[] | null,
        conversationHistory?: ConversationMessage[],
        onToken?: OnTokenCallback,
        onCodeToken?: OnCodeTokenCallback
    ): Promise<any> {
        const messages: any[] = [
            this.formatSystemMessage(systemPrompt)
        ];

        if (conversationHistory && conversationHistory.length > 0) {
            for (const msg of conversationHistory) {
                messages.push({ role: msg.role, content: msg.content });
            }
        }

        messages.push({ role: 'user', content: userMessage });

        const body: any = {
            model: this.model,
            messages,
            temperature: 0.7,
            max_tokens: 20000,
            stream: true,
            stream_options: { include_usage: true }
        };

        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = 'auto';
        }

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': this.config.siteUrl || 'http://localhost:5173',
                'X-Title': this.config.siteName || 'VoxelWorld'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        if (!response.body) {
            throw new Error('No response body for streaming');
        }

        // Parse SSE stream
        let contentAccum = '';
        let toolCallAccum: { id?: string; type?: string; function?: { name?: string; arguments?: string } } | null = null;
        let usage: any = null;

        // Code extraction for streaming code tokens
        const codeExtractor = onCodeToken ? new StreamingCodeExtractor() : null;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const json = JSON.parse(trimmed.slice(6));

                    // Extract usage from final chunk
                    if (json.usage) {
                        usage = json.usage;
                    }

                    const choice = json.choices?.[0];
                    if (!choice) continue;

                    const delta = choice.delta;
                    if (!delta) continue;

                    // Stream text content tokens
                    if (delta.content) {
                        contentAccum += delta.content;
                        if (onToken) {
                            onToken(delta.content);
                        }
                    }

                    // Accumulate tool calls and stream code tokens
                    if (delta.tool_calls && delta.tool_calls.length > 0) {
                        const tc = delta.tool_calls[0];
                        if (!toolCallAccum) {
                            toolCallAccum = {
                                id: tc.id || '',
                                type: tc.type || 'function',
                                function: { name: tc.function?.name || '', arguments: '' }
                            };
                        }
                        if (tc.function?.name) {
                            toolCallAccum.function!.name = tc.function.name;
                        }
                        if (tc.function?.arguments) {
                            toolCallAccum.function!.arguments += tc.function.arguments;

                            // Extract streaming code tokens from the accumulated args
                            if (codeExtractor && onCodeToken && !codeExtractor.isComplete()) {
                                const newCode = codeExtractor.extractNewCode(toolCallAccum.function!.arguments!);
                                if (newCode) {
                                    onCodeToken(newCode);
                                }
                            }
                        }
                    }
                } catch (parseErr) {
                    // Skip malformed SSE lines
                    console.warn('[FewShotAI] SSE parse error:', parseErr);
                }
            }
        }

        // Accumulate token usage (including cache metrics for Anthropic models)
        this.accumulateUsage(usage, 'Streaming');

        // Build response in same shape as non-streaming
        const result: any = {
            content: contentAccum || null,
            role: 'assistant'
        };

        if (toolCallAccum) {
            result.tool_calls = [toolCallAccum];
        }

        console.log(`[FewShotAI] Streaming complete: ${contentAccum.length} chars content, tool_calls=${!!toolCallAccum}`);
        return result;
    }

    // ============================================================
    // VALIDATION METHODS
    // ============================================================

    private validateCreatureCode(code: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!code.includes('extends Animal')) {
            errors.push('Must extend Animal class');
        }
        if (!code.includes('createBody')) {
            errors.push('Must have createBody() method');
        }
        if (!code.includes('THREE.')) {
            errors.push('Must use THREE.js for mesh creation');
        }
        if (!code.includes('this.mesh.add')) {
            errors.push('Must add meshes to this.mesh');
        }

        // Check for syntax errors
        try {
            new Function('Animal', 'THREE', code);
        } catch (e: any) {
            errors.push(`Syntax error: ${e.message}`);
        }

        return { valid: errors.length === 0, errors };
    }

    private validateItemCode(code: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!code.includes('extends Item') && !code.includes('extends WandItem')) {
            errors.push('Must extend Item or WandItem class');
        }
        if (!code.includes('getMesh')) {
            errors.push('Must have getMesh() method');
        }
        if (!code.includes("super(")) {
            errors.push('Must call super() in constructor');
        }

        // Check for syntax errors
        try {
            new Function('Item', 'WandItem', 'THREE', code);
        } catch (e: any) {
            errors.push(`Syntax error: ${e.message}`);
        }

        return { valid: errors.length === 0, errors };
    }

    private attemptCodeFix(code: string, errors: string[], type: 'creature' | 'item'): string | null {
        let fixed = code;

        // Add missing getMesh for items
        if (type === 'item' && errors.includes('Must have getMesh() method')) {
            if (!fixed.includes('getMesh')) {
                const lastBrace = fixed.lastIndexOf('}');
                if (lastBrace > 0) {
                    const getMeshMethod = `
    getMesh() {
        const group = new THREE.Group();
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        group.add(new THREE.Mesh(geo, mat));
        return group;
    }
`;
                    fixed = fixed.slice(0, lastBrace) + getMeshMethod + fixed.slice(lastBrace);
                }
            }
        }

        return fixed;
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    private extractCode(content: string): string | null {
        if (!content) return null;

        // Try to extract from code blocks
        const codeBlockMatch = content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Try to find class definition directly
        const classMatch = content.match(/class\s+\w+\s+extends\s+(?:Animal|Item|WandItem)[\s\S]*?(?=\n\n|\n```|$)/);
        if (classMatch) {
            return classMatch[0].trim();
        }

        return null;
    }

    private extractSvg(content: string): string | null {
        if (!content) return null;
        const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
        return svgMatch ? svgMatch[0] : null;
    }

    private extractClassName(code: string): string {
        const match = code.match(/class\s+(\w+)/);
        return match ? match[1] : 'Unknown';
    }

    private executeStructureCode(code: string, context: FewShotContext): any[] {
        // Use targetPosition (which has correct ground level) if available, otherwise fall back to playerPosition
        const targetPosition = context.targetPosition || context.playerPosition || { x: 0, y: 64, z: 0 };

        // For backwards compatibility, the generated code uses "playerPosition" variable name
        // but we pass the targetPosition which has the correct ground level
        const playerPosition = targetPosition;

        console.log(`[FewShotAI] Executing structure code with position: x=${playerPosition.x}, y=${playerPosition.y}, z=${playerPosition.z}`);

        // Create a safe execution context
        const fn = new Function('playerPosition', `
            ${code}
        `);

        return fn(playerPosition);
    }

    private generateDefaultIcon(): string {
        return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <rect x="16" y="16" width="32" height="32" fill="#888888" rx="4"/>
            <text x="32" y="40" text-anchor="middle" fill="white" font-size="20">?</text>
        </svg>`;
    }
}
