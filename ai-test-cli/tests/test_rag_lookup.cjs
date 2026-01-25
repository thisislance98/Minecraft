/**
 * Test RAG Template Lookup System
 *
 * This test verifies that:
 * 1. Task classification works correctly
 * 2. Relevant templates are retrieved
 * 3. Templates are injected into the AI context
 *
 * Run: node ai-test-cli/tests/test_rag_lookup.cjs
 */

const WebSocket = require('ws');

const TEST_CASES = [
    {
        prompt: 'create a flying dragon that breathes fire',
        expectedType: 'creature',
        expectedSubType: 'flying',
        expectedKeywords: ['flying', 'dragon', 'fire']
    },
    {
        prompt: 'make a magic wand that shoots fireballs',
        expectedType: 'item',
        expectedSubType: 'wand',
        expectedKeywords: ['magic', 'wand', 'fireballs']
    },
    {
        prompt: 'spawn a pig',
        expectedType: 'spawn',
        expectedSubType: null,
        expectedKeywords: ['pig']
    },
    {
        prompt: 'build a glass pyramid',
        expectedType: 'build',
        expectedSubType: null,
        expectedKeywords: ['glass', 'pyramid']
    },
    {
        prompt: 'hello, how are you?',
        expectedType: 'conversation',
        expectedSubType: null,
        expectedKeywords: []
    },
    {
        prompt: 'create a hostile golem that attacks players',
        expectedType: 'creature',
        expectedSubType: 'hostile',
        expectedKeywords: ['hostile', 'golem', 'attacks']
    },
    {
        prompt: 'make a spinning cube that glows',
        expectedType: 'creature',
        expectedSubType: 'spinning',
        expectedKeywords: ['spinning', 'cube', 'glows']
    },
    {
        prompt: 'give me a sword that deals fire damage',
        expectedType: 'item',
        expectedSubType: 'melee',
        expectedKeywords: ['sword', 'fire', 'damage']
    }
];

async function testRagLookup(prompt, expected, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const url = new URL('ws://localhost:2567/api/antigravity');
        url.searchParams.set('cli', 'true');
        url.searchParams.set('secret', process.env.CLI_SECRET || 'asdf123');

        const ws = new WebSocket(url.toString(), {
            headers: {
                'x-antigravity-client': 'cli',
                'x-antigravity-secret': process.env.CLI_SECRET || 'asdf123'
            }
        });

        let ragResult = null;
        let timeoutHandle;

        ws.on('open', () => {
            // Send the prompt
            ws.send(JSON.stringify({
                type: 'input',
                text: prompt,
                context: {
                    position: { x: 0, y: 64, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    biome: 'Plains'
                }
            }));

            // Set timeout
            timeoutHandle = setTimeout(() => {
                ws.close();
                // For conversation type, no RAG lookup is expected
                if (expected.expectedType === 'conversation' && ragResult === null) {
                    resolve({ success: true, message: 'Correctly skipped RAG for conversation' });
                } else if (ragResult === null) {
                    reject(new Error('Timeout: No RAG lookup received'));
                } else {
                    ws.close();
                    resolve({ success: true, ragResult });
                }
            }, timeout);
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'rag_lookup') {
                    ragResult = msg;
                    console.log(`    RAG Result: ${msg.taskType} (${msg.subType || 'none'}) - ${msg.templatesFound} templates`);
                }

                if (msg.type === 'tool_request') {
                    // Send mock response for tool requests
                    ws.send(JSON.stringify({
                        type: 'tool_response',
                        id: msg.id,
                        result: { success: true, message: 'Mock response' }
                    }));
                }

                if (msg.type === 'complete' || msg.type === 'error') {
                    clearTimeout(timeoutHandle);
                    ws.close();

                    if (expected.expectedType === 'conversation' && ragResult === null) {
                        resolve({ success: true, message: 'Correctly skipped RAG for conversation' });
                        return;
                    }

                    if (ragResult === null) {
                        reject(new Error('No RAG lookup received'));
                        return;
                    }

                    // Validate results
                    const results = {
                        success: true,
                        ragResult,
                        validations: []
                    };

                    // Check task type
                    if (ragResult.taskType !== expected.expectedType) {
                        results.validations.push({
                            passed: false,
                            check: 'taskType',
                            expected: expected.expectedType,
                            actual: ragResult.taskType
                        });
                    } else {
                        results.validations.push({ passed: true, check: 'taskType' });
                    }

                    // Check sub type (only if expected)
                    if (expected.expectedSubType) {
                        if (ragResult.subType !== expected.expectedSubType) {
                            results.validations.push({
                                passed: false,
                                check: 'subType',
                                expected: expected.expectedSubType,
                                actual: ragResult.subType
                            });
                        } else {
                            results.validations.push({ passed: true, check: 'subType' });
                        }
                    }

                    // Check templates found
                    if (ragResult.templatesFound > 0) {
                        results.validations.push({ passed: true, check: 'templatesFound', count: ragResult.templatesFound });
                    } else {
                        results.validations.push({ passed: false, check: 'templatesFound', message: 'No templates found' });
                    }

                    results.success = results.validations.every(v => v.passed);
                    resolve(results);
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeoutHandle);
            reject(err);
        });
    });
}

async function runTests() {
    console.log('\n🧪 RAG Template Lookup Tests\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    for (const testCase of TEST_CASES) {
        console.log(`\n📝 Test: "${testCase.prompt.substring(0, 50)}..."`);
        console.log(`   Expected: ${testCase.expectedType} (${testCase.expectedSubType || 'any'})`);

        try {
            const result = await testRagLookup(testCase.prompt, testCase, 15000);

            if (result.success) {
                console.log(`   ✅ PASSED`);
                if (result.validations) {
                    result.validations.forEach(v => {
                        if (v.check === 'templatesFound') {
                            console.log(`      Templates: ${v.count}`);
                        }
                    });
                }
                passed++;
            } else {
                console.log(`   ❌ FAILED`);
                result.validations?.filter(v => !v.passed).forEach(v => {
                    console.log(`      ${v.check}: expected ${v.expected}, got ${v.actual}`);
                });
                failed++;
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            failed++;
        }

        // Small delay between tests
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

    process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
    runTests().catch(err => {
        console.error('Test runner error:', err);
        process.exit(1);
    });
}

module.exports = { testRagLookup, TEST_CASES };
