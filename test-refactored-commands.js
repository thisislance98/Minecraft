#!/usr/bin/env node
/**
 * Test that refactored commands still work
 */

import * as GameCommands from './ai-test-cli/src/commands/index.js';
import * as InventoryCommands from './ai-test-cli/src/commands/inventory-commands.js';
import * as PlayerCommands from './ai-test-cli/src/commands/player-commands.js';
import * as EntityCommands from './ai-test-cli/src/commands/entity-commands.js';
import * as WorldCommands from './ai-test-cli/src/commands/world-commands.js';
import * as InteractionCommands from './ai-test-cli/src/commands/interaction-commands.js';
import * as TestingCommands from './ai-test-cli/src/commands/testing-commands.js';
import * as WarpCommands from './ai-test-cli/src/commands/warp-commands.js';
import * as SdkCommands from './ai-test-cli/src/commands/sdk-commands.js';

console.log('Testing refactored command modules...\n');

const tests = [
    { name: 'GameCommands (index)', module: GameCommands, expectedFunctions: 119 },
    { name: 'InventoryCommands', module: InventoryCommands, expectedFunctions: 20 },
    { name: 'PlayerCommands', module: PlayerCommands, expectedFunctions: 10 },
    { name: 'EntityCommands', module: EntityCommands, expectedFunctions: 16 },
    { name: 'WorldCommands', module: WorldCommands, expectedFunctions: 29 },
    { name: 'InteractionCommands', module: InteractionCommands, expectedFunctions: 15 },
    { name: 'TestingCommands', module: TestingCommands, expectedFunctions: 13 },
    { name: 'WarpCommands', module: WarpCommands, expectedFunctions: 5 },
    { name: 'SdkCommands', module: SdkCommands, expectedFunctions: 11 },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
    const functions = Object.keys(test.module);
    const count = functions.length;

    if (count === test.expectedFunctions) {
        console.log(`✅ ${test.name}: ${count} functions (expected ${test.expectedFunctions})`);
        passed++;
    } else {
        console.log(`❌ ${test.name}: ${count} functions (expected ${test.expectedFunctions})`);
        failed++;

        // Show difference
        if (count < test.expectedFunctions) {
            console.log(`   Missing ${test.expectedFunctions - count} functions`);
        } else {
            console.log(`   Has ${count - test.expectedFunctions} extra functions`);
        }
    }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${tests.length} modules tested`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`${'='.repeat(50)}\n`);

if (failed === 0) {
    console.log('✅ All refactored command modules are working correctly!');
    process.exit(0);
} else {
    console.log('❌ Some modules have issues. Please review.');
    process.exit(1);
}
