/**
 * Few-Shot AI System
 * Main handler for the few-shot example-based AI approach
 */

import {
    getRouterSystemPrompt,
    getCreaturePrompt,
    getItemPrompt,
    getStructurePrompt,
    getChatPrompt
} from './few_shot_prompts.js';
import { getFewShotTools, knownCreatures, knownItems } from './few_shot_tools.js';

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

interface FewShotContext {
    playerPosition?: { x: number; y: number; z: number };
    playerDirection?: { x: number; y: number; z: number };
    worldName?: string;
    userId?: string;
}

interface FewShotResult {
    success: boolean;
    type: 'creature' | 'item' | 'structure' | 'spawn' | 'give' | 'blocks' | 'chat' | 'error';
    data?: any;
    message?: string;
    code?: string;
    icon?: string;
    error?: string;
}

export class FewShotAI {
    private config: FewShotConfig;
    private model: string;

    constructor(config: FewShotConfig) {
        this.config = config;
        this.model = config.model || 'anthropic/claude-3-haiku';
    }

    setModel(modelId: string) {
        this.model = modelId;
        console.log(`[FewShotAI] Model set to: ${modelId}`);
    }

    /**
     * Main entry point - process a user request
     */
    async processRequest(userMessage: string, context: FewShotContext): Promise<FewShotResult> {
        console.log(`[FewShotAI] Processing: "${userMessage}" with model ${this.model}`);

        try {
            // Step 1: Route the request to determine which tool to use
            const routeResult = await this.routeRequest(userMessage, context);

            if (!routeResult.tool) {
                return {
                    success: false,
                    type: 'error',
                    error: 'Could not determine how to handle this request'
                };
            }

            console.log(`[FewShotAI] Routed to tool: ${routeResult.tool}`);

            // Step 2: Execute the appropriate handler
            switch (routeResult.tool) {
                case 'create_creature':
                    return await this.handleCreateCreature(routeResult.args?.description || userMessage, context);

                case 'create_item':
                    return await this.handleCreateItem(routeResult.args?.description || userMessage, context);

                case 'create_structure':
                    return await this.handleCreateStructure(routeResult.args?.description || userMessage, context);

                case 'spawn_existing':
                    return this.handleSpawnExisting(routeResult.args?.creature, routeResult.args?.count || 1);

                case 'give_existing':
                    return this.handleGiveExisting(routeResult.args?.item, routeResult.args?.count || 1);

                case 'set_blocks':
                    return { success: true, type: 'blocks', data: routeResult.args?.blocks || [] };

                case 'chat':
                    return { success: true, type: 'chat', message: routeResult.args?.response || 'Hello!' };

                default:
                    return { success: false, type: 'error', error: `Unknown tool: ${routeResult.tool}` };
            }
        } catch (error: any) {
            console.error('[FewShotAI] Error:', error);
            return {
                success: false,
                type: 'error',
                error: error.message || 'An error occurred'
            };
        }
    }

