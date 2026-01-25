/**
 * OpenRouter Session - Merlin AI using Claude via OpenRouter
 *
 * OpenRouter provides access to Claude and other models via a simple
 * OpenAI-compatible REST API.
 */

import { WebSocket } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';

import { auth } from '../config';
import { addTokens, getUserTokens } from './tokenService';
import { saveCreature } from './DynamicCreatureService';
import { saveItem } from './DynamicItemService';
import { searchKnowledge, addKnowledge } from './KnowledgeService';
import { ragLookup, summarizeRAGResult, RAGResult } from './RAGTemplateService';
import { getMerlinSystemPrompt } from '../ai/merlin_prompts';
import { getOpenRouterTools } from '../ai/openrouter_tools';
import { IncomingMessage } from 'http';

const PENDING_TOOL_CALLS = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterSession {
    private ws: WebSocket;
    private messages: Array<{ role: string; content: string | any[] }> = [];
    private userId: string | null = null;
    private headers: any;
    private cliMode: boolean = false;
    private authReady: Promise<void>;
    private authReadyResolve!: () => void;
    private isInterrupted = false;
    private abortController: AbortController | null = null;

    // Model configuration
    private model: string;
    private apiKey: string;

    // Knowledge gap detection
    private lastKnowledgeSearch: { query: string; timestamp: number; resultsCount: number } | null = null;

    // Track current world context
    private currentWorldId: string = 'global';

    // Settings
    private bypassTokens: boolean = false;
    private thinkingEnabled: boolean = false;

    // Pricing (Claude 4.5 Opus via OpenRouter)
    private PRICE_INPUT_1M = 3.00;
    private PRICE_OUTPUT_1M = 15.00;
    private OVERHEAD_MULTIPLIER = 1.5;
    private USD_PER_GAME_TOKEN = 0.001;

    // Track what was created in the current turn for follow-up generation
    private lastCreation: { type: 'item' | 'creature' | 'build' | null, name: string | null } = { type: null, name: null };

    // RAG template lookup result for current request
    private lastRAGResult: RAGResult | null = null;

    // Settings for RAG
    private ragEnabled: boolean = true;

    constructor(ws: WebSocket, req: IncomingMessage) {
        this.ws = ws;
        this.headers = req.headers;

        // Get API key and model from environment
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-opus-4-5-20250514';

        if (!this.apiKey) {
            console.error('[OpenRouter] CRITICAL: Missing OPENROUTER_API_KEY');
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
                console.log('[OpenRouter] CLI Mode enabled');
            }
        }

        // Register WebSocket handlers
        this.ws.on('error', (err) => {
            console.error('[OpenRouter] WebSocket error:', err);
        });

        this.ws.on('close', () => {
            console.log(`[OpenRouter] Session closed for user: ${this.userId || 'guest'}`);
            this.isInterrupted = true;
            this.abortController?.abort();
        });

        this.ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'input') {
                    await this.handleInput(msg.text, msg.context, msg.settings);
                } else if (msg.type === 'tool_response') {
                    this.handleToolResponse(msg.id, msg.result, msg.error);
                } else if (msg.type === 'interrupt') {
                    console.log('[OpenRouter] Interrupted by client.');
                    this.isInterrupted = true;
                    this.abortController?.abort();
                }
            } catch (e: any) {
                console.error('[OpenRouter] Error handling message:', e);
                this.sendError(e.message);
            }
        });

        // Verify Auth
        if (token) {
            try {
                if (!auth) throw new Error('Auth service unavailable');
                const decoded = await auth.verifyIdToken(token);
                this.userId = decoded.uid;
                console.log(`[OpenRouter] Authenticated user: ${this.userId}`);
                this.sendBalanceUpdate();
            } catch (e) {
                console.error('[OpenRouter] Auth failed:', e);
                this.send('error', { message: 'Authentication failed' });
            }
        }

        // Initialize with system prompt
        const systemPrompt = getMerlinSystemPrompt();
        this.messages.push({ role: 'system', content: systemPrompt });

        console.log(`[OpenRouter] Session initialized with model: ${this.model}`);
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

        if (!this.apiKey) {
            this.sendError('OpenRouter API key not configured');
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
        if (settings?.thinkingEnabled !== undefined) {
            this.thinkingEnabled = settings.thinkingEnabled;
        }
        if (settings?.ragEnabled !== undefined) {
            this.ragEnabled = settings.ragEnabled;
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

        // Perform RAG lookup for task-relevant templates
        this.lastRAGResult = null;
        if (this.ragEnabled) {
            try {
                this.lastRAGResult = await ragLookup(text, true);
                console.log(`[OpenRouter] RAG Result:\n${summarizeRAGResult(this.lastRAGResult)}`);

                // Send RAG info to client for debugging/display
                if (this.lastRAGResult.templates.length > 0) {
                    this.send('rag_lookup', {
                        taskType: this.lastRAGResult.classification.taskType,
                        subType: this.lastRAGResult.classification.subType,
                        confidence: this.lastRAGResult.classification.confidence,
                        templatesFound: this.lastRAGResult.templates.length,
                        templates: this.lastRAGResult.templates.map(t => ({
                            title: t.title,
                            relevance: t.relevance,
                            source: t.source
                        }))
                    });
                }
            } catch (e: any) {
                console.warn('[OpenRouter] RAG lookup failed:', e.message);
            }
        }

        // Build user message with context and RAG injection
        const contextStr = context ? `\n[Context: ${JSON.stringify(context)}]` : '';
        let fullMessage = text + contextStr;

        // Inject RAG templates if available
        if (this.lastRAGResult?.contextInjection) {
            fullMessage += this.lastRAGResult.contextInjection;
        }

        this.messages.push({ role: 'user', content: fullMessage });

        try {
            await this.generateAndProcess();
        } catch (e: any) {
            if (!this.isInterrupted) {
                console.error('[OpenRouter] Error:', e);
                this.sendError('AI Error: ' + e.message);
            }
        }
    }

    private async generateAndProcess() {
        this.abortController = new AbortController();

        const tools = getOpenRouterTools();

        const requestBody: any = {
            model: this.model,
            messages: this.messages,
            tools: tools,
            stream: true,
            max_tokens: 4096,
        };

        // Add thinking/extended thinking for Claude if enabled
        if (this.thinkingEnabled && this.model.includes('claude')) {
            requestBody.thinking = {
                type: 'enabled',
                budget_tokens: 8000
            };
        }

        console.log(`[OpenRouter] Sending request to ${this.model}...`);

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost:2567',
                'X-Title': 'Merlin AI Assistant'
            },
            body: JSON.stringify(requestBody),
            signal: this.abortController.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
            throw new Error('No response body');
        }

        // Process SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        let accumulatedToolCalls: any[] = [];
        let usageData: any = null;

        try {
            while (true) {
                if (this.isInterrupted) break;

                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;

                            if (delta?.content) {
                                accumulatedContent += delta.content;
                                this.send('token', { text: delta.content });
                            }

                            // Handle thinking/reasoning tokens
                            if (delta?.reasoning) {
                                this.send('thought', { text: delta.reasoning });
                            }

                            // Handle tool calls
                            if (delta?.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    const idx = tc.index;
                                    if (!accumulatedToolCalls[idx]) {
                                        accumulatedToolCalls[idx] = {
                                            id: tc.id || '',
                                            type: 'function',
                                            function: { name: '', arguments: '' }
                                        };
                                    }
                                    if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                                    if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
                                    if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
                                }
                            }

                            // Capture usage data
                            if (parsed.usage) {
                                usageData = parsed.usage;
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        // Add assistant message to history
        const assistantMessage: any = { role: 'assistant', content: accumulatedContent };
        if (accumulatedToolCalls.length > 0) {
            assistantMessage.tool_calls = accumulatedToolCalls;
        }
        this.messages.push(assistantMessage);

        // Handle tool calls
        if (accumulatedToolCalls.length > 0) {
            await this.executeTools(accumulatedToolCalls);
        } else {
            // Generate follow-up suggestions for creation tasks
            await this.generateFollowUpSuggestions();

            // Calculate and send cost info
            let costInfo = null;
            if (usageData) {
                costInfo = this.calculateCost(usageData);
                this.send('cost_info', costInfo);
            }

            this.send('complete', {});

            // Deduct tokens if usage data available
            if (usageData && this.userId && !this.cliMode && !this.bypassTokens) {
                await this.deductTokens(usageData);
            }
        }
    }

    private async executeTools(toolCalls: any[]) {
        const toolResults: any[] = [];

        for (const tc of toolCalls) {
            const name = tc.function.name;
            let args: any;
            try {
                args = JSON.parse(tc.function.arguments);
            } catch (e) {
                args = {};
            }

            this.send('tool_start', { name, args });

            let result: any;
            try {
                if (this.isServerTool(name)) {
                    result = await this.executeServerTool(name, args);
                } else if (this.isClientTool(name)) {
                    result = await this.executeClientTool(name, args);
                } else {
                    result = { error: `Unknown tool: ${name}` };
                }
            } catch (e: any) {
                result = { error: e.message };
            }

            this.send('tool_end', { name, result });

            toolResults.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result)
            });
        }

        // Add tool results to messages
        this.messages.push(...toolResults);

        // Continue generation
        await this.generateAndProcess();
    }

    private isServerTool(name: string): boolean {
        return ['view_file', 'list_dir', 'write_to_file', 'replace_file_content',
                'create_creature', 'create_item', 'search_knowledge', 'add_knowledge'].includes(name);
    }

    private isClientTool(name: string): boolean {
        return ['spawn_creature', 'teleport_player', 'get_scene_info', 'update_entity',
                'patch_entity', 'set_blocks', 'run_verification', 'capture_screenshot', 'give_item'].includes(name);
    }

    private async executeServerTool(name: string, args: any): Promise<any> {
        const cwd = process.cwd();

        switch (name) {
            case 'list_dir': {
                const targetPath = path.resolve(cwd, args.DirectoryPath || '.');
                const files = await fs.readdir(targetPath, { withFileTypes: true });
                return { files: files.slice(0, 50).map(f => ({ name: f.name, isDir: f.isDirectory() })) };
            }

            case 'view_file': {
                const targetPath = path.resolve(cwd, args.AbsolutePath);
                const content = await fs.readFile(targetPath, 'utf8');
                return { content: content.slice(0, 15000), truncated: content.length > 15000 };
            }

            case 'write_to_file': {
                const targetPath = path.resolve(cwd, args.TargetFile);
                await fs.mkdir(path.dirname(targetPath), { recursive: true });
                await fs.writeFile(targetPath, args.CodeContent);
                return { success: true, path: args.TargetFile };
            }

            case 'search_knowledge': {
                const results = searchKnowledge(args.query, args.category);
                this.lastKnowledgeSearch = { query: args.query, timestamp: Date.now(), resultsCount: results.length };
                return {
                    success: true,
                    count: results.length,
                    results: results.map(r => ({
                        title: r.title,
                        content: r.content.slice(0, 500),
                        tags: r.tags
                    }))
                };
            }

            case 'add_knowledge': {
                const result = await addKnowledge(args);
                return result.success ? { success: true, id: result.id } : { error: result.error };
            }

            case 'create_creature': {
                const result = await saveCreature({
                    name: args.name,
                    code: args.code,
                    description: args.description || '',
                    createdBy: this.userId || 'anonymous',
                    createdAt: Date.now()
                }, this.currentWorldId);
                if (result.success) {
                    // Track creation for follow-up suggestions
                    this.lastCreation = { type: 'creature', name: args.name };
                    return { success: true, message: `Created creature '${args.name}'` };
                }
                return { error: result.error };
            }

            case 'create_item': {
                const { name, code, icon, mesh_code, description } = args;

                // Inject getMesh() method if mesh_code provided and not already in code
                let finalCode = code;
                if (mesh_code && !code.includes('getMesh')) {
                    const lastBraceIndex = finalCode.lastIndexOf('}');
                    if (lastBraceIndex > 0) {
                        const getMeshMethod = `
    getMesh() {
        ${mesh_code}
    }
`;
                        finalCode = finalCode.slice(0, lastBraceIndex) + getMeshMethod + finalCode.slice(lastBraceIndex);
                        console.log(`[OpenRouter] Injected getMesh() into item '${name}'`);
                    }
                }

                const result = await saveItem({
                    name,
                    code: finalCode,
                    icon,
                    description: description || ''
                }, this.currentWorldId);

                if (result.success) {
                    // Track creation for follow-up suggestions
                    this.lastCreation = { type: 'item', name };

                    // Extract item ID from the code (look for super('item_id', ...))
                    const itemIdMatch = finalCode.match(/super\s*\(\s*['"]([^'"]+)['"]/);
                    const itemId = itemIdMatch ? itemIdMatch[1] : name.replace(/Item$/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

                    // Auto-give item to player after creation
                    console.log(`[OpenRouter] Auto-giving item '${itemId}' to player after creation`);
                    let giveResult: { success?: boolean; error?: string } = { error: 'Unknown error' };
                    try {
                        giveResult = await this.executeClientTool('give_item', { item: itemId, count: 1 }) as { success?: boolean; error?: string };
                        console.log(`[OpenRouter] give_item result:`, giveResult);
                    } catch (e: any) {
                        console.error(`[OpenRouter] give_item failed:`, e);
                        giveResult = { error: e.message || 'Exception during give_item' };
                    }

                    const giveMessage = giveResult?.success
                        ? ' Added to your inventory!'
                        : ` (Note: Could not add to inventory: ${giveResult?.error || 'unknown error'})`;

                    return {
                        success: true,
                        message: `Created item '${name}'.${giveMessage}`,
                        itemName: name,
                        itemId,
                        addedToInventory: !!giveResult?.success
                    };
                }
                return { error: result.error };
            }

            default:
                return { error: `Unknown server tool: ${name}` };
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

    /**
     * Calculate cost info from usage data (without deducting tokens)
     */
    private calculateCost(usage: any) {
        const inputCost = (usage.prompt_tokens / 1000000) * this.PRICE_INPUT_1M;
        const outputCost = (usage.completion_tokens / 1000000) * this.PRICE_OUTPUT_1M;
        const totalCost = (inputCost + outputCost) * this.OVERHEAD_MULTIPLIER;
        const tokensToDeduct = Math.max(1, Math.ceil(totalCost / this.USD_PER_GAME_TOKEN));

        return {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            inputCostUSD: inputCost,
            outputCostUSD: outputCost,
            totalCostUSD: totalCost,
            gameTokens: tokensToDeduct,
            model: this.model
        };
    }

    private async deductTokens(usage: any) {
        if (!this.userId) return;

        const inputCost = (usage.prompt_tokens / 1000000) * this.PRICE_INPUT_1M;
        const outputCost = (usage.completion_tokens / 1000000) * this.PRICE_OUTPUT_1M;
        const totalCost = (inputCost + outputCost) * this.OVERHEAD_MULTIPLIER;
        const tokensToDeduct = Math.max(1, Math.ceil(totalCost / this.USD_PER_GAME_TOKEN));

        console.log(`[OpenRouter] Cost: $${totalCost.toFixed(6)} -> ${tokensToDeduct} tokens`);

        try {
            await addTokens(this.userId, -tokensToDeduct, 'ai_usage', 'OpenRouter Generation');
            this.sendBalanceUpdate();
        } catch (e) {
            console.error('[OpenRouter] Failed to deduct tokens:', e);
        }
    }

    /**
     * Generate contextual follow-up suggestions after task completion
     * Uses Claude via OpenRouter to create relevant questions based on what was created
     */
    private async generateFollowUpSuggestions() {
        // Only generate follow-ups if something was created
        if (!this.lastCreation.type || !this.lastCreation.name) {
            console.log('[OpenRouter] No creation detected, skipping follow-up suggestions');
            this.lastCreation = { type: null, name: null }; // Reset for next turn
            return;
        }

        const { type, name } = this.lastCreation;
        console.log(`[OpenRouter] Generating follow-up suggestions for ${type}: ${name}`);

        try {
            // Build the prompt based on creation type
            let typeSpecificRules = '';
            if (type === 'item') {
                typeSpecificRules = `
- "I don't see ${name} in my inventory" (visibility issue)
- "The item icon/appearance doesn't look right" (visual issue)
- "The item doesn't work correctly" or "The effect isn't working" (functionality issue)
- "It works! Looks great!" (positive confirmation)`;
            } else if (type === 'creature') {
                typeSpecificRules = `
- "I don't see ${name} in the world" (visibility issue)
- "${name} doesn't look right" or "The appearance is wrong" (visual issue)
- "${name} isn't moving/behaving correctly" (behavior issue)
- "It works! Looks great!" (positive confirmation)`;
            } else if (type === 'build') {
                typeSpecificRules = `
- "I can't see the structure" (visibility issue)
- "It doesn't look right" (visual issue)
- "It works! Looks great!" (positive confirmation)`;
            }

            const prompt = `Generate 4 brief feedback statements for a user who just created a ${type} called "${name}" in a Minecraft-like game.

These are CLICKABLE BUTTONS the user will click to give feedback. They should be STATEMENTS describing issues or confirmations, NOT questions.

Example statements:
${typeSpecificRules}

RULES:
- Statements should be first-person ("I don't see...", "It doesn't...", "It works!")
- Keep each statement SHORT (under 50 characters)
- Include emoji at the start for visual distinction
- MUST include one positive confirmation option ("It works!", "Looks great!", etc.)
- Other options should describe common problems the AI can fix

Return ONLY a JSON array of 4 objects with "text" (the statement) and "type" (one of: "visibility_issue", "visual_issue", "functionality_issue", "confirmed_working"):
[{"text": "📦 I don't see ${name} in my inventory", "type": "visibility_issue"}, ...]`;

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost:2567',
                    'X-Title': 'Merlin AI Assistant'
                },
                body: JSON.stringify({
                    model: 'anthropic/claude-3-5-haiku-20241022', // Use fast model for suggestions
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 500,
                })
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const result = await response.json() as any;
            const text = result.choices?.[0]?.message?.content || '';

            // Parse JSON response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const suggestions = JSON.parse(jsonMatch[0]);
                this.send('follow_up_suggestions', {
                    creationType: type,
                    creationName: name,
                    suggestions: suggestions
                });
                console.log(`[OpenRouter] Sent ${suggestions.length} follow-up suggestions`);
            } else {
                throw new Error('Failed to parse follow-up suggestions');
            }
        } catch (e: any) {
            console.error('[OpenRouter] Failed to generate follow-up suggestions:', e);

            // Send fallback suggestions based on type
            const fallbackSuggestions = this.getFallbackFollowUps(type, name);
            this.send('follow_up_suggestions', {
                creationType: type,
                creationName: name,
                suggestions: fallbackSuggestions
            });
        }

        // Reset for next turn
        this.lastCreation = { type: null, name: null };
    }

    /**
     * Get fallback follow-up suggestions if AI generation fails
     */
    private getFallbackFollowUps(type: string, name: string) {
        if (type === 'item') {
            return [
                { text: `📦 I don't see ${name} in my inventory`, type: 'visibility_issue' },
                { text: `👁️ The item doesn't look right`, type: 'visual_issue' },
                { text: `⚡ It doesn't work correctly`, type: 'functionality_issue' },
                { text: `✅ It works! Looks great!`, type: 'confirmed_working' }
            ];
        } else if (type === 'creature') {
            return [
                { text: `👀 I don't see ${name} in the world`, type: 'visibility_issue' },
                { text: `🎨 ${name} doesn't look right`, type: 'visual_issue' },
                { text: `🤖 ${name} isn't behaving correctly`, type: 'functionality_issue' },
                { text: `✅ It works! Looks great!`, type: 'confirmed_working' }
            ];
        } else {
            return [
                { text: `👀 I can't see the structure`, type: 'visibility_issue' },
                { text: `🎨 It doesn't look right`, type: 'visual_issue' },
                { text: `✅ It works! Looks great!`, type: 'confirmed_working' }
            ];
        }
    }
}
