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
 *   node scripts/ai-test-suite.js --test multiplayer --players 2 --bots 2
 *   node scripts/ai-test-suite.js --timeout 60000   # Custom timeout
 */

import { Client } from "colyseus.js";
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Node.js WebSocket polyfill
global.WebSocket = WebSocket;

const SERVER_URL = process.env.SERVER_URL || "http://localhost:2567";
const DEFAULT_TIMEOUT = 45000; // 45 seconds per test

// Parse CLI arguments
const args = process.argv.slice(2);
const specificTest = args.includes('--test') ? args[args.indexOf('--test') + 1] : null;
const timeout = args.includes('--timeout') ? parseInt(args[args.indexOf('--timeout') + 1]) : DEFAULT_TIMEOUT;
const players = args.includes('--players') ? parseInt(args[args.indexOf('--players') + 1]) : 2;
const botCount = args.includes('--bots') ? parseInt(args[args.indexOf('--bots') + 1]) : 0;

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

class Bot {
    constructor(id) {
        this.id = id;
        this.client = new Client(SERVER_URL);
        this.room = null;
        this.angle = Math.random() * Math.PI * 2;
        this.radius = 5 + Math.random() * 3;
        this.speed = 0.05 + Math.random() * 0.05;
        this.interval = null;
    }

    async connect() {
        try {
            // Join existing room or create
            let rooms = [];
            try {
                const apiRes = await fetch(`${SERVER_URL}/api/rooms`);
                if (apiRes.ok) rooms = await apiRes.json();
            } catch (e) { /* ignore */ }

            const hostRoom = rooms.find(r => r.clients > 0);
            if (hostRoom) {
                this.room = await this.client.joinById(hostRoom.roomId, { name: `Bot_${this.id}` });
            } else {
                this.room = await this.client.joinOrCreate("game", { name: `Bot_${this.id}` });
            }

            console.log(`[Bot ${this.id}] Connected to room ${this.room.id}`);
            this.startLoop();
        } catch (e) {
            console.error(`[Bot ${this.id}] Connection failed:`, e.message);
        }
    }

    startLoop() {
        this.interval = setInterval(() => {
            if (!this.room) return;

            // Move in a circle
            this.angle += this.speed;
            const x = 32 + Math.cos(this.angle) * this.radius;
            const z = 32 + Math.sin(this.angle) * this.radius;
            const y = 40;

            // Look at center
            const rotationY = Math.atan2(32 - x, 32 - z); // Simple look-at math

            this.room.send('playerMove', {
                x: x,
                y: y,
                z: z,
                rotationX: 0,
                rotationY: rotationY,
                animation: 'walking',
                heldItem: 'sword_diamond'
            });

        }, 100); // 10hz updates
    }

    disconnect() {
        if (this.interval) clearInterval(this.interval);
        if (this.room) this.room.leave();
    }
}

/**
 * Open multiple browser windows for multiplayer testing
 */
async function runMultiplayerTest(playerCount, botCount) {
    console.log(`\n👥 Starting Multiplayer Test...`);

    // Launch Browsers
    if (playerCount > 0) {
        console.log(`   Opening ${playerCount} browser windows to http://localhost:3000`);
        try {
            const platform = process.platform;
            let command = '';

            if (platform === 'darwin') {
                command = `open -n -a "Google Chrome" --args "--new-window" "http://localhost:3000"`;
            } else if (platform === 'linux') {
                command = `google-chrome --new-window "http://localhost:3000"`;
            } else if (platform === 'win32') {
                command = `start chrome --new-window "http://localhost:3000"`;
            }

            for (let i = 0; i < playerCount; i++) {
                console.log(`   🚀 Launching player ${i + 1}...`);
                await new Promise(r => setTimeout(r, 800));
                await execAsync(command).catch(e => {
                    if (platform === 'darwin') return execAsync(`open "http://localhost:3000"`);
                    throw e;
                });
            }
        } catch (e) {
            console.error(`❌ Failed to launch browsers: ${e.message}`);
        }
    }

    // Launch Bots
    if (botCount > 0) {
        console.log(`   🤖 Launching ${botCount} bots...`);
        const bots = [];
        for (let i = 0; i < botCount; i++) {
            const bot = new Bot(i + 1);
            bots.push(bot);
            await bot.connect();
            await new Promise(r => setTimeout(r, 200));
        }
        console.log(`   ✅ ${botCount} bots are running. Press Ctrl+C to stop.`);

        // Command the player to teleport to the bots to ensure visibility
        if (bots.length > 0 && bots[0].room) {
            console.log(`   ✨ Teleporting player to bots (32, 50, 32)...`);
            bots[0].room.send('debugCommand', {
                action: 'teleport',
                x: 32,
                y: 50,
                z: 32
            });
        }

        // Keep process alive
        await new Promise(() => { });
    }

    console.log(`\n✅ All players launched.`);
    console.log(`   Verify they are connected in the game window.`);
}

/**
 * Run a single test case
 */
async function runTest(client, testCase) {
    const debugId = uuidv4();

    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout: No response within ${timeout}ms. (Is the browser active?)`));
        }, timeout);

        try {
            // Find existing room or create one
            let room;
            try {
                // Fetch active rooms from server API
                const apiRes = await fetch(`${SERVER_URL}/api/rooms`);
                const rooms = await apiRes.json();
                console.log(`Debug: Found ${rooms.length} active rooms via API.`);

                // Find a room with clients (likely the browser host)
                const hostRoom = rooms.find(r => r.clients > 0);

                if (hostRoom) {
                    console.log(`Debug: Joining existing room ${hostRoom.roomId} (${hostRoom.clients} clients)`);
                    room = await client.joinById(hostRoom.roomId, { name: 'AI_Test_Runner' });
                } else if (rooms.length > 0) {
                    // Fallback to any room
                    console.log(`Debug: Joining existing empty room ${rooms[0].roomId}`);
                    room = await client.joinById(rooms[0].roomId, { name: 'AI_Test_Runner' });
                } else {
                    console.log("Debug: No existing rooms found via API. Creating new one.");
                    room = await client.create("game", { name: 'AI_Test_Runner' });
                }
            } catch (e) {
                console.log("Debug: Join failed, creating new room. Error:", e.message);
                room = await client.create("game", { name: 'AI_Test_Runner' });
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
    console.log('ℹ️  NOTE: Tests run in the game environment.');
    console.log('   Please ensure http://localhost:3000 is open in your browser.');
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

// Check if server is available
async function checkServer() {
    try {
        const response = await fetch(`${SERVER_URL}/health`);
        return response.ok;
    } catch (e) {
        console.error('Debug: checkServer connection error:', e.message);
        return false;
    }
}

// Main
async function main() {
    // Special case for multiplayer 'test'
    if (specificTest === 'multiplayer') {
        await runMultiplayerTest(players, botCount);
        return;
    }

    console.log('\n🔍 Checking game server...');

    const serverUp = await checkServer();
    if (!serverUp) {
        console.error(`\n❌ Cannot connect to server at ${SERVER_URL}`);
        console.error('   Make sure the game is running:');
        console.error('   1. Start the server: cd server && npm start');
        console.error('   2. Open the game in a browser: npm run dev');
        console.error('   3. Check if port is correct (default 2567)');
        console.error('\n');
        process.exit(1);
    }

    // Warn if we can't verify client count (simplified check)
    // We assume if server is up, we try to run.
    console.log('✅ Server is reachable. Waiting for client...');

    await runAllTests();
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