    /**
     * Route the request to determine which tool to use
     */
    private async routeRequest(userMessage: string, context: FewShotContext): Promise<{ tool: string | null; args?: any }> {
        const response = await this.callOpenRouter(
            getRouterSystemPrompt(),
            userMessage,
            getFewShotTools()
        );

        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            return {
                tool: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments || '{}')
            };
        }

        // If no tool was called, treat as chat
        return { tool: 'chat', args: { response: response.content || "I'm not sure how to help with that." } };
    }

    /**
     * Handle creature creation
     */
    private async handleCreateCreature(description: string, context: FewShotContext): Promise<FewShotResult> {
        const prompt = getCreaturePrompt(description, context);

        const response = await this.callOpenRouter(prompt, description, null);
        const code = this.extractCode(response.content);

        if (!code) {
            return { success: false, type: 'error', error: 'Failed to generate creature code' };
        }

        // Validate the code
        const validation = this.validateCreatureCode(code);
        if (!validation.valid) {
            console.log('[FewShotAI] Creature validation failed:', validation.errors);
            // Try to fix common issues
            const fixedCode = this.attemptCodeFix(code, validation.errors, 'creature');
            if (fixedCode) {
                const revalidation = this.validateCreatureCode(fixedCode);
                if (revalidation.valid) {
                    return {
                        success: true,
                        type: 'creature',
                        code: fixedCode,
                        data: { className: this.extractClassName(fixedCode) }
                    };
                }
            }
            return { success: false, type: 'error', error: `Invalid creature code: ${validation.errors.join(', ')}` };
        }

        return {
            success: true,
            type: 'creature',
            code: code,
            data: { className: this.extractClassName(code) }
        };
    }

    /**
     * Handle item creation
     */
    private async handleCreateItem(description: string, context: FewShotContext): Promise<FewShotResult> {
        const prompt = getItemPrompt(description, context);

        const response = await this.callOpenRouter(prompt, description, null);

        // Try to parse as JSON first
        let result: { className?: string; code?: string; icon?: string } = {};

        try {
            // Look for JSON in the response
            const jsonMatch = response.content.match(/\{[\s\S]*"className"[\s\S]*"code"[\s\S]*"icon"[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            // Fall back to extracting code and icon separately
            result.code = this.extractCode(response.content);
            result.icon = this.extractSvg(response.content);
        }

        if (!result.code) {
            result.code = this.extractCode(response.content);
        }
        if (!result.icon) {
            result.icon = this.extractSvg(response.content);
        }

        if (!result.code) {
            return { success: false, type: 'error', error: 'Failed to generate item code' };
        }

        // Validate the code
        const validation = this.validateItemCode(result.code);
        if (!validation.valid) {
            console.log('[FewShotAI] Item validation failed:', validation.errors);
            const fixedCode = this.attemptCodeFix(result.code, validation.errors, 'item');
            if (fixedCode) {
                const revalidation = this.validateItemCode(fixedCode);
                if (revalidation.valid) {
                    result.code = fixedCode;
                }
            }
            if (!this.validateItemCode(result.code).valid) {
                return { success: false, type: 'error', error: `Invalid item code: ${validation.errors.join(', ')}` };
            }
        }

        // Ensure we have an icon
        if (!result.icon) {
            result.icon = this.generateDefaultIcon();
        }

        return {
            success: true,
            type: 'item',
            code: result.code,
            icon: result.icon,
            data: { className: result.className || this.extractClassName(result.code) }
        };
    }

    /**
     * Handle structure creation
     */
    private async handleCreateStructure(description: string, context: FewShotContext): Promise<FewShotResult> {
        const prompt = getStructurePrompt(description, context);

        const response = await this.callOpenRouter(prompt, description, null);
        const code = this.extractCode(response.content);

        if (!code) {
            return { success: false, type: 'error', error: 'Failed to generate structure code' };
        }

        // Execute the structure code to get blocks
        try {
            const blocks = this.executeStructureCode(code, context);
            return {
                success: true,
                type: 'structure',
                data: { blocks },
                code: code
            };
        } catch (e: any) {
            return { success: false, type: 'error', error: `Structure code error: ${e.message}` };
        }
    }

    /**
     * Handle spawning existing creatures
     */
    private handleSpawnExisting(creature: string, count: number): FewShotResult {
        // Normalize creature name
        const normalized = this.normalizeCreatureName(creature);

        if (!normalized) {
            return {
                success: false,
                type: 'error',
                error: `Unknown creature: ${creature}. Known creatures: ${knownCreatures.slice(0, 10).join(', ')}...`
            };
        }

        return {
            success: true,
            type: 'spawn',
            data: { creature: normalized, count: Math.min(count, 10) }
        };
    }

    /**
     * Handle giving existing items
     */
    private handleGiveExisting(item: string, count: number): FewShotResult {
        const normalized = item.toLowerCase().replace(/\s+/g, '_');

        return {
            success: true,
            type: 'give',
            data: { item: normalized, count: Math.min(count, 64) }
        };
    }

    /**
     * Call OpenRouter API
     */
    private async callOpenRouter(systemPrompt: string, userMessage: string, tools: any[] | null): Promise<any> {
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];

        const body: any = {
            model: this.model,
            messages,
            temperature: 0.7,
            max_tokens: 4096
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
                // Insert before the closing brace of the class
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
        const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
        return svgMatch ? svgMatch[0] : null;
    }

    private extractClassName(code: string): string {
        const match = code.match(/class\s+(\w+)/);
        return match ? match[1] : 'Unknown';
    }

    private normalizeCreatureName(name: string): string | null {
        const lower = name.toLowerCase();
        for (const known of knownCreatures) {
            if (known.toLowerCase() === lower || known.toLowerCase().includes(lower)) {
                return known;
            }
        }
        return null;
    }

    private executeStructureCode(code: string, context: FewShotContext): any[] {
        const playerPosition = context.playerPosition || { x: 0, y: 64, z: 0 };

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
