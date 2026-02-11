#!/usr/bin/env node
/**
 * Manual JavaScript-based refactoring script
 * Split game-commands.js into category files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Category definitions
const CATEGORIES = {
    'inventory-commands': [
        'getHeldItem', 'giveItem', 'selectSlot', 'equipItem', 'useSelectedItem',
        'getInventory', 'printInventory', 'openInventory', 'closeInventory',
        'dropItem', 'checkItemInInventory', 'checkItemIcon', 'checkItemMesh',
        'checkItemRegistered', 'getItemInfo', 'listAllItems', 'printItemInfo',
        'getRegisteredItems', 'isItemRegistered', 'testItemFunctionality'
    ],
    'player-commands': [
        'getPlayerPosition', 'getPlayerHealth', 'getPlayerPhysics', 'setRotation',
        'takeDamage', 'teleportPlayer', 'monitorGroundState', 'getRemotePlayers',
        'lookDirection', 'lookAt'
    ],
    'entity-commands': [
        'getEntities', 'printEntities', 'spawnCreature', 'spawnCreatureAt',
        'getRegisteredCreatures', 'isCreatureRegistered', 'getCreatureErrors',
        'getDynamicCreatureInfo', 'getCreatureStats', 'detectInFront', 'detectAround',
        'getObjectsInView', 'verifyEntityVisible', 'diagnoseEntities', 'watchEntity',
        'printDiagnostics'
    ],
    'world-commands': [
        'breakBlock', 'setBlock', 'getDrops', 'printDrops', 'placeBlock', 'mineBlock',
        'getCurrentWorld', 'joinWorld', 'waitForWorldJoin', 'navigateToWorld',
        'getWorldCreatures', 'getWorldItems', 'clearDynamicContent',
        'applySkyColor', 'getSkyColor', 'setGravity', 'getGravity',
        'setAllowedCreatures', 'getAllowedCreatures', 'getWorldCustomizations',
        'updateWorldSettings', 'openWorldBrowser', 'closeWorldBrowser',
        'switchWorldBrowserTab', 'getWorldBrowserState', 'getWorldBrowserTabs',
        'getWorldBrowserSettings', 'sendAIPromptWithWorld', 'getSocketEvents'
    ],
    'interaction-commands': [
        'pressKey', 'rightClick', 'leftClick', 'interact', 'useItem', 'pickupItem',
        'attack', 'mount', 'dismount', 'getMountInfo', 'findAndMountShip',
        'moveDirection', 'sprint', 'toggleFlight', 'flyVertical'
    ],
    'testing-commands': [
        'getGameState', 'printGameState', 'waitFor', 'showNotification',
        'getNotifications', 'getChatMessages', 'sendChatMessage',
        'startRecording', 'stopRecording', 'screenshotBurst',
        'testFlightControls', 'runAirplaneFlightTest', 'testJumpWhileWalking'
    ],
    'warp-commands': [
        'warp', 'getWarpLocations', 'warpRelative', 'warpToEntity',
        'printWarpLocations'
    ],
    'sdk-commands': [
        'sdkCreate', 'sdkSpawn', 'sdkGive', 'sdkSetBlock', 'sdkFill',
        'sdkSpawnTree', 'sdkFindInRadius', 'sdkListTypes', 'sdkGetInstances',
        'sdkTestWorkflow', 'printSdkTestResults'
    ]
};

function extractFunctionWithJSDoc(content, funcName) {
    // Find the function export
    const exportPattern = new RegExp(`(export\\s+(async\\s+)?function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{)`, 'g');
    const match = exportPattern.exec(content);

    if (!match) {
        return null;
    }

    const funcStart = match.index;

    // Find JSDoc before function (if exists)
    let jsDocStart = funcStart;
    const beforeFunc = content.substring(Math.max(0, funcStart - 500), funcStart);
    const jsDocMatch = beforeFunc.match(/\/\*\*[\s\S]*?\*\/\s*$/);

    if (jsDocMatch) {
        jsDocStart = funcStart - jsDocMatch[0].length;
    }

    // Find the end of the function by counting braces
    let braceCount = 0;
    let inFunction = false;
    let funcEnd = match.index + match[0].length;

    for (let i = match.index + match[0].length - 1; i < content.length; i++) {
        const char = content[i];
        if (char === '{') {
            if (!inFunction) inFunction = true;
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && inFunction) {
                funcEnd = i + 1;
                break;
            }
        }
    }

    return content.substring(jsDocStart, funcEnd);
}

function main() {
    const sourceFile = path.join(__dirname, 'ai-test-cli/src/game-commands.js');
    const commandsDir = path.join(__dirname, 'ai-test-cli/src/commands');

    console.log('Reading source file...');
    const content = fs.readFileSync(sourceFile, 'utf8');

    fs.mkdirSync(commandsDir, { recursive: true });

    // Process each category
    for (const [category, funcNames] of Object.entries(CATEGORIES)) {
        console.log(`\nProcessing ${category}...`);

        let categoryContent = `/**
 * ${category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
 *
 * Extracted from game-commands.js for better organization
 */

import chalk from 'chalk';

/**
 * Execute a command in the browser and return the result
 */
async function executeInBrowser(browser, fn, ...args) {
    return await browser.evaluate(fn, ...args);
}

`;

        let found = 0;
        let missing = [];

        for (const funcName of funcNames) {
            const funcCode = extractFunctionWithJSDoc(content, funcName);
            if (funcCode) {
                categoryContent += funcCode + '\n\n';
                found++;
            } else {
                missing.push(funcName);
            }
        }

        if (found > 0) {
            const outputFile = path.join(commandsDir, `${category}.js`);
            fs.writeFileSync(outputFile, categoryContent.trim() + '\n');
            console.log(`  ✅ Created ${category}.js with ${found} functions`);
        }

        if (missing.length > 0) {
            console.log(`  ⚠️  Missing: ${missing.join(', ')}`);
        }
    }

    // Create index.js
    let indexContent = `/**
 * Game Commands Index - Re-exports all command functions
 */

`;

    for (const category of Object.keys(CATEGORIES)) {
        indexContent += `export * from './${category}.js';\n`;
    }

    fs.writeFileSync(path.join(commandsDir, 'index.js'), indexContent);
    console.log('\n✅ Created index.js');
    console.log('\n✅ Refactoring complete!');
}

main();
