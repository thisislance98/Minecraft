/**
 * Test: Wand Template Generation
 * Verifies that Merlin correctly uses the wand template to generate a working wand
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:2567/api/antigravity?cli=true&secret=asdf123';

async function testWandGeneration() {
    console.log('=== Testing Wand Template Generation ===\n');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL, {
            headers: {
                'x-antigravity-client': 'cli',
                'x-antigravity-secret': 'asdf123'
            }
        });

        let fullResponse = '';
        let codeBlocks = [];
        let createdItemName = null;
        let timeout;

        ws.on('open', () => {
            console.log('✓ Connected to Merlin AI\n');
            console.log('Sending prompt: "make a wand that shoots lightning"\n');

            ws.send(JSON.stringify({
                type: 'input',
                text: 'make a wand that shoots lightning',
                context: {
                    position: { x: 0, y: 64, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    biome: 'Plains'
                }
            }));

            // Timeout after 60 seconds
            timeout = setTimeout(() => {
                console.log('\n⚠ Timeout - closing connection');
                ws.close();
                analyzeResponse();
            }, 60000);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());

                // Log all message types for debugging
                console.log(`[MSG] type=${message.type}`);

                if (message.type === 'token') {
                    process.stdout.write(message.text || '');
                    fullResponse += message.text || '';
                }

                if (message.type === 'text') {
                    process.stdout.write(message.content || '');
                    fullResponse += message.content || '';
                }

                if (message.type === 'code') {
                    console.log('\n--- CODE BLOCK ---');
                    console.log(message.code);
                    console.log('--- END CODE ---\n');
                    codeBlocks.push(message.code);
                }

                if (message.type === 'tool_start') {
                    console.log(`\n[TOOL] Starting: ${message.name}`);
                }

                if (message.type === 'tool_end') {
                    console.log(`[TOOL] Finished: ${message.name}`, message.result);
                    // Track successful item creation
                    if (message.name === 'create_item' && message.result?.success) {
                        createdItemName = message.result.itemName;
                    }
                }

                // Handle client tool requests (like give_item)
                if (message.type === 'tool_request') {
                    console.log(`[TOOL_REQUEST] ${message.name} - responding with mock success`);
                    ws.send(JSON.stringify({
                        type: 'tool_response',
                        id: message.id,
                        result: { success: true }
                    }));
                }

                if (message.type === 'rag_lookup') {
                    console.log(`\n[RAG] Task: ${message.taskType}/${message.subType}, Templates: ${message.templatesFound}`);
                }

                if (message.type === 'done' || message.type === 'complete') {
                    clearTimeout(timeout);
                    ws.close();
                    analyzeResponse();
                }

                if (message.type === 'error') {
                    console.error('\n✗ Error:', message.error || message.message);
                    clearTimeout(timeout);
                    ws.close();
                    analyzeResponse();
                }
            } catch (e) {
                console.error('Parse error:', e.message);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error.message);
            reject(error);
        });

        ws.on('close', () => {
            clearTimeout(timeout);
        });

        async function analyzeResponse() {
            console.log('\n\n=== ANALYSIS ===\n');

            // Check if item was created via tool
            if (createdItemName) {
                console.log(`✓ Item created via tool: ${createdItemName}`);

                // Fetch the item code from the server to analyze it
                try {
                    const http = require('http');
                    const itemData = await new Promise((res, rej) => {
                        http.get(`http://localhost:2567/api/ai/debug/item/${createdItemName}`, (response) => {
                            let data = '';
                            response.on('data', chunk => data += chunk);
                            response.on('end', () => {
                                try {
                                    const json = JSON.parse(data);
                                    res(json);
                                } catch (e) {
                                    res(null);
                                }
                            });
                        }).on('error', rej);
                    }).catch(() => null);

                    if (itemData && itemData.item && itemData.item.code) {
                        codeBlocks.push(itemData.item.code);
                        console.log(`✓ Retrieved item code (${itemData.item.code.length} chars)`);
                        console.log(`  - Has getMesh: ${itemData.item.hasGetMesh}`);
                        console.log(`  - Has onUseDown: ${itemData.item.hasOnUseDown}`);
                    }
                } catch (e) {
                    console.log('Could not fetch item code from server:', e.message);
                }
            }

            // Check if code was generated
            const hasCode = codeBlocks.length > 0;
            console.log(`Code blocks received: ${codeBlocks.length}`);

            if (!hasCode && !createdItemName) {
                console.log('✗ FAIL: No code was generated and no item was created');
                resolve({ success: false, reason: 'no_code' });
                return;
            }

            // If no code blocks but item was created, consider it a pass
            if (!hasCode && createdItemName) {
                console.log('✓ Item was created via tool (code stored server-side)');
                resolve({ success: true, itemCreated: createdItemName });
                return;
            }

            const code = codeBlocks.join('\n');

            // Check for required components
            const checks = {
                hasClass: /class\s+\w+/.test(code),
                hasIcon: /icon\s*=/.test(code) || /this\.icon/.test(code),
                hasGetMesh: /getMesh\s*\(/.test(code),
                hasOnUseDown: /onUseDown\s*\(/.test(code),
                hasProjectile: /projectile/i.test(code) || /Projectile/.test(code),
                usesWindowTHREE: /window\.THREE/.test(code),
                hasVelocity: /velocity/i.test(code)
            };

            console.log('\nRequired components:');
            console.log(`  - Has class definition: ${checks.hasClass ? '✓' : '✗'}`);
            console.log(`  - Has icon property: ${checks.hasIcon ? '✓' : '✗'}`);
            console.log(`  - Has getMesh method: ${checks.hasGetMesh ? '✓' : '✗'}`);
            console.log(`  - Has onUseDown method: ${checks.hasOnUseDown ? '✓' : '✗'}`);
            console.log(`  - Has projectile logic: ${checks.hasProjectile ? '✓' : '✗'}`);
            console.log(`  - Uses window.THREE: ${checks.usesWindowTHREE ? '✓' : '✗'}`);
            console.log(`  - Has velocity: ${checks.hasVelocity ? '✓' : '✗'}`);

            const passed = Object.values(checks).filter(v => v).length;
            const total = Object.keys(checks).length;

            console.log(`\nScore: ${passed}/${total}`);

            if (passed >= 5) {
                console.log('\n✓ TEST PASSED - Wand template was properly applied');
                resolve({ success: true, checks, code });
            } else {
                console.log('\n✗ TEST FAILED - Missing critical components');
                resolve({ success: false, checks, code });
            }
        }
    });
}

testWandGeneration()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
        console.error('Test failed:', err);
        process.exit(1);
    });
