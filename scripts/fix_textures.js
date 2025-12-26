
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const texturesDir = path.join(projectRoot, 'public', 'textures');

if (!fs.existsSync(texturesDir)) {
    console.log(`Creating directory: ${texturesDir}`);
    fs.mkdirSync(texturesDir, { recursive: true });
}

// 1x1 PNG Base64 strings
const colors = {
    brown: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88F+rHgAGlwJ5z0C8zwAAAABJRU5ErkJggg==',
    green: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    yellow: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHzAKoFg1MmwAAAABJRU5ErkJggg=='
};

const files = [
    { name: 'duck_body.png', data: colors.brown }, // Use brown for body
    { name: 'duck_head.png', data: colors.green }, // Green for head
    { name: 'duck_beak.png', data: colors.yellow } // Yellow for beak
];

files.forEach(file => {
    const filePath = path.join(texturesDir, file.name);
    if (!fs.existsSync(filePath)) {
        console.log(`Writing ${file.name} to ${filePath}`);
        fs.writeFileSync(filePath, Buffer.from(file.data, 'base64'));
    } else {
        console.log(`Skipping ${file.name}, already exists.`);
    }
});

console.log('✅ Texture generation complete.');
