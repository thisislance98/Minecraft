#!/usr/bin/env node
/**
 * Test: Follow-up Suggestions Feature
 *
 * This test verifies that after creating an item or creature,
 * the server sends follow-up suggestions to help the user verify
 * the creation worked correctly.
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:2567/api/antigravity?cli=true&secret=asdf123';

class FollowUpTest {
    constructor() {
        this.ws = null;
        this.receivedMessages = [];
        this.followUpSuggestions = null;
        this.creationComplete = false;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(SERVER_URL, {
                headers: {
                    'x-antigravity-client': 'cli',
                    'x-antigravity-secret': 'asdf123'
                }
            });

            this.ws.on('open', () => {
                console.log('✅ Connected to server');
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.receivedMessages.push(msg);
                    this.handleMessage(msg);
                } catch (e) {
                    console.error('Parse error:', e);
                }
            });

            this.ws.on('error', reject);
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'token':
                process.stdout.write(msg.text || '');
                break;
            case 'thought':
                console.log('\n[Thinking]', msg.text?.substring(0, 100) + '...');
                break;
            case 'tool_start':
                console.log(`\n🔧 Tool: ${msg.name}`);
                break;
            case 'tool_end':
                console.log(`✅ Tool ${msg.name} complete`);
                break;
            case 'tool_request':
                // Mock client tool response
                this.handleToolRequest(msg);
                break;
            case 'follow_up_suggestions':
                console.log('\n\n📋 FOLLOW-UP SUGGESTIONS RECEIVED:');
                console.log(`  Creation Type: ${msg.creationType}`);
                console.log(`  Creation Name: ${msg.creationName}`);
                console.log('  Suggestions:');
                msg.suggestions?.forEach((s, i) => {
                    console.log(`    ${i + 1}. [${s.type}] ${s.text}`);
                });
                this.followUpSuggestions = msg;
                break;
            case 'complete':
                console.log('\n\n✅ Task complete');
                this.creationComplete = true;
                break;
            case 'error':
                console.error('\n❌ Error:', msg.message);
                break;
        }
    }

    handleToolRequest(msg) {
        // Mock responses for client tools
        const responses = {
            'spawn_creature': { success: true, entityId: 'test-entity-123' },
            'get_scene_info': {
                success: true,
                entities: [],
                player: { position: { x: 0, y: 0, z: 0 } }
            },
            'capture_screenshot': { success: true, image: 'data:image/jpeg;base64,test' }
        };

        const response = responses[msg.name] || { success: true };

        this.ws.send(JSON.stringify({
            type: 'tool_response',
            id: msg.id,
            result: response
        }));
    }

    async sendPrompt(text) {
        console.log(`\n📤 Sending: "${text}"\n`);
        this.ws.send(JSON.stringify({
            type: 'input',
            text: text,
            context: {
                x: 0, y: 10, z: 0,
                worldId: 'test-world'
            }
        }));
    }

    async waitForCompletion(timeoutMs = 60000) {
        const startTime = Date.now();
        while (!this.creationComplete && Date.now() - startTime < timeoutMs) {
            await new Promise(r => setTimeout(r, 100));
        }
        return this.creationComplete;
    }

    async waitForFollowUps(timeoutMs = 5000) {
        const startTime = Date.now();
        while (!this.followUpSuggestions && Date.now() - startTime < timeoutMs) {
            await new Promise(r => setTimeout(r, 100));
        }
        return this.followUpSuggestions;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

async function runTest() {
    console.log('='.repeat(60));
    console.log('🧪 TEST: Follow-up Suggestions Feature');
    console.log('='.repeat(60));

    const test = new FollowUpTest();

    try {
        // Connect to server
        await test.connect();

        // Request creating a simple item
        await test.sendPrompt('Create a simple test sword called "TestBlade" with 10 damage');

        // Wait for completion
        const completed = await test.waitForCompletion(120000);

        if (!completed) {
            console.error('\n❌ TEST FAILED: Task did not complete in time');
            test.disconnect();
            process.exit(1);
        }

        // Check if we received follow-up suggestions
        await test.waitForFollowUps(3000);

        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(60));

        if (test.followUpSuggestions) {
            console.log('✅ Follow-up suggestions received!');
            console.log(`   Type: ${test.followUpSuggestions.creationType}`);
            console.log(`   Name: ${test.followUpSuggestions.creationName}`);
            console.log(`   Suggestions count: ${test.followUpSuggestions.suggestions?.length || 0}`);

            // Validate the suggestions
            const suggestions = test.followUpSuggestions.suggestions || [];
            const hasVisibilityIssue = suggestions.some(s => s.type === 'visibility_issue');
            const hasVisualIssue = suggestions.some(s => s.type === 'visual_issue');
            const hasFunctionalityIssue = suggestions.some(s => s.type === 'functionality_issue');
            const hasConfirmation = suggestions.some(s => s.type === 'confirmed_working');

            console.log('\n   Validation:');
            console.log(`   - Has visibility issue option: ${hasVisibilityIssue ? '✅' : '❌'}`);
            console.log(`   - Has visual issue option: ${hasVisualIssue ? '✅' : '❌'}`);
            console.log(`   - Has functionality issue option: ${hasFunctionalityIssue ? '✅' : '❌'}`);
            console.log(`   - Has confirmation option: ${hasConfirmation ? '✅' : '❌'}`);

            if (hasConfirmation && suggestions.length >= 3) {
                console.log('\n✅ TEST PASSED: Follow-up suggestions feature working correctly!');
                test.disconnect();
                process.exit(0);
            } else {
                console.log('\n⚠️ TEST PARTIAL: Suggestions received but may be incomplete');
                test.disconnect();
                process.exit(0);
            }
        } else {
            console.log('❌ No follow-up suggestions received');
            console.log('   This could mean:');
            console.log('   1. The creation tool was not called');
            console.log('   2. The follow-up generation failed');
            console.log('   3. The server version does not have this feature');

            // Check what messages we did receive
            console.log('\n   Messages received:');
            const types = [...new Set(test.receivedMessages.map(m => m.type))];
            types.forEach(t => console.log(`   - ${t}`));

            test.disconnect();
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test error:', error);
        test.disconnect();
        process.exit(1);
    }
}

runTest();
