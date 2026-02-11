#!/usr/bin/env python3
"""
Script to refactor game-commands.js into modular category files
"""
import re
import os

# Category definitions: function names mapped to their categories
CATEGORIES = {
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
}

def extract_function_code(content, func_name):
    """Extract a function and its JSDoc from the file content"""
    # Pattern to match JSDoc + export function
    pattern = rf'(/\*\*[\s\S]*?\*/\s*)export\s+(async\s+)?function\s+{re.escape(func_name)}\s*\([^)]*\)\s*\{{'

    match = re.search(pattern, content)
    if not match:
        # Try without JSDoc
        pattern = rf'export\s+(async\s+)?function\s+{re.escape(func_name)}\s*\([^)]*\)\s*\{{'
        match = re.search(pattern, content)
        if not match:
            return None

    start = match.start()

    # Find the matching closing brace
    brace_count = 0
    in_function = False
    end = start

    for i in range(match.end(), len(content)):
        char = content[i]
        if char == '{':
            if not in_function:
                in_function = True
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and in_function:
                end = i + 1
                break

    if end > start:
        return content[start:end]
    return None

def read_file(filepath):
    """Read file content"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(filepath, content):
    """Write content to file"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def create_category_files(source_file, commands_dir):
    """Split the source file into category files"""

    print(f"Reading {source_file}...")
    content = read_file(source_file)

    # Extract the executeInBrowser helper function
    helper = extract_function_code(content, 'executeInBrowser')
    if helper:
        # Remove 'export' from helper
        helper = helper.replace('export ', '')

    # Process each category
    for category, func_names in CATEGORIES.items():
        print(f"\nProcessing category: {category}")

        category_content = f"""/**
 * {category.replace('-', ' ').title()} - Game commands for CLI testing
 *
 * Auto-generated from game-commands.js refactoring
 */

import chalk from 'chalk';

/**
 * Execute a command in the browser and return the result
 */
async function executeInBrowser(browser, fn, ...args) {{
    return await browser.evaluate(fn, ...args);
}}

"""

        functions_found = []
        functions_not_found = []

        for func_name in func_names:
            func_code = extract_function_code(content, func_name)
            if func_code:
                category_content += func_code + "\n\n"
                functions_found.append(func_name)
            else:
                functions_not_found.append(func_name)
                print(f"  ⚠️  Function not found: {func_name}")

        if functions_found:
            output_file = os.path.join(commands_dir, f"{category}.js")
            write_file(output_file, category_content.rstrip() + "\n")
            print(f"  ✅ Created {category}.js with {len(functions_found)} functions")

        if functions_not_found:
            print(f"  ❌ Missing {len(functions_not_found)} functions")

def create_index_file(commands_dir):
    """Create an index.js that exports all functions from all categories"""

    index_content = """/**
 * Game Commands Index - Re-exports all command functions
 *
 * This allows backward compatibility with the old game-commands.js interface
 */

"""

    for category in CATEGORIES.keys():
        index_content += f"export * from './{category}.js';\n"

    output_file = os.path.join(commands_dir, "index.js")
    write_file(output_file, index_content)
    print(f"\n✅ Created index.js")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_file = os.path.join(script_dir, "ai-test-cli/src/game-commands.js")
    commands_dir = os.path.join(script_dir, "ai-test-cli/src/commands")

    if not os.path.exists(source_file):
        print(f"❌ Source file not found: {source_file}")
        return

    os.makedirs(commands_dir, exist_ok=True)

    create_category_files(source_file, commands_dir)
    create_index_file(commands_dir)

    print("\n✅ Refactoring complete!")
    print(f"\nNext steps:")
    print(f"1. Review the generated files in {commands_dir}")
    print(f"2. Update imports in cli.js to use the new structure")
    print(f"3. Test the CLI to ensure everything works")
    print(f"4. Optionally remove or archive game-commands.js")

if __name__ == "__main__":
    main()
