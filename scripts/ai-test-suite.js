#!/usr/bin/env node
/**
 * AI End-to-End Test Suite
 * 
 * Runs real tests against the game server and AI.
 * Requires the game to be running (both server and client in browser).
 * 
 * Usage:
 *   node scripts/ai-test-suite.js                    # Run all tests
 *   node scripts/ai-test-suite.js --test spawn      # Run specific test
 *   node scripts/ai-test-suite.js --timeout 60000   # Custom timeout
 */

import { Client } from "colyseus.js";
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

// Node.js WebSocket polyfill
global.WebSocket = WebSocket;

const SERVER_URL = process.env.SERVER_URL || "http://localhost:2567";
const DEFAULT_TIMEOUT = 45000; // 45 seconds per test

// Parse CLI arguments
const args = process.argv.slice(2);
const specificTest = args.includes('--test') ? args[args.indexOf('--test') + 1] : null;
const timeout = args.includes('--timeout') ? parseInt(args[args.indexOf('--timeout') + 1]) : DEFAULT_TIMEOUT;

/**
 * Test case definitions
 * Each test has a prompt, expected tool, and validation function
 */
const TEST_CASES = [
    {
        name: 'spawn_creature_pig',
        prompt: 'spawn a pig',
        expectedTool: 'spawn_creature',
        validate: (response) => {
            if (response.tool !== 'spawn_creature') return `Expected tool 'spawn_creature', got '${response.tool}'`;
            if (!response.creature?.toLowerCase().includes('pig')) return `Expected creature 'Pig', got '${response.creature}'`;
            return null; // null = passed
        }
    },
    {
        name: 'spawn_creature_multiple',
        prompt: 'spawn 3 wolves',
        expectedTool: 'spawn_creature',
        validate: (response) => {
            if (response.tool !== 'spawn_creature') return `Expected tool 'spawn_creature', got '${response.tool}'`;
            if (!response.creature?.toLowerCase().includes('wolf')) return `Expected creature 'Wolf', got '${response.creature}'`;
            if (response.count !== 3) return `Expected count 3, got ${response.count}`;
            return null;
        }
    },
    {
        name: 'teleport_desert',
        prompt: 'teleport me to the desert',
        expectedTool: 'teleport_player',
        validate: (response) => {
            if (response.tool !== 'teleport_player') return `Expected tool 'teleport_player', got '${response.tool}'`;
            if (!response.location?.toLowerCase().includes('desert')) return `Expected location 'desert', got '${response.location}'`;
            return null;
        }
    },
    {
        name: 'teleport_spawn',
        prompt: 'take me back to spawn',
        expectedTool: 'teleport_player',
        validate: (response) => {
            if (response.tool !== 'teleport_player') return `Expected tool 'teleport_player', got '${response.tool}'`;
            if (!response.location?.toLowerCase().includes('spawn')) return `Expected location 'spawn', got '${response.location}'`;
            return null;
        }
    },
    {
        name: 'get_scene_info',
        prompt: 'where am I?',
        expectedTool: 'get_scene_info',
        validate: (response) => {
            if (response.tool !== 'get_scene_info') return `Expected tool 'get_scene_info', got '${response.tool}'`;
            return null;
        }
    },
    {
        name: 'spawn_hostile',
        prompt: 'spawn a zombie',
        expectedTool: 'spawn_creature',
        validate: (response) => {
            if (response.tool !== 'spawn_creature') return `Expected tool 'spawn_creature', got '${response.tool}'`;
            if (!response.creature?.toLowerCase().includes('zombie')) return `Expected creature 'Zombie', got '${response.creature}'`;
            return null;
        }
    },
    {
        name: 'teleport_coordinates',
        prompt: 'teleport me to 100, 80, 100',
        expectedTool: 'teleport_player',
        validate: (response) => {
            if (response.tool !== 'teleport_player') return `Expected tool 'teleport_player', got '${response.tool}'`;
            // Coordinates should be in the location string
            if (!response.location?.includes('100')) return `Expected coordinates in location, got '${response.location}'`;
            return null;
        }
    }
];

/**
 * Run a single test case
 */
