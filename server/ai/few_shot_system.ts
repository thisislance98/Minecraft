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
    role: 'user' | 'assistant';
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
}

export class FewShotAI {
    private config: FewShotConfig;
    private model: string;

    // Track accumulated token usage across multiple API calls
    private accumulatedUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    constructor(config: FewShotConfig) {
        this.config = config;
        this.model = config.model || 'anthropic/claude-3-haiku';
    }

    setModel(modelId: string) {
        this.model = modelId;
        console.log(`[FewShotAI] Model set to: ${modelId}`);
    }

    getModel(): string {
        return this.model;
    }

    resetUsage(): void {
        this.accumulatedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }

    getAccumulatedUsage(): TokenUsage {
        return { ...this.accumulatedUsage };
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
    async resolveCategory(category: string, text: string): Promise<string> {
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
    async processRequest(userMessage: string, context: FewShotContext, category: string = 'custom'): Promise<FewShotResult> {
        console.log(`[FewShotAI] Processing: "${userMessage}" | category=${category} | model=${this.model}`);

        this.resetUsage();

        try {
            // Resolve category (pass-through for explicit, semantic for custom)
            const resolved = await this.resolveCategory(category, userMessage);
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
                    result = await this.handleCreateCreature(userMessage, context, examples);
                    break;
                case 'item':
                    result = await this.handleCreateItem(userMessage, context, examples);
                    break;
                case 'build':
                    result = await this.handleCreateStructure(userMessage, context, examples);
                    break;
                case 'chat':
                    result = await this.handleChat(userMessage, context);
                    break;
                default:
                    // "fix" and any other unknown → treat as creature for now
                    result = await this.handleCreateCreature(userMessage, context, examples);
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
    private async handleCreateCreature(description: string, context: FewShotContext, examples: UnifiedExample[] = []): Promise<FewShotResult> {
        // If we have a last created creature, include its code as reference for modifications
        let modifiedDescription = description;
        if (context.lastCreatedItem?.type === 'creature' && context.lastCreatedItem.code) {
            const modificationKeywords = ['smaller', 'bigger', 'larger', 'fix', 'change', 'modify', 'update', 'wrong', 'backward', 'weird', 'different', 'more', 'less'];
            const isModification = modificationKeywords.some(kw => description.toLowerCase().includes(kw));

            if (isModification) {
                modifiedDescription = `Modify the existing ${context.lastCreatedItem.name} creature. The user wants: ${description}\n\nHere is the original code to modify:\n\`\`\`javascript\n${context.lastCreatedItem.code}\n\`\`\`\n\nCreate a new version that addresses the feedback while keeping the same class name (${context.lastCreatedItem.name}).`;
                console.log('[FewShotAI] Detected modification request for:', context.lastCreatedItem.name);
            }
        }

        const prompt = getCreaturePrompt(modifiedDescription, context, examples);

        const response = await this.callOpenRouter(prompt, modifiedDescription, getCreatureTools(), context.conversationHistory);

        // Try tool-call extraction first
        const toolResult = this.extractToolCallArgs(response, 'create_creature');
        let code: string | null = null;
        let className: string | null = null;

        if (toolResult) {
            code = toolResult.code || null;
            className = toolResult.className || null;
            console.log(`[FewShotAI] Creature extracted via tool call: ${className}`);
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
                    return { success: true, type: 'creature', code: fixedCode, data: { className: this.extractClassName(fixedCode) } };
                }
            }
            return { success: false, type: 'error', error: `Invalid creature code: ${validation.errors.join(', ')}` };
        }

        return { success: true, type: 'creature', code, data: { className } };
    }

    /**
     * Handle item creation — uses create_item tool for structured output
     */
    private async handleCreateItem(description: string, context: FewShotContext, examples: UnifiedExample[] = []): Promise<FewShotResult> {
        const prompt = getItemPrompt(description, context, examples);

        const response = await this.callOpenRouter(prompt, description, getItemTools(), context.conversationHistory);

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
    private async handleCreateStructure(description: string, context: FewShotContext, examples: UnifiedExample[] = []): Promise<FewShotResult> {
        const prompt = getStructurePrompt(description, context, examples);

        const response = await this.callOpenRouter(prompt, description, getStructureTools(), context.conversationHistory);

        // Try tool-call extraction first
        const toolResult = this.extractToolCallArgs(response, 'create_structure');
        let code: string | null = null;

        if (toolResult) {
            code = toolResult.code || null;
            console.log(`[FewShotAI] Structure code extracted via tool call`);
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
            return { success: true, type: 'structure', data: { blocks }, code };
        } catch (e: any) {
            return { success: false, type: 'error', error: `Structure code error: ${e.message}` };
        }
    }

    /**
     * Handle chat / greeting — no LLM call needed for simple cases
     */
    private async handleChat(userMessage: string, context: FewShotContext): Promise<FewShotResult> {
        const prompt = getChatPrompt(context);

        const response = await this.callOpenRouter(prompt, userMessage, null, context.conversationHistory);

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
            { role: 'system', content: systemPrompt }
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

        const data = await response.json();
        console.log('[FewShotAI] API Response data keys:', Object.keys(data));
        console.log('[FewShotAI] API Response choices:', data.choices?.length);
        console.log('[FewShotAI] API Response message keys:', Object.keys(data.choices?.[0]?.message || {}));

        // Accumulate token usage from this API call
        if (data.usage) {
            this.accumulatedUsage.promptTokens += data.usage.prompt_tokens || 0;
            this.accumulatedUsage.completionTokens += data.usage.completion_tokens || 0;
            this.accumulatedUsage.totalTokens += data.usage.total_tokens || 0;
            console.log(`[FewShotAI] Token usage: ${data.usage.prompt_tokens} in / ${data.usage.completion_tokens} out (total accumulated: ${this.accumulatedUsage.totalTokens})`);
        }

        return data.choices[0].message;
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
