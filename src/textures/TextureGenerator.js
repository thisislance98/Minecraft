/**
 * Texture Generator Module
 * Generates procedural textures for Minecraft-style blocks
 */

function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

const palettes = {
    grass_top: ['#366620', '#427528', '#4E8530', '#5A9438'], // Darker "forest" greens
    grass_side: { grass: ['#366620', '#427528', '#4E8530'], dirt: ['#6b4423', '#7a5533', '#8B6914', '#9c7a35'] },
    dirt: ['#5a3a1a', '#6b4423', '#7a5533', '#8B6914', '#9c7a35'],
    stone: ['#5a5a5a', '#6a6a6a', '#7a7a7a', '#8a8a8a', '#9a9a9a'],
    wood_side: ['#6b4423', '#7a5533', '#8a6543', '#9a7553'],
    wood_top: ['#8a6543', '#9a7553', '#aa8563', '#ba9573'],
    leaves: ['#204010', '#2d5016', '#3a6020', '#2a4a15'], // Darker oak leaves
    birch_side: ['#e3e3e3', '#f0f0f0', '#ffffff', '#333333'], // White with dark spots
    birch_top: ['#dccfae', '#e6dabb', '#f0e6c9'],
    birch_leaves: ['#4d7b2e', '#5d8c32', '#6d9c42'], // Less neon, more natural green
    pine_side: ['#3e2723', '#4e342e', '#5d4037'], // Darker wood
    pine_top: ['#4e342e', '#5d4037', '#6d4c41'],
    pine_leaves: ['#1b5e20', '#2e7d32', '#388e3c'], // Darker, bluish green
    sand: ['#c2b280', '#d4c496', '#e6d6ac', '#d9c89e'],
    water: ['#1a5f7a', '#2980b9', '#3498db', '#5dade2'],
    brick: { brick: ['#8b4513', '#a0522d', '#b5653d'], mortar: ['#a0a0a0', '#b0b0b0'] },
    glass: ['rgba(200, 230, 255, 0.3)', 'rgba(220, 240, 255, 0.4)', 'rgba(180, 220, 250, 0.35)'],
    flower_red: { center: ['#FFD700'], petals: ['#FF0000', '#DC143C', '#B22222'] },
    flower_yellow: { center: ['#FFA500'], petals: ['#FFFF00', '#FFD700', '#F0E68C'] },
    mushroom_red: { cap: ['#FF0000', '#DC143C'], stem: ['#F5DEB3', '#FFE4C4'] },
    mushroom_brown: { cap: ['#8B4513', '#A0522D'], stem: ['#F5DEB3', '#FFE4C4'] },
    long_grass: ['#3d6b1e', '#4d7b2e', '#5d8c32'],
    fern: ['#2d5016', '#3a6020', '#4d7b2e'],
    flower_blue: { center: ['#4B0082'], petals: ['#4169E1', '#1E90FF', '#00BFFF'] },
    dead_bush: ['#8B4513', '#A0522D', '#6B4423'],
    crafting_table_top: ['#8a6543', '#5a3a1a', '#aa8563'],
    crafting_table_side: ['#6b4423', '#4e342e'],
    gold_ore: ['#FFD700', '#FFA500', '#B8860B'],
    diamond_ore: ['#00FFFF', '#00CED1', '#40E0D0'],
    iron_ore: ['#D2B48C', '#DEB887', '#F4A460'],
    coal_ore: ['#000000', '#1C1C1C', '#2F4F4F'],
    planks: ['#8a6543', '#9a7553', '#7a5533', '#6b4423'],
    painting: { frame: ['#3e2723', '#4e342e'], canvas: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0', '#c0c0c0'] },
    bed_top: { pillow: ['#ffffff', '#f0f0f0'], blanket: ['#d32f2f', '#c62828', '#b71c1c'] },
    bed_side: { wood: ['#6b4423', '#7a5533'], blanket: ['#d32f2f', '#c62828'] }
};

export function generateTexture(type, size = 16) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    let seed = type.charCodeAt(0) * 1000;

    switch (type) {
        case 'grass_top':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.grass_top[Math.floor(seededRandom(seed++) * palettes.grass_top.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;

        case 'grass_side':
            // Grass top part
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < size; x++) {
                    const depth = y + (seededRandom(seed++) > 0.6 ? 1 : 0);
                    if (depth < 3) {
                        ctx.fillStyle = palettes.grass_side.grass[Math.floor(seededRandom(seed++) * palettes.grass_side.grass.length)];
                    } else {
                        ctx.fillStyle = palettes.grass_side.dirt[Math.floor(seededRandom(seed++) * palettes.grass_side.dirt.length)];
                    }
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Dirt bottom part
            for (let y = 4; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.grass_side.dirt[Math.floor(seededRandom(seed++) * palettes.grass_side.dirt.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;

        case 'dirt':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.dirt[Math.floor(seededRandom(seed++) * palettes.dirt.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;

        case 'stone':
        case 'gold_ore':
        case 'diamond_ore':
        case 'iron_ore':
        case 'coal_ore':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    const patchNoise = seededRandom(Math.floor(x / 3) * 100 + Math.floor(y / 3));
                    const combined = (noise + patchNoise) / 2;
                    ctx.fillStyle = palettes.stone[Math.floor(combined * palettes.stone.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }

            // Draw Ore Specks
            if (type !== 'stone') {
                const orePalette = palettes[type];
                for (let i = 0; i < 12; i++) {
                    const rx = Math.floor(seededRandom(seed++) * size);
                    const ry = Math.floor(seededRandom(seed++) * size);
                    const w = 1 + Math.floor(seededRandom(seed++) * 2);
                    const h = 1 + Math.floor(seededRandom(seed++) * 2);
                    ctx.fillStyle = orePalette[Math.floor(seededRandom(seed++) * orePalette.length)];
                    ctx.fillRect(rx, ry, w, h);
                }
            }
            break;

        case 'wood_side':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Vertical wood grain
                    const grainOffset = Math.floor(x / 4);
                    const colorIdx = (grainOffset + Math.floor(seededRandom(seed++) * 2)) % palettes.wood_side.length;
                    ctx.fillStyle = palettes.wood_side[colorIdx];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;

        case 'wood_top':
        case 'birch_top':
        case 'pine_top': {
            // Wood rings
            const palette = palettes[type];
            const cx = size / 2, cy = size / 2;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                    const ring = Math.floor(dist / 2) % palette.length;
                    ctx.fillStyle = palette[ring];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'birch_side':
            // White background
            ctx.fillStyle = palettes.birch_side[0];
            ctx.fillRect(0, 0, size, size);
            // Random dark spots
            for (let i = 0; i < 10; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                ctx.fillStyle = '#333333';
                ctx.fillRect(rx, ry, Math.random() > 0.5 ? 2 : 1, 1);
            }
            break;

        case 'pine_side':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Vertical wood grain
                    const grainOffset = Math.floor(x / 4);
                    const colorIdx = (grainOffset + Math.floor(seededRandom(seed++) * 2)) % palettes.pine_side.length;
                    ctx.fillStyle = palettes.pine_side[colorIdx];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;

        case 'leaves':
        case 'birch_leaves':
        case 'pine_leaves': {
            const palette = palettes[type];
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (seededRandom(seed++) > 0.15) {
                        ctx.fillStyle = palette[Math.floor(seededRandom(seed++) * palette.length)];
                    } else {
                        ctx.fillStyle = 'rgba(0,0,0,0)';
                    }
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'sand':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.sand[Math.floor(seededRandom(seed++) * palettes.sand.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;

        case 'water':
            ctx.fillStyle = '#2980b9';
            ctx.fillRect(0, 0, size, size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (seededRandom(seed++) > 0.7) {
                        ctx.fillStyle = palettes.water[Math.floor(seededRandom(seed++) * palettes.water.length)];
                        ctx.globalAlpha = 0.5;
                        ctx.fillRect(x, y, 1, 1);
                        ctx.globalAlpha = 1;
                    }
                }
            }
            break;

        case 'brick':
            ctx.fillStyle = '#a0a0a0';
            ctx.fillRect(0, 0, size, size);
            // Draw bricks
            for (let row = 0; row < 4; row++) {
                const offset = row % 2 === 0 ? 0 : 4;
                for (let col = 0; col < 2; col++) {
                    const bx = col * 8 + offset;
                    const by = row * 4;
                    ctx.fillStyle = palettes.brick.brick[Math.floor(seededRandom(seed++) * palettes.brick.brick.length)];
                    ctx.fillRect(bx % size, by, 7, 3);
                }
            }
            break;

        case 'glass':
            ctx.fillStyle = 'rgba(200, 230, 255, 0.3)';
            ctx.fillRect(0, 0, size, size);
            // Glass frame
            ctx.fillStyle = 'rgba(150, 200, 230, 0.5)';
            ctx.fillRect(0, 0, size, 1);
            ctx.fillRect(0, size - 1, size, 1);
            ctx.fillRect(0, 0, 1, size);
            ctx.fillRect(size - 1, 0, 1, size);
            // Shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(2, 2, 3, 3);
            break;

        case 'flower_red':
        case 'flower_yellow':
            // Transparent background
            ctx.clearRect(0, 0, size, size);
            // Stem
            ctx.fillStyle = '#228B22';
            ctx.fillRect(7, 8, 2, 8);
            // Leaves
            ctx.fillRect(5, 12, 2, 1);
            ctx.fillRect(9, 11, 2, 1);

            // Flower Head
            const fPalette = palettes[type];
            // Petals
            ctx.fillStyle = fPalette.petals[0];
            ctx.fillRect(6, 2, 4, 4); // Center-ish
            ctx.fillRect(4, 4, 8, 4);
            ctx.fillRect(6, 8, 4, 2);

            // Center
            ctx.fillStyle = fPalette.center[0];
            ctx.fillRect(7, 5, 2, 2);
            break;

        case 'mushroom_red':
        case 'mushroom_brown':
            ctx.clearRect(0, 0, size, size);
            const mPalette = palettes[type];
            // Stem
            ctx.fillStyle = mPalette.stem[0];
            ctx.fillRect(6, 8, 4, 8);
            // Cap
            ctx.fillStyle = mPalette.cap[0];
            ctx.fillRect(4, 4, 8, 4);
            ctx.fillRect(5, 3, 6, 1);

            // Dots for red mushroom
            if (type === 'mushroom_red') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(5, 5, 1, 1);
                ctx.fillRect(9, 6, 1, 1);
                ctx.fillRect(7, 4, 1, 1);
            }
            break;

        case 'long_grass':
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = palettes.long_grass[0];
            // Draw a few blades
            for (let i = 0; i < 5; i++) {
                const h = 6 + Math.floor(seededRandom(seed++) * 8);
                const x = 2 + Math.floor(seededRandom(seed++) * 12);
                ctx.fillRect(x, size - h, 1, h);
            }
            break;

        case 'fern':
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = palettes.fern[0];
            // Fern shape: wider at bottom, tapered
            for (let y = 4; y < size; y++) {
                const w = Math.floor((y - 2) * 0.8);
                const startX = 8 - w / 2;
                ctx.fillRect(startX, y, w, 1);
            }
            break;

        case 'flower_blue':
            // Similar to other flowers but blue
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = '#228B22'; // Stem
            ctx.fillRect(7, 8, 2, 8);

            const bPalette = palettes[type];
            ctx.fillStyle = bPalette.petals[0];

            // Orchid shape?
            ctx.fillRect(5, 3, 6, 6);
            ctx.fillRect(6, 2, 4, 8);

            ctx.fillStyle = bPalette.center[0];
            ctx.fillRect(7, 5, 2, 3);
            break;

        case 'dead_bush':
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = palettes.dead_bush[0];
            // Dry branches
            ctx.fillRect(7, 10, 2, 6); // Stem
            // Branches
            ctx.fillRect(5, 8, 2, 4);
            ctx.fillRect(9, 9, 2, 3);
            ctx.fillRect(4, 6, 1, 3);
            ctx.fillRect(11, 7, 1, 3);
            break;

        case 'crafting_table_top':
            // Wood background
            ctx.fillStyle = palettes.crafting_table_top[0];
            ctx.fillRect(0, 0, size, size);
            // Grid lines (saw, hammer, grid items)
            ctx.fillStyle = palettes.crafting_table_top[1];
            ctx.fillRect(2, 2, 12, 12); // Inner dark
            ctx.fillStyle = palettes.crafting_table_top[2];
            ctx.fillRect(3, 3, 4, 4); // Grid slot
            ctx.fillRect(8, 3, 4, 4); // Grid slot
            ctx.fillRect(3, 8, 4, 4); // Grid slot
            ctx.fillRect(8, 8, 4, 4); // Grid slot
            break;

        case 'crafting_table_side':
            // Wood side with tools hanging maybe?
            ctx.fillStyle = palettes.crafting_table_top[0];
            ctx.fillRect(0, 0, size, size);
            // Darker panel
            ctx.fillStyle = palettes.crafting_table_side[1];
            ctx.fillRect(2, 2, 12, 12);
            // Simple cross brace
            ctx.fillStyle = palettes.crafting_table_side[0];
            ctx.fillRect(4, 8, 8, 1);
            ctx.fillRect(4, 4, 1, 8);
            ctx.fillRect(11, 4, 1, 8);
            break;

        case 'break_stage_0':
        case 'break_stage_1':
        case 'break_stage_2':
        case 'break_stage_3':
        case 'break_stage_4':
        case 'break_stage_5':
        case 'break_stage_6':
        case 'break_stage_7':
        case 'break_stage_8':
        case 'break_stage_9': {
            ctx.clearRect(0, 0, size, size);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; // More transparent
            ctx.lineWidth = 1; // Thinner lines
            const stage = parseInt(type.split('_')[2]);
            const numLines = (stage + 1) * 1.5; // Fewer lines

            // Fixed seed for consistent cracks per stage
            let crackSeed = stage * 12345;
            for (let i = 0; i < numLines; i++) {
                ctx.beginPath();
                const x1 = seededRandom(crackSeed++) * size;
                const y1 = seededRandom(crackSeed++) * size;
                const x2 = seededRandom(crackSeed++) * size;
                const y2 = seededRandom(crackSeed++) * size;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            break;
        }

        case 'planks': {
            const palette = palettes.planks;
            // Floor planks look (horizontal or vertical lines)
            ctx.fillStyle = palette[0];
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = palette[3];
            // Plank lines
            for (let i = 0; i < size; i += 4) {
                ctx.fillRect(0, i, size, 1);
            }
            // Vertical separators (staggered)
            ctx.fillStyle = palette[2];
            for (let i = 0; i < size; i += 4) {
                const offset = (i % 8 === 0) ? 4 : 0;
                for (let j = 0; j < size; j += 8) {
                    ctx.fillRect((j + offset) % size, i, 1, 4);
                }
            }
            break;
        }

        case 'painting': {
            const { frame, canvas } = palettes.painting;
            // Frame
            ctx.fillStyle = frame[0];
            ctx.fillRect(0, 0, size, size);
            // Canvas
            ctx.fillStyle = canvas[0];
            ctx.fillRect(1, 1, size - 2, size - 2);
            // Random "art" specks
            for (let i = 0; i < 15; i++) {
                ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
                ctx.fillRect(2 + Math.random() * (size - 4), 2 + Math.random() * (size - 4), 1 + Math.random() * 2, 1 + Math.random() * 2);
            }
            break;
        }

        case 'bed_top': {
            const { pillow, blanket } = palettes.bed_top;
            // Blanket area
            ctx.fillStyle = blanket[0];
            ctx.fillRect(0, 0, size, size);
            // Pillow area (top part)
            ctx.fillStyle = pillow[0];
            ctx.fillRect(0, 0, size, 4);
            // Nuance
            ctx.fillStyle = pillow[1];
            ctx.fillRect(1, 1, size - 2, 2);
            break;
        }

        case 'bed_side': {
            const { wood, blanket } = palettes.bed_side;
            // Wood base
            ctx.fillStyle = wood[0];
            ctx.fillRect(0, 8, size, 8);
            // Blanket top
            ctx.fillStyle = blanket[0];
            ctx.fillRect(0, 4, size, 4);
            // Nuance
            ctx.fillStyle = wood[1];
            ctx.fillRect(0, 14, size, 2);
            break;
        }
    }

    return canvas;
}

export function generateHotbarIcons() {
    const blocks = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'water', 'brick', 'glass'];
    blocks.forEach(block => {
        const canvas = document.getElementById(`slot-${block}`);
        if (canvas) {
            canvas.width = 16;
            canvas.height = 16;
            const ctx = canvas.getContext('2d');
            let texType = block;
            if (block === 'grass') texType = 'grass_top';
            if (block === 'wood') texType = 'wood_side';
            const tex = generateTexture(texType);
            ctx.drawImage(tex, 0, 0);
        }
    });
}