async function runTest(client, testCase) {
    const debugId = uuidv4();

    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout: No response within ${timeout}ms`));
        }, timeout);

        try {
            // Find existing room or create one
            let room;
            try {
                const response = await fetch(`${SERVER_URL}/matchmake/game`);
                const rooms = response.ok ? await response.json() : [];

                if (rooms.length > 0) {
                    room = await client.joinById(rooms[0].roomId, { name: 'AI_Test_Runner' });
                } else {
                    room = await client.joinOrCreate("game", { name: 'AI_Test_Runner' });
                }
            } catch (e) {
                room = await client.joinOrCreate("game", { name: 'AI_Test_Runner' });
            }

            // Listen for response
            room.onMessage("debugResponse", (data) => {
                if (data.debugId === debugId) {
                    clearTimeout(timeoutId);

                    // Validate response
                    const error = testCase.validate(data);

                    room.leave().then(() => {
                        if (error) {
                            reject(new Error(error));
                        } else {
                            resolve(data);
                        }
                    });
                }
            });

            // Send command
            room.send("debugCommand", {
                debugId: debugId,
                prompt: testCase.prompt
            });

        } catch (e) {
            clearTimeout(timeoutId);
            reject(e);
        }
    });
}

/**
 * Run all tests and report results
 */
async function runAllTests() {
    console.log('\n🧪 AI End-to-End Test Suite');
    console.log('═'.repeat(50));
    console.log(`📡 Server: ${SERVER_URL}`);
    console.log(`⏱️  Timeout: ${timeout}ms per test`);
    console.log('═'.repeat(50));

    const client = new Client(SERVER_URL);
    const results = { passed: 0, failed: 0, skipped: 0 };
    const failures = [];

    // Filter tests if specific test requested
    const testsToRun = specificTest
        ? TEST_CASES.filter(t => t.name.includes(specificTest))
        : TEST_CASES;

    if (testsToRun.length === 0) {
        console.log(`\n❌ No tests matching '${specificTest}' found.`);
        console.log('Available tests:', TEST_CASES.map(t => t.name).join(', '));
        process.exit(1);
    }

    console.log(`\n📋 Running ${testsToRun.length} test(s)...\n`);

    for (const testCase of testsToRun) {
        process.stdout.write(`  ${testCase.name.padEnd(30)} `);

        try {
            const startTime = Date.now();
            const response = await runTest(client, testCase);
            const duration = Date.now() - startTime;

            console.log(`✅ PASSED (${duration}ms)`);
            results.passed++;

        } catch (error) {
            console.log(`❌ FAILED`);
            console.log(`     └─ ${error.message}`);
            results.failed++;
            failures.push({ test: testCase.name, error: error.message });
        }

        // Small delay between tests to avoid overwhelming the server
        await new Promise(r => setTimeout(r, 1000));
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 RESULTS');
    console.log('═'.repeat(50));
    console.log(`   ✅ Passed:  ${results.passed}`);
    console.log(`   ❌ Failed:  ${results.failed}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log('═'.repeat(50));

    if (failures.length > 0) {
        console.log('\n📋 FAILURE DETAILS:');
        failures.forEach(f => {
            console.log(`   • ${f.test}: ${f.error}`);
        });
    }

    // Exit code
    const exitCode = results.failed > 0 ? 1 : 0;
    console.log(`\n${exitCode === 0 ? '🎉 All tests passed!' : '💥 Some tests failed.'}\n`);
    process.exit(exitCode);
}

// Check if server is available and has clients
async function checkServer() {
    try {
        const response = await fetch(`${SERVER_URL}/matchmake/game`);
        if (!response.ok) return { up: false, clients: 0 };

        const rooms = await response.json();
        const clientCount = rooms.reduce((acc, room) => acc + room.clients, 0);

        return { up: true, clients: clientCount };
    } catch (e) {
        return { up: false, clients: 0 };
    }
}

// Main
async function main() {
    console.log('\n🔍 Checking game server...');

    const status = await checkServer();
    if (!status.up) {
        console.error(`\n❌ Cannot connect to server at ${SERVER_URL}`);
        console.error('   Make sure the game is running:');
        console.error('   1. Start the server: cd server && npm start');
        console.error('   2. Open the game in a browser: npm run dev');
        console.error('\n');
        process.exit(1);
    }

    if (status.clients === 0) {
        console.warn(`\n⚠️  Server is up but NO clients are connected!`);
        console.warn('   The AI lives in the game client (browser), not the server.');
        console.warn('   Please open http://localhost:3000 in your browser before running tests.');
        console.warn('   Waiting 30 seconds for a client to connect...\n');

        // Wait for client to connect
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const newStatus = await checkServer();
            if (newStatus.clients > 0) {
                console.log('✅ Client connected!');
                break;
            }
            if (i === 29) {
                console.error('❌ Timeout: No game client connected.');
                process.exit(1);
            }
        }
    }

    console.log(`✅ Server is running (${status.clients || 'at least 1'} client(s) connected)\n`);

    await runAllTests();
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
