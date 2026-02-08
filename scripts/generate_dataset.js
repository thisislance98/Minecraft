/**
 * Dataset Generator for Creatures and Items
 * Generates input/output pairs for training data
 *
 * Usage: node scripts/generate_dataset.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');

// Directories to scan
const ENTITIES_DIR = path.join(ROOT, 'src/game/entities/animals');
const ITEMS_DIR = path.join(ROOT, 'src/game/items');

// Input prompt templates for creatures
const CREATURE_PROMPTS = [
    (name) => `create a ${name}`,
    (name) => `make a ${name}`,
    (name) => `add a ${name} to the game`,
    (name) => `build a ${name} entity`,
    (name) => `generate a ${name}`,
    (name) => `code for a ${name}`,
    (name) => `implement a ${name}`,
    (name) => `write code for a ${name}`,
    (name) => `create ${name} creature`,
];

// Input prompt templates for items
const ITEM_PROMPTS = [
    (name) => `create a ${name}`,
    (name) => `make a ${name}`,
    (name) => `add a ${name} item`,
    (name) => `build a ${name}`,
    (name) => `implement ${name}`,
    (name) => `code for ${name}`,
    (name) => `create ${name} item`,
    (name) => `write code for ${name}`,
];

// Convert PascalCase to readable name
function toReadableName(className) {
    return className
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase();
}

// Convert PascalCase to snake_case
function toSnakeCase(className) {
    return className
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

// Files to skip (base classes, etc.)
const SKIP_FILES = [
    'Animal.js',
    'Item.js',
    'MagicalCreature.js',
    'TestBox.js',
    'TestDummy.js',
];

function scanDirectory(dir, skipFiles = []) {
    const files = [];

    if (!fs.existsSync(dir)) {
        console.warn(`Directory not found: ${dir}`);
        return files;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isFile() && item.endsWith('.js') && !skipFiles.includes(item)) {
            files.push({
                name: item,
                path: fullPath,
                className: item.replace('.js', '')
            });
        }
    }

    return files;
}

function generateDataset() {
    const dataset = [];

    // Process creatures
    console.log('Scanning creatures...');
    const creatureFiles = scanDirectory(ENTITIES_DIR, SKIP_FILES);

    for (const file of creatureFiles) {
        const code = fs.readFileSync(file.path, 'utf-8');
        const readableName = toReadableName(file.className);

        // Generate multiple input variations for each creature
        for (const promptFn of CREATURE_PROMPTS) {
            dataset.push({
                type: 'creature',
                className: file.className,
                input: promptFn(readableName),
                output: code,
            });
        }

        console.log(`  - ${file.className} (${readableName})`);
    }

    // Process items
    console.log('\nScanning items...');
    const itemFiles = scanDirectory(ITEMS_DIR, SKIP_FILES);

    for (const file of itemFiles) {
        const code = fs.readFileSync(file.path, 'utf-8');
        const readableName = toReadableName(file.className).replace(' item', '');

        // Generate multiple input variations for each item
        for (const promptFn of ITEM_PROMPTS) {
            dataset.push({
                type: 'item',
                className: file.className,
                input: promptFn(readableName),
                output: code,
            });
        }

        console.log(`  - ${file.className} (${readableName})`);
    }

    return dataset;
}

function saveDataset(dataset, format = 'jsonl') {
    const outputDir = path.join(ROOT, 'datasets');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'jsonl') {
        // JSONL format (one JSON object per line) - good for training
        const outputPath = path.join(outputDir, `creatures_items_${timestamp}.jsonl`);
        const lines = dataset.map(item => JSON.stringify({
            input: item.input,
            output: item.output,
            metadata: {
                type: item.type,
                className: item.className
            }
        }));
        fs.writeFileSync(outputPath, lines.join('\n'));
        console.log(`\nSaved JSONL dataset to: ${outputPath}`);
        return outputPath;
    } else if (format === 'json') {
        // Full JSON format
        const outputPath = path.join(outputDir, `creatures_items_${timestamp}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
        console.log(`\nSaved JSON dataset to: ${outputPath}`);
        return outputPath;
    }
}

function generateStats(dataset) {
    const creatures = dataset.filter(d => d.type === 'creature');
    const items = dataset.filter(d => d.type === 'item');

    const uniqueCreatures = new Set(creatures.map(d => d.className));
    const uniqueItems = new Set(items.map(d => d.className));

    console.log('\n=== Dataset Statistics ===');
    console.log(`Total entries: ${dataset.length}`);
    console.log(`Unique creatures: ${uniqueCreatures.size}`);
    console.log(`Unique items: ${uniqueItems.size}`);
    console.log(`Creature entries: ${creatures.length}`);
    console.log(`Item entries: ${items.length}`);

    // Calculate average code length
    const avgCodeLength = Math.round(
        dataset.reduce((sum, d) => sum + d.output.length, 0) / dataset.length
    );
    console.log(`Average code length: ${avgCodeLength} characters`);
}

// Main execution
console.log('=== Creature & Item Dataset Generator ===\n');

const dataset = generateDataset();
generateStats(dataset);

// Save as JSON only
saveDataset(dataset, 'json');

console.log('\nDone!');
