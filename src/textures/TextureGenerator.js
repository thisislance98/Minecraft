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
    // Dark Oak - Very dark, almost charred look
    dark_oak_side: ['#2a1a0a', '#3a2815', '#251508', '#1f1005'], // Very dark brown bark
    dark_oak_top: ['#3a2815', '#4a3520', '#2a1a0a'], // Dark brown rings
    dark_oak_leaves: ['#0f2a0f', '#1a3a1a', '#0a200a', '#152f15'], // Very dark green, almost black-green
    // Willow - Grayish, droopy appearance
    willow_side: ['#6b5c54', '#7a6b63', '#8a7b73', '#5a4b43'], // Grayish brown bark
    willow_top: ['#8a7b73', '#9a8b83', '#7a6b63'], // Light gray-tan rings
    willow_leaves: ['#7ba05d', '#8ab06d', '#9ac07d', '#6a9050'], // Light yellow-green
    // Acacia - Orange/terracotta savanna look
    acacia_side: ['#a04820', '#b05830', '#904018', '#c06838'], // Orange-red/terracotta bark
    acacia_top: ['#b08050', '#c09060', '#a07040'], // Tan/orange rings
    acacia_leaves: ['#8ab040', '#9ac050', '#7aa030', '#aad060'], // Yellow-green savanna leaves
    sand: ['#c2b280', '#d4c496', '#e6d6ac', '#d9c89e'],
    water: ['#1a5f7a', '#2980b9', '#3498db', '#5dade2'],
    brick: { brick: ['#8b4513', '#a0522d', '#b5653d'], mortar: ['#a0a0a0', '#b0b0b0'] },
    glass: ['rgba(200, 230, 255, 0.3)', 'rgba(220, 240, 255, 0.4)', 'rgba(180, 220, 250, 0.35)'],
    slime: ['rgba(100, 255, 100, 0.6)', 'rgba(120, 255, 120, 0.7)', 'rgba(80, 230, 80, 0.65)'],
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
    bed_top: { pillow: ['#ffffff', '#f0f0f0'], blanket: ['#d32f2f', '#c62828', '#b71c1c'] },
    bed_side: { wood: ['#6b4423', '#7a5533'], blanket: ['#d32f2f', '#c62828'] },
    stone_brick: ['#696969', '#757575', '#575757'], // Darker gray bricks
    bookshelf: {
        wood: ['#8a6543', '#6b4423', '#5c4033'],
        pages: ['#f0f0f0', '#e0e0e0', '#dcdcdc'],
        covers: [
            '#8B0000', // Dark Red
            '#00008B', // Dark Blue
            '#006400', // Dark Green
            '#4B0082', // Indigo
            '#2F4F4F', // Dark Slate Gray
            '#8B4513', // Saddle Brown
            '#000000', // Black
            '#556B2F', // Dark Olive Green
            '#800000', // Maroon
            '#191970', // Midnight Blue
            '#704214', // Sepia/Dark Brown
            '#36454F', // Charcoal
            '#301934', // Dark Purple
        ],
        details: ['#FFD700', '#C0C0C0', '#B0C4DE'], // Gold, Silver, Light Metallic
        labels: ['#F5F5DC', '#FFF8DC', '#D3D3D3'] // Beige, Cornsilk, Light Gray
    },
    book_red: {
        wood: ['#8a6543', '#6b4423', '#5c4033'],
        covers: ['#8B0000', '#800000', '#A52A2A', '#B22222', '#CD5C5C', '#DC143C'],
        details: ['#FFD700', '#C0C0C0'],
        labels: ['#F5F5DC', '#FFF8DC']
    },
    book_blue: {
        wood: ['#8a6543', '#6b4423', '#5c4033'],
        covers: ['#00008B', '#191970', '#000080', '#1E3A5F', '#2F4F4F', '#483D8B'],
        details: ['#FFD700', '#C0C0C0'],
        labels: ['#F5F5DC', '#FFF8DC']
    },
    book_green: {
        wood: ['#8a6543', '#6b4423', '#5c4033'],
        covers: ['#006400', '#228B22', '#2E8B57', '#556B2F', '#3CB371', '#0B3D0B'],
        details: ['#FFD700', '#C0C0C0'],
        labels: ['#F5F5DC', '#FFF8DC']
    },
    book_brown: {
        wood: ['#8a6543', '#6b4423', '#5c4033'],
        covers: ['#8B4513', '#A0522D', '#704214', '#5C4033', '#6B4423', '#8B5A2B'],
        details: ['#FFD700', '#C0C0C0'],
        labels: ['#F5F5DC', '#FFF8DC']
    },
    book_purple: {
        wood: ['#8a6543', '#6b4423', '#5c4033'],
        covers: ['#4B0082', '#301934', '#483D8B', '#663399', '#800080', '#551A8B'],
        details: ['#FFD700', '#C0C0C0'],
        labels: ['#F5F5DC', '#FFF8DC']
    },
    book_mixed: {
        wood: ['#8a6543', '#6b4423', '#5c4033'],
        covers: ['#8B0000', '#00008B', '#006400', '#4B0082', '#8B4513', '#2F4F4F', '#800000', '#191970'],
        details: ['#FFD700', '#C0C0C0', '#B0C4DE'],
        labels: ['#F5F5DC', '#FFF8DC', '#D3D3D3']
    },
    gold_block: ['#FFD700', '#FFC107', '#FFEA00', '#FDD835'],
    tapestry: ['#880E4F', '#AD1457', '#C2185B'], // Deep reds/purples
    trampoline_top: ['#2E8B57', '#3CB371', '#228B22'], // SeaGreen, MediumSeaGreen, ForestGreen
    trampoline_side: ['#2F4F4F', '#4682B4', '#2E8B57'], // DarkSlateGray (frame), SteelBlue/Green
    snow: ['#FFFFFF', '#F0F8FF', '#E8E8E8', '#F5F5F5'], // Various shades of white
    door_closed: { wood: ['#8B4513', '#A0522D'], handle: ['#C0C0C0', '#808080'] }, // Wood door with handle
    door_open: { frame: ['#8B4513', '#A0522D'] }, // Just the frame
    // New building blocks
    cobblestone: ['#555555', '#666666', '#777777', '#4a4a4a', '#888888'],
    roof_tiles: ['#8B0000', '#A52A2A', '#CD5C5C', '#B22222'],
    chimney_brick: ['#4a2513', '#5a3520', '#6a4530', '#3a1a10'],
    window_frame: { frame: ['#5C4033', '#4a3020'], glass: ['rgba(200, 230, 255, 0.4)'] },
    fence: ['#8B4513', '#A0522D', '#6B4423'],
    shingles: ['#2F4F4F', '#3a5a5a', '#456565', '#1a3a3a'],
    polished_stone: ['#8a8a8a', '#9a9a9a', '#aaaaaa', '#bababa'],
    dark_planks: ['#3e2723', '#4e342e', '#2c1e18', '#5d4037'],
    white_plaster: ['#F5F5DC', '#FAEBD7', '#FAF0E6', '#FFFAF0'],
    terracotta: ['#CD853F', '#D2691E', '#B8860B', '#DEB887'],
    thatch: ['#D4A574', '#C4956A', '#E5B584', '#B4854A'],
    half_timber: { wood: ['#3e2723', '#4e342e'], plaster: ['#F5F5DC', '#FAEBD7'] },
    mossy_stone: ['#555555', '#666666', '#777777'],
    iron_bars: ['#4a4a4a', '#5a5a5a', '#6a6a6a'],
    // Survival Block (skull/danger theme)
    survival_block: { base: ['#2a1a1a', '#3a2020', '#1a0f0f'], skull: ['#d0d0d0', '#e8e8e8'], danger: ['#ff3333', '#cc2222'] },
    // Animal Textures
    penguin_black: ['#111111', '#1a1a1a', '#0a0a0a'],
    penguin_white: ['#FFFFFF', '#F0F0F0', '#E8E8E8'],
    penguin_beak: ['#FFA500', '#FF8C00', '#FFB732'],
    lampost_metal: ['#222222', '#2a2a2a', '#1a1a1a', '#333333'], // Dark iron
    lampost_glass: ['#FFFFE0', '#FFFACD', '#FFFFF0'], // Warm white
    maze_block: ['#2e003e', '#3a004d', '#4b0064', '#1a0024'], // Dark purple mystic look
    obsidian: ['#1a101f', '#20122e', '#24143a', '#15091a'], // Very dark purple/black

    diamond_block: ['#00FFFF', '#00CED1', '#40E0D0', '#E0FFFF'],
    control_block: { base: ['#4169E1', '#1E90FF', '#0000CD'], glow: ['#00FFFF', '#7FFFD4'], arrows: '#FFFFFF' }, // Royal blue with cyan glow and white arrows
    xbox: { base: ['#0e0e0e', '#1a1a1a', '#222222'], logo: ['#107c10', '#107c10', '#107c10'], light: ['#ffffff', '#aaffaa'] },
    parkour_block: { base: ['#ff00ff', '#800080', '#4b0082'], glow: ['#00ffff', '#00ffcc'], trim: ['#ffffff'] },
    parkour_platform: ['#444444', '#555555', '#333333', '#666666'], // Grey stone look
    playground_block: { primary: '#FFD700', secondary: '#4169E1', accent: '#DC143C' }, // Yellow, Blue, Red
    slide_block: '#FF4500', // Orange-Red plastic
    mob_waves_block: { base: ['#0f0f0f', '#1a1a1a'], wave: '#ff0000', accent: '#800000' },
    cactus: ['#2E8B57', '#006400', '#556B2F'], // SeaGreen, DarkGreen, DarkOliveGreen

    // Enterprise Palettes
    enterprise_hull: ['#E3E3E3', '#D0D0D0', '#C0C0C0', '#F0F0F0'], // Smooth pearl white/grey
    enterprise_floor: ['#A0A0A0', '#909090', '#B0B0B0'], // Darker grey floor
    enterprise_engine: ['#404040', '#505050', '#303030'], // Dark mechanical
    enterprise_dish: { center: ['#B8860B', '#DAA520'], ring: ['#00FFFF', '#00CED1'] }, // Copper/Gold and Cyan
    enterprise_nacelle: { front: ['#FF4500', '#FF0000', '#FFA500'], side: ['#0000FF', '#4169E1', '#00BFFF'] }, // Red/Orange and Blue glow
    // Bridge Palettes
    enterprise_panel: ['#202020', '#FF9900', '#9933FF', '#3366FF'], // Dark grey bg, LCARS colors (Orange/Purple/Blue)
    enterprise_screen: ['#000000', '#FFFFFF', '#00FF00'], // Black, stars
    enterprise_console: ['#404040', '#A0A0A0', '#00FFFF'], // Console grey with cyan interface
    enterprise_chair: ['#800000', '#303030'], // Dark Red, Black base

    // Ring Space Station Palettes
    station_hull: ['#4A5568', '#2D3748', '#1A202C', '#718096'], // Dark blue-grey metal
    station_ring: ['#2B6CB0', '#3182CE', '#4299E1', '#63B3ED'], // Blue glowing ring
    station_window: ['rgba(0, 191, 255, 0.4)', 'rgba(100, 200, 255, 0.5)'], // Cyan tinted glass
    station_core: ['#1E40AF', '#3B82F6', '#60A5FA', '#FFFFFF'], // Bright blue energy core
    station_light: ['#F0FFF4', '#C6F6D5', '#9AE6B4'], // Soft green lights
    station_floor: ['#374151', '#4B5563', '#6B7280'], // Dark grey floor panels
    station_console: ['#1E293B', '#00FFFF', '#06B6D4', '#0EA5E9'], // Dark with cyan interface

    // ===== ALIEN WORLD PALETTES =====

    // Crystal World
    crystal_ground: ['#6B4C9A', '#7B5AAA', '#5A3C8A', '#8A6ABA'], // Purple crystalline ground
    crystal_stone: ['#8844AA', '#9955BB', '#7733AA', '#AA66CC'], // Deep purple stone
    crystal_shard: ['#CC88FF', '#DD99FF', '#BB77EE', '#EECCFF'], // Glowing crystal
    crystal_glow: ['#FF88FF', '#FFAAFF', '#FF66FF', '#FFCCFF'], // Bright glow
    crystal_plant: ['#AA55DD', '#BB66EE', '#9944CC', '#CC77FF'], // Crystal vegetation

    // Lava World
    obsidite_ground: ['#221100', '#331111', '#110800', '#442211'], // Dark volcanic ground
    magma_stone: ['#442211', '#553322', '#332211', '#554433'], // Hot stone
    cooled_lava: ['#111111', '#1a1a1a', '#0a0a0a', '#222222'], // Cooled lava rock
    ember_block: ['#FF4400', '#FF6600', '#FF2200', '#FF8800'], // Glowing ember
    fire_plant: ['#FF6600', '#FF8800', '#FF4400', '#FFAA00'], // Fire vegetation

    // Soccer World (Rocket League style arena)
    soccer_field: ['#1E8449', '#27AE60', '#196F3D', '#2ECC71'], // Vibrant soccer grass
    soccer_line: ['#FFFFFF', '#F8F8F8', '#F0F0F0', '#FFFFFF'], // White line markings
    soccer_wall: ['#3498DB', '#5DADE2', '#2980B9', '#85C1E9'], // Blue transparent arena wall
    soccer_goal_frame: ['#F1C40F', '#F4D03F', '#D4AC0D', '#F7DC6F'], // Yellow goal frame
    soccer_goal_net: ['#FDFEFE', '#F8F9F9', '#F4F6F6', '#FFFFFF'] // White net
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
                    const noise = seededRandom(seed++);
                    // Base green
                    let colorIdx = Math.floor(noise * palettes.grass_top.length);

                    // Simple "blade" attempt: occasional lighter pixels
                    if (noise > 0.8) {
                        // Pick the lightest color
                        colorIdx = Math.max(0, palettes.grass_top.length - 1);
                    } else if (noise < 0.2) {
                        // Darker patches
                        colorIdx = 0;
                    }

                    ctx.fillStyle = palettes.grass_top[colorIdx];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add some "noise specks" for texture
            for (let i = 0; i < size * 2; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                ctx.fillStyle = palettes.grass_top[Math.floor(seededRandom(seed++) * palettes.grass_top.length)];
                ctx.fillRect(rx, ry, 1, 1);
            }
            break;

        case 'grass_side':
            // Grass top part with uneven "drips"
            for (let x = 0; x < size; x++) {
                // Random depth for the grass layer on the side (2 to 5 pixels)
                const grassDepth = 3 + Math.floor(seededRandom(seed++) * 3);

                for (let y = 0; y < size; y++) {
                    if (y < grassDepth) {
                        // Use grass palette
                        ctx.fillStyle = palettes.grass_side.grass[Math.floor(seededRandom(seed++) * palettes.grass_side.grass.length)];
                    } else {
                        // Use dirt palette
                        ctx.fillStyle = palettes.grass_side.dirt[Math.floor(seededRandom(seed++) * palettes.grass_side.dirt.length)];
                    }
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add specific dirt specks in the dirt area
            for (let i = 0; i < 10; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = 6 + Math.floor(seededRandom(seed++) * (size - 6));
                if (ry < size) {
                    ctx.fillStyle = palettes.dirt[Math.floor(seededRandom(seed++) * 2)]; // Darker dirt bits
                    ctx.fillRect(rx, ry, 1, 1);
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

        case 'slime':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.slime[Math.floor(seededRandom(seed++) * palettes.slime.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add a darker inner core effect
            ctx.fillStyle = 'rgba(50, 180, 50, 0.8)';
            ctx.fillRect(size * 0.25, size * 0.25, size * 0.5, size * 0.5);
            break;

        case 'obsidian':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    ctx.fillStyle = palettes.obsidian[Math.floor(noise * palettes.obsidian.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add purple crystalline specks
            for (let i = 0; i < 8; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                ctx.fillStyle = '#4a256a';
                ctx.fillRect(rx, ry, 1, 1);
            }
            break;



        case 'parkour_block': {
            const { base, glow, trim } = palettes.parkour_block;
            // Base neon purple/magenta
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = base[Math.floor(seededRandom(seed++) * base.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Glowing neon borders
            ctx.fillStyle = glow[0];
            ctx.fillRect(0, 0, size, 1);
            ctx.fillRect(0, size - 1, size, 1);
            ctx.fillRect(0, 0, 1, size);
            ctx.fillRect(size - 1, 0, 1, size);

            // X emblem or crosshair in center
            ctx.fillStyle = trim[0];
            ctx.fillRect(7, 3, 2, 10);
            ctx.fillRect(3, 7, 10, 2);

            // Secondary glow dots
            ctx.fillStyle = glow[1];
            ctx.fillRect(2, 2, 2, 2);
            ctx.fillRect(12, 2, 2, 2);
            ctx.fillRect(2, 12, 2, 2);
            ctx.fillRect(12, 12, 2, 2);
            break;
        }

        case 'parkour_platform': {
            const colors = palettes.parkour_platform;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = colors[Math.floor(seededRandom(seed++) * colors.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add a subtle border
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
            break;
        }
            break;

        case 'playground_block': {
            const { primary, secondary, accent } = palettes.playground_block;

            // Ensure opaque background first
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);

            // Four square pattern
            const half = size / 2;

            ctx.fillStyle = primary;
            ctx.fillRect(0, 0, half, half);
            ctx.fillStyle = secondary;
            ctx.fillRect(half, 0, half, half);
            ctx.fillStyle = accent;
            ctx.fillRect(0, half, half, half);
            ctx.fillStyle = primary;
            ctx.fillRect(half, half, half, half);

            // Border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            // Stroke inside the canvas to avoid clipping or alpha bleeding
            ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
            break;
        }

        case 'slide_block': {
            ctx.fillStyle = palettes.slide_block;
            ctx.fillRect(0, 0, size, size);

            // Glossy highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(2, 2, size - 4, 2);
            ctx.fillRect(2, 4, 2, size - 8);

            // Border
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
            break;
        }

        case 'mob_waves_block': {
            const { base, wave, accent } = palettes.mob_waves_block;
            // Dark base
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = base[Math.floor(seededRandom(seed++) * base.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }

            // Draw Sine Wave symbol
            ctx.fillStyle = wave;
            for (let x = 2; x < size - 2; x++) {
                // simple sine: y = A * sin(B * x) + C
                // Map x (2..14) to phase
                const phase = (x - 2) / (size - 4) * Math.PI * 2;
                const yOffset = Math.sin(phase) * 3;
                const y = Math.floor((size / 2) + yOffset);

                ctx.fillRect(x, y, 1, 2); // thickness 2
            }

            // Corner accents
            ctx.fillStyle = accent;
            ctx.fillRect(0, 0, 3, 3);
            ctx.fillRect(size - 3, 0, 3, 3);
            ctx.fillRect(0, size - 3, 3, 3);
            ctx.fillRect(size - 3, size - 3, 3, 3);
            break;
        }

        case 'diamond_block':
            ctx.fillStyle = palettes.diamond_block[0];
            ctx.fillRect(0, 0, size, size);
            // Shiny border
            ctx.fillStyle = palettes.diamond_block[1];
            ctx.fillRect(0, 0, size, 2);
            ctx.fillRect(0, 0, 2, size);
            ctx.fillStyle = palettes.diamond_block[2];
            ctx.fillRect(0, size - 2, size, 2);
            ctx.fillRect(size - 2, 0, 2, size);
            // Center shine
            ctx.fillStyle = palettes.diamond_block[3];
            ctx.fillRect(4, 4, 8, 8);
            break;

        case 'control_block': {
            // Base gradient fill
            const gradient = ctx.createLinearGradient(0, 0, size, size);
            gradient.addColorStop(0, palettes.control_block.base[0]);
            gradient.addColorStop(0.5, palettes.control_block.base[1]);
            gradient.addColorStop(1, palettes.control_block.base[2]);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Glowing border
            ctx.fillStyle = palettes.control_block.glow[0];
            ctx.fillRect(0, 0, size, 2);
            ctx.fillRect(0, 0, 2, size);
            ctx.fillRect(0, size - 2, size, 2);
            ctx.fillRect(size - 2, 0, 2, size);

            // Arrow indicators (showing all directions)
            ctx.fillStyle = palettes.control_block.arrows;
            const center = size / 2;
            // Up arrow
            ctx.fillRect(center - 1, 2, 2, 3);
            // Down arrow
            ctx.fillRect(center - 1, size - 5, 2, 3);
            // Left arrow
            ctx.fillRect(2, center - 1, 3, 2);
            // Right arrow
            ctx.fillRect(size - 5, center - 1, 3, 2);

            // Center glow dot
            ctx.fillStyle = palettes.control_block.glow[1];
            ctx.fillRect(center - 2, center - 2, 4, 4);
            break;
        }

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
        case 'pine_top':
        case 'dark_oak_top':
        case 'willow_top':
        case 'acacia_top': {
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
        case 'dark_oak_side':
        case 'willow_side':
        case 'acacia_side':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Vertical wood grain
                    const grainOffset = Math.floor(x / 4);
                    const woodPalette = palettes[type] || palettes.pine_side;
                    const colorIdx = (grainOffset + Math.floor(seededRandom(seed++) * 2)) % woodPalette.length;
                    ctx.fillStyle = woodPalette[colorIdx];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;

        case 'leaves':
        case 'birch_leaves':
        case 'pine_leaves':
        case 'dark_oak_leaves':
        case 'willow_leaves':
        case 'acacia_leaves': {
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

        case 'stone_brick':
            ctx.fillStyle = '#696969';
            ctx.fillRect(0, 0, size, size); // Ensure opaque background
            // Draw bricks (similar to brick but gray palette)
            for (let row = 0; row < 4; row++) {
                const offset = row % 2 === 0 ? 0 : 4;
                for (let col = 0; col < 2; col++) {
                    const bx = col * 8 + offset;
                    const by = row * 4;
                    ctx.fillStyle = palettes.stone_brick[Math.floor(seededRandom(seed++) * palettes.stone_brick.length)];
                    ctx.fillRect(bx % size, by, 7, 3);
                    // Mortar implicit by background
                }
            }
            break;

        case 'bookshelf': {
            const { wood, covers, details, labels } = palettes.bookshelf;

            // 1. Draw Wood Background (Shadowed inside the shelf)
            ctx.fillStyle = wood[2] || '#5c4033'; // Darkest wood for back panel
            ctx.fillRect(0, 0, size, size);

            // 2. Draw Shelves
            const shelfColor = wood[0];
            const shelfShadow = wood[1];

            const drawShelf = (y) => {
                ctx.fillStyle = shelfColor;
                ctx.fillRect(0, y, size, 2);
                ctx.fillStyle = shelfShadow;
                ctx.fillRect(0, y + 1, size, 1);
            };

            drawShelf(0);
            drawShelf(7);
            drawShelf(14);

            // 3. Draw Books with VARIETY
            const rows = [2, 9];

            rows.forEach(baseY => {
                let x = 1;
                while (x < size - 1) {
                    // Randomize book width (2 to 3 pixels mostly, rare 4)
                    const width = 2 + Math.floor(seededRandom(seed++) * 2.5);
                    if (x + width > size - 1) break;

                    // Height variation
                    const height = 3 + Math.floor(seededRandom(seed++) * 3); // 3, 4, 5
                    const y = baseY + (5 - height);

                    // Choose cover color
                    const coverColor = covers[Math.floor(seededRandom(seed++) * covers.length)];
                    ctx.fillStyle = coverColor;
                    ctx.fillRect(x, y, width, height);

                    // Spine Shading (Cylindrical effect)
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(x, y, 1, height); // Shadow on left edge
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(x + width - 1, y, 1, height); // Highlight on right edge

                    // --- SPINE DETAILS ---
                    const spineType = Math.floor(seededRandom(seed++) * 4); // 0-3

                    // Type 0: Banded (Gold/Silver bands)
                    if (spineType === 0) {
                        const detailColor = details[Math.floor(seededRandom(seed++) * details.length)];
                        ctx.fillStyle = detailColor;
                        const bandY = y + 1 + Math.floor(seededRandom(seed++) * (height - 2));
                        ctx.fillRect(x, bandY, width, 1);
                        if (height > 4) { // Second band for tall books
                            ctx.fillRect(x, bandY + 2, width, 1);
                        }
                    }
                    // Type 1: Labeled (Paper label)
                    else if (spineType === 1 && width >= 2) {
                        const labelColor = labels[Math.floor(seededRandom(seed++) * labels.length)];
                        ctx.fillStyle = labelColor;
                        const labelY = y + height - 2; // Near bottom
                        ctx.fillRect(x + 1, labelY, width - 2, 1);
                    }
                    // Type 2: Titled (Vertical line text hint)
                    else if (spineType === 2 && height >= 4) {
                        ctx.fillStyle = 'rgba(255,235,59,0.7)'; // Yellowish text
                        // Draw a vertical dotted line or just a strip
                        ctx.fillRect(x + Math.floor(width / 2), y + 1, 1, height - 2);
                    }
                    // Type 3: Standard / Worn
                    else {
                        // Maybe some noise/wear
                        if (seededRandom(seed++) > 0.5) {
                            ctx.fillStyle = 'rgba(255,255,255,0.1)';
                            ctx.fillRect(x, y + 1, 1, 1); // Worn top corner
                        }
                    }

                    x += width + Math.floor(seededRandom(seed++) * 1.2); // Random gap
                }
            });
            break;
        }

        case 'book_red':
        case 'book_blue':
        case 'book_green':
        case 'book_brown':
        case 'book_purple':
        case 'book_mixed': {
            const palette = palettes[type];
            const { wood, covers, details, labels } = palette;

            // 1. Draw Wood Background
            ctx.fillStyle = wood[2] || '#5c4033';
            ctx.fillRect(0, 0, size, size);

            // 2. Draw Shelves
            const shelfColor = wood[0];
            const shelfShadow = wood[1];

            const drawShelf = (y) => {
                ctx.fillStyle = shelfColor;
                ctx.fillRect(0, y, size, 2);
                ctx.fillStyle = shelfShadow;
                ctx.fillRect(0, y + 1, size, 1);
            };

            drawShelf(0);
            drawShelf(7);
            drawShelf(14);

            // 3. Draw Books with VARIETY
            const rows = [2, 9];

            rows.forEach(baseY => {
                let x = 1;
                while (x < size - 1) {
                    const width = 2 + Math.floor(seededRandom(seed++) * 2.5);
                    if (x + width > size - 1) break;

                    const height = 3 + Math.floor(seededRandom(seed++) * 3);
                    const y = baseY + (5 - height);

                    const coverColor = covers[Math.floor(seededRandom(seed++) * covers.length)];
                    ctx.fillStyle = coverColor;
                    ctx.fillRect(x, y, width, height);

                    // Spine Shading
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(x, y, 1, height);
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(x + width - 1, y, 1, height);

                    // Spine Details
                    const spineType = Math.floor(seededRandom(seed++) * 4);

                    if (spineType === 0) {
                        const detailColor = details[Math.floor(seededRandom(seed++) * details.length)];
                        ctx.fillStyle = detailColor;
                        const bandY = y + 1 + Math.floor(seededRandom(seed++) * (height - 2));
                        ctx.fillRect(x, bandY, width, 1);
                        if (height > 4) {
                            ctx.fillRect(x, bandY + 2, width, 1);
                        }
                    } else if (spineType === 1 && width >= 2) {
                        const labelColor = labels[Math.floor(seededRandom(seed++) * labels.length)];
                        ctx.fillStyle = labelColor;
                        const labelY = y + height - 2;
                        ctx.fillRect(x + 1, labelY, width - 2, 1);
                    } else if (spineType === 2 && height >= 4) {
                        ctx.fillStyle = 'rgba(255,235,59,0.7)';
                        ctx.fillRect(x + Math.floor(width / 2), y + 1, 1, height - 2);
                    } else {
                        if (seededRandom(seed++) > 0.5) {
                            ctx.fillStyle = 'rgba(255,255,255,0.1)';
                            ctx.fillRect(x, y + 1, 1, 1);
                        }
                    }

                    x += width + Math.floor(seededRandom(seed++) * 1.2);
                }
            });
            break;
        }

        case 'gold_block':
            ctx.fillStyle = palettes.gold_block[0];
            ctx.fillRect(0, 0, size, size);
            // Shiny border
            ctx.fillStyle = palettes.gold_block[1];
            ctx.fillRect(0, 0, size, 2);
            ctx.fillRect(0, 0, 2, size);
            ctx.fillStyle = palettes.gold_block[2];
            ctx.fillRect(0, size - 2, size, 2);
            ctx.fillRect(size - 2, 0, 2, size);
            // Center shine
            ctx.fillStyle = palettes.gold_block[3];
            ctx.fillRect(4, 4, 8, 8);
            break;

        case 'tapestry': {
            // Woven pattern
            const colors = palettes.tapestry;
            ctx.fillStyle = colors[0];
            ctx.fillRect(0, 0, size, size);
            // Simple pattern
            ctx.fillStyle = colors[1];
            ctx.fillRect(4, 4, 8, 8);
            ctx.fillStyle = colors[2];
            ctx.fillRect(6, 6, 4, 4);
            break;
        }

        // --- Enterprise Textures ---

        case 'enterprise_hull':
            // Smooth metal with panel lines
            const hullPalette = palettes.enterprise_hull;
            ctx.fillStyle = hullPalette[0];
            ctx.fillRect(0, 0, size, size);

            // Random subtle noise
            for (let i = 0; i < size * size; i++) {
                if (seededRandom(seed++) > 0.8) {
                    const x = i % size;
                    const y = Math.floor(i / size);
                    ctx.fillStyle = hullPalette[Math.floor(seededRandom(seed++) * hullPalette.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }

            // Panel lines (subtle)
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
            if (seededRandom(seed++) > 0.5) {
                ctx.beginPath();
                ctx.moveTo(size / 2, 0);
                ctx.lineTo(size / 2, size);
                ctx.stroke();
            }
            break;

        case 'enterprise_floor':
            const floorPalette = palettes.enterprise_floor;
            ctx.fillStyle = floorPalette[0];
            ctx.fillRect(0, 0, size, size);
            // Grid pattern
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, size, size);
            ctx.fillStyle = floorPalette[1];
            ctx.fillRect(2, 2, size - 4, size - 4);
            break;

        case 'enterprise_engine':
            const engPalette = palettes.enterprise_engine;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = engPalette[Math.floor(seededRandom(seed++) * engPalette.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Pipes or vents
            ctx.fillStyle = '#202020';
            ctx.fillRect(4, 0, 2, size);
            ctx.fillRect(10, 0, 2, size);
            break;

        case 'enterprise_dish_center':
            ctx.fillStyle = palettes.enterprise_dish.center[0];
            ctx.fillRect(0, 0, size, size);
            // Concentric circles (approx)
            ctx.fillStyle = palettes.enterprise_dish.center[1];
            ctx.fillRect(4, 4, 8, 8);
            ctx.fillStyle = '#DDDD00'; // Bright center
            ctx.fillRect(7, 7, 2, 2);
            break;

        case 'enterprise_dish_ring':
            ctx.fillStyle = palettes.enterprise_dish.ring[0];
            ctx.fillRect(0, 0, size, size);
            // Glowing effect
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(2, 2, size - 4, size - 4);
            break;

        case 'enterprise_nacelle_front': // Bussard
            const bussard = palettes.enterprise_nacelle.front;
            // Swirling red/orange
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const n = seededRandom(seed++);
                    ctx.fillStyle = bussard[Math.floor(n * bussard.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Glow center
            ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
            ctx.fillRect(4, 4, 8, 8);
            break;

        case 'enterprise_nacelle_side': // Warp field
            const warp = palettes.enterprise_nacelle.side;
            ctx.fillStyle = '#000033'; // Dark blue base
            ctx.fillRect(0, 0, size, size);
            // Horizontal glowing lines
            for (let y = 2; y < size; y += 4) {
                ctx.fillStyle = warp[Math.floor(seededRandom(seed++) * warp.length)];
                ctx.fillRect(0, y, size, 2);
            }
            break;

        case 'enterprise_panel':
            // LCARS style: Dark background, Colored bars
            const lcars = palettes.enterprise_panel;
            ctx.fillStyle = lcars[0]; // Dark BG
            ctx.fillRect(0, 0, size, size);

            // Side bar
            ctx.fillStyle = lcars[1]; // Orange
            ctx.fillRect(0, 0, 4, size);
            // Curve top
            ctx.fillRect(4, 0, size - 4, 4);

            // Random buttons/rectangles
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = lcars[Math.floor(seededRandom(seed++) * (lcars.length - 1)) + 1];
                let rx = 6 + Math.floor(seededRandom(seed++) * (size - 8));
                let ry = 6 + Math.floor(seededRandom(seed++) * (size - 8));
                let rw = 4 + Math.floor(seededRandom(seed++) * 8);
                let rh = 2 + Math.floor(seededRandom(seed++) * 4);
                ctx.fillRect(rx, ry, rw, rh);
            }
            break;

        case 'enterprise_screen':
            // Viewscreen: Black with stars
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, size, size);
            // Stars
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 10; i++) {
                if (seededRandom(seed++) > 0.5) {
                    ctx.fillRect(seededRandom(seed++) * size, seededRandom(seed++) * size, 1, 1);
                }
            }
            break;

        case 'enterprise_console':
            // Angled interface visualization
            ctx.fillStyle = palettes.enterprise_console[0];
            ctx.fillRect(0, 0, size, size);
            // Cyan Grid
            ctx.strokeStyle = palettes.enterprise_console[2];
            ctx.lineWidth = 1;
            ctx.strokeRect(2, 2, size - 4, size - 4);
            // Buttons
            ctx.fillStyle = palettes.enterprise_console[1];
            ctx.fillRect(4, 4, 4, 4);
            ctx.fillRect(10, 4, 4, 4);
            ctx.fillRect(4, 10, 8, 4);
            break;

        case 'enterprise_chair':
            // Leather/Fabric texture
            ctx.fillStyle = palettes.enterprise_chair[0];
            ctx.fillRect(0, 0, size, size);
            // Shading
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0, size - 4, size, 4); // Base shadow
            break;

        // --- Ring Space Station Textures ---
        case 'station_hull': {
            const stationHull = palettes.station_hull;
            ctx.fillStyle = stationHull[0];
            ctx.fillRect(0, 0, size, size);
            // Metallic noise
            for (let i = 0; i < size * size; i++) {
                if (seededRandom(seed++) > 0.75) {
                    const x = i % size;
                    const y = Math.floor(i / size);
                    ctx.fillStyle = stationHull[Math.floor(seededRandom(seed++) * stationHull.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Panel lines
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
            ctx.beginPath();
            ctx.moveTo(0, size / 2);
            ctx.lineTo(size, size / 2);
            ctx.stroke();
            break;
        }

        case 'station_ring': {
            const ringPalette = palettes.station_ring;
            // Glowing blue ring sections
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const n = seededRandom(seed++);
                    ctx.fillStyle = ringPalette[Math.floor(n * ringPalette.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Glow effect
            ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
            ctx.fillRect(2, 2, size - 4, size - 4);
            break;
        }

        case 'station_window':
            ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
            ctx.fillRect(0, 0, size, size);
            // Window frame
            ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
            ctx.fillRect(0, 0, size, 1);
            ctx.fillRect(0, size - 1, size, 1);
            ctx.fillRect(0, 0, 1, size);
            ctx.fillRect(size - 1, 0, 1, size);
            // Shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(2, 2, 4, 4);
            break;

        case 'station_core': {
            const corePalette = palettes.station_core;
            // Energy core - pulsing blue
            ctx.fillStyle = corePalette[0];
            ctx.fillRect(0, 0, size, size);
            // Inner glow
            ctx.fillStyle = corePalette[1];
            ctx.fillRect(3, 3, size - 6, size - 6);
            ctx.fillStyle = corePalette[2];
            ctx.fillRect(5, 5, size - 10, size - 10);
            // Bright center
            ctx.fillStyle = corePalette[3];
            ctx.fillRect(7, 7, 2, 2);
            break;
        }

        case 'station_light': {
            const lightPalette = palettes.station_light;
            ctx.fillStyle = lightPalette[0];
            ctx.fillRect(0, 0, size, size);
            // Soft glow pattern
            ctx.fillStyle = lightPalette[1];
            ctx.fillRect(2, 2, size - 4, size - 4);
            break;
        }

        case 'station_floor': {
            const floorPalette = palettes.station_floor;
            ctx.fillStyle = floorPalette[0];
            ctx.fillRect(0, 0, size, size);
            // Grid pattern
            ctx.strokeStyle = '#1F2937';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, size, size);
            ctx.fillStyle = floorPalette[1];
            ctx.fillRect(2, 2, size - 4, size - 4);
            break;
        }

        case 'station_console': {
            const consolePalette = palettes.station_console;
            ctx.fillStyle = consolePalette[0];
            ctx.fillRect(0, 0, size, size);
            // Cyan interface elements
            ctx.fillStyle = consolePalette[1];
            ctx.fillRect(2, 2, 4, 3);
            ctx.fillRect(8, 2, 6, 3);
            ctx.fillStyle = consolePalette[2];
            ctx.fillRect(2, 7, 12, 2);
            ctx.fillStyle = consolePalette[3];
            ctx.fillRect(4, 11, 8, 3);
            break;
        }


        case 'levitation_wand':
        case 'wand':
        case 'shrink_wand':
        case 'wizard_tower_wand':
            ctx.clearRect(0, 0, size, size);
            // Stick
            ctx.fillStyle = '#8B4513';
            // Draw diagonal stick
            for (let i = 0; i < 10; i++) {
                ctx.fillRect(i + 4, size - (i + 4), 2, 2);
            }
            // Tip
            if (type === 'levitation_wand') ctx.fillStyle = '#00FFFF'; // Cyan
            else if (type === 'shrink_wand') ctx.fillStyle = '#00FF00'; // Green
            else if (type === 'wizard_tower_wand') ctx.fillStyle = '#8A2BE2'; // BlueViolet
            else ctx.fillStyle = '#FF00FF'; // Magenta

            // Draw tip at top right
            ctx.fillRect(11, 2, 4, 4);
            ctx.fillRect(12, 3, 2, 2);
            break;

        case 'trampoline_top':
            // Dark frame
            ctx.fillStyle = '#2F4F4F';
            ctx.fillRect(0, 0, size, size);
            // Bouncy center (Green mesh)
            ctx.fillStyle = palettes.trampoline_top[0];
            ctx.fillRect(2, 2, size - 4, size - 4);
            // Mesh pattern
            ctx.fillStyle = palettes.trampoline_top[1];
            for (let i = 2; i < size - 2; i += 2) {
                ctx.fillRect(i, 2, 1, size - 4);
                ctx.fillRect(2, i, size - 4, 1);
            }
            // Center target (Bullseye-ish)
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(7, 7, 2, 2);
            ctx.globalAlpha = 1.0;
            break;

        case 'trampoline_side':
            // Frame look
            ctx.fillStyle = palettes.trampoline_side[0]; // Dark frame
            ctx.fillRect(0, 0, size, size);
            // Detail (Side of the mesh)
            ctx.fillStyle = palettes.trampoline_side[2]; // Greenish side
            ctx.fillRect(2, 4, size - 4, 4);
            // Legs/Supports?
            ctx.fillStyle = '#111111';
            ctx.fillRect(2, 12, 1, 4);
            ctx.fillRect(13, 12, 1, 4);
            break;

        case 'snow':
            // White snow with subtle variations
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.snow[Math.floor(seededRandom(seed++) * palettes.snow.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add some sparkle/shine
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 8; i++) {
                const sx = Math.floor(seededRandom(seed++) * size);
                const sy = Math.floor(seededRandom(seed++) * size);
                ctx.fillRect(sx, sy, 1, 1);
            }
            break;

        case 'door_closed': {
            const { wood, handle } = palettes.door_closed;
            // Background
            ctx.fillStyle = wood[0];
            ctx.fillRect(0, 0, size, size);
            // Panels
            ctx.fillStyle = wood[1];
            ctx.fillRect(2, 2, 5, 5);
            ctx.fillRect(9, 2, 5, 5);
            ctx.fillRect(2, 9, 5, 5);
            ctx.fillRect(9, 9, 5, 5);
            // Handle
            ctx.fillStyle = handle[0];
            ctx.fillRect(12, 8, 2, 2);
            break;
        }

        case 'door_open': {
            const { frame } = palettes.door_open;
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = frame[0];
            // Frame only
            ctx.fillRect(0, 0, 2, size); // Left
            ctx.fillRect(size - 2, 0, 2, size); // Right
            ctx.fillRect(0, 0, size, 2); // Top
            // Optional: Threshold?
            break;
        }

        case 'cobblestone': {
            // Irregular stone pattern
            ctx.fillStyle = '#5a5a5a';
            ctx.fillRect(0, 0, size, size);
            const cobbleColors = palettes.cobblestone;
            for (let i = 0; i < 20; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                const w = 2 + Math.floor(seededRandom(seed++) * 4);
                const h = 2 + Math.floor(seededRandom(seed++) * 4);
                ctx.fillStyle = cobbleColors[Math.floor(seededRandom(seed++) * cobbleColors.length)];
                ctx.fillRect(rx, ry, w, h);
            }
            break;
        }

        case 'roof_tiles': {
            // Overlapping roof tiles pattern
            ctx.fillStyle = palettes.roof_tiles[0];
            ctx.fillRect(0, 0, size, size);
            for (let row = 0; row < 4; row++) {
                const offset = row % 2 === 0 ? 0 : 4;
                for (let col = 0; col < 2; col++) {
                    const bx = col * 8 + offset;
                    const by = row * 4;
                    ctx.fillStyle = palettes.roof_tiles[Math.floor(seededRandom(seed++) * palettes.roof_tiles.length)];
                    ctx.beginPath();
                    ctx.fillRect(bx % size, by, 7, 3);
                    // Add shadow for 3D effect
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(bx % size, by + 3, 7, 1);
                }
            }
            break;
        }

        case 'chimney_brick': {
            // Darker brick pattern
            ctx.fillStyle = '#3a1a10';
            ctx.fillRect(0, 0, size, size);
            for (let row = 0; row < 4; row++) {
                const offset = row % 2 === 0 ? 0 : 4;
                for (let col = 0; col < 2; col++) {
                    const bx = col * 8 + offset;
                    const by = row * 4;
                    ctx.fillStyle = palettes.chimney_brick[Math.floor(seededRandom(seed++) * palettes.chimney_brick.length)];
                    ctx.fillRect(bx % size, by, 7, 3);
                }
            }
            break;
        }

        case 'window_frame': {
            const { frame, glass } = palettes.window_frame;
            // Frame
            ctx.fillStyle = frame[0];
            ctx.fillRect(0, 0, size, size);
            // Glass panes (2x2 grid)
            ctx.fillStyle = glass[0];
            ctx.fillRect(2, 2, 5, 5);
            ctx.fillRect(9, 2, 5, 5);
            ctx.fillRect(2, 9, 5, 5);
            ctx.fillRect(9, 9, 5, 5);
            // Shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(3, 3, 2, 2);
            ctx.fillRect(10, 3, 2, 2);
            break;
        }

        case 'fence': {
            // Solid wood planks pattern using fence palette
            const palette = palettes.fence;
            ctx.fillStyle = palette[0];
            ctx.fillRect(0, 0, size, size);
            // Vertical grain like wood_side
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const grainOffset = Math.floor(x / 4);
                    const colorIdx = (grainOffset + Math.floor(seededRandom(seed++) * 2)) % palette.length;
                    ctx.fillStyle = palette[colorIdx];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'shingles': {
            // Slate roof shingles
            ctx.fillStyle = palettes.shingles[0];
            ctx.fillRect(0, 0, size, size);
            for (let row = 0; row < 8; row++) {
                const offset = row % 2 === 0 ? 0 : 2;
                for (let col = 0; col < 4; col++) {
                    const bx = col * 4 + offset;
                    const by = row * 2;
                    ctx.fillStyle = palettes.shingles[Math.floor(seededRandom(seed++) * palettes.shingles.length)];
                    ctx.fillRect(bx % size, by, 3, 2);
                }
            }
            break;
        }

        case 'polished_stone': {
            // Smooth polished stone
            ctx.fillStyle = palettes.polished_stone[0];
            ctx.fillRect(0, 0, size, size);
            // Subtle shine lines
            ctx.fillStyle = palettes.polished_stone[3];
            ctx.fillRect(0, 0, size, 1);
            ctx.fillRect(0, 0, 1, size);
            break;
        }

        case 'maze_block': {
            // Dark mystical pattern with shifting runes concept (static for now)
            ctx.fillStyle = palettes.maze_block[0];
            ctx.fillRect(0, 0, size, size);

            // Abstract geometric patterns
            ctx.fillStyle = palettes.maze_block[2];
            for (let i = 0; i < 5; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                const w = 2 + Math.floor(seededRandom(seed++) * 6);
                const h = 1;
                ctx.fillRect(rx, ry, w, h);
                ctx.fillRect(rx + 1, ry - 1, w - 2, 1);
                ctx.fillRect(rx + 1, ry + 1, w - 2, 1);
            }

            // Glowing center eye?
            ctx.fillStyle = '#ff00ff';
            ctx.globalAlpha = 0.3;
            ctx.fillRect(6, 6, 4, 4);
            ctx.globalAlpha = 1.0;
            break;
        }

        case 'dark_planks': {
            const palette = palettes.dark_planks;
            ctx.fillStyle = palette[0];
            ctx.fillRect(0, 0, size, size);
            // darker grain
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const grainOffset = Math.floor(x / 4);
                    const colorIdx = (grainOffset + Math.floor(seededRandom(seed++) * 2)) % palette.length;
                    ctx.fillStyle = palette[colorIdx];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'penguin_black':
        case 'penguin_white':
        case 'penguin_beak':
        case 'lampost_metal': {
            // Generic noise texture for these
            const palette = palettes[type];
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palette[Math.floor(seededRandom(seed++) * palette.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'lampost_glass': {
            const palette = palettes.lampost_glass;
            ctx.fillStyle = palette[0];
            ctx.fillRect(0, 0, size, size);
            // Glow center
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(4, 4, 8, 8);
            ctx.globalAlpha = 1.0;
            break;
        }


        case 'white_plaster': {
            // Stucco/plaster texture
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.white_plaster[Math.floor(seededRandom(seed++) * palettes.white_plaster.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'terracotta': {
            // Clay/terracotta texture
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.terracotta[Math.floor(seededRandom(seed++) * palettes.terracotta.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'thatch': {
            // Straw/thatch roof texture
            ctx.fillStyle = palettes.thatch[0];
            ctx.fillRect(0, 0, size, size);
            // Horizontal straw lines
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (seededRandom(seed++) > 0.5) {
                        ctx.fillStyle = palettes.thatch[Math.floor(seededRandom(seed++) * palettes.thatch.length)];
                        ctx.fillRect(x, y, 2, 1);
                    }
                }
            }
            break;
        }

        case 'half_timber': {
            const { wood, plaster } = palettes.half_timber;
            // Plaster background
            ctx.fillStyle = plaster[0];
            ctx.fillRect(0, 0, size, size);
            // Timber frame
            ctx.fillStyle = wood[0];
            // Horizontal beams
            ctx.fillRect(0, 0, size, 2);
            ctx.fillRect(0, size - 2, size, 2);
            // Vertical beams
            ctx.fillRect(0, 0, 2, size);
            ctx.fillRect(size - 2, 0, 2, size);
            // Diagonal brace
            ctx.fillStyle = wood[1];
            for (let i = 0; i < size - 4; i++) {
                ctx.fillRect(2 + i, 2 + i, 2, 2);
            }
            break;
        }

        case 'mossy_stone': {
            // Stone with moss patches
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    const patchNoise = seededRandom(Math.floor(x / 3) * 100 + Math.floor(y / 3));
                    const combined = (noise + patchNoise) / 2;
                    ctx.fillStyle = palettes.mossy_stone[Math.floor(combined * palettes.mossy_stone.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add moss patches
            ctx.fillStyle = '#3a5a3a';
            for (let i = 0; i < 8; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                ctx.fillRect(rx, ry, 2, 2);
            }
            break;
        }

        case 'iron_bars': {
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = palettes.iron_bars[0];
            // Vertical bars
            ctx.fillRect(3, 0, 2, size);
            ctx.fillRect(7, 0, 2, size);
            ctx.fillRect(11, 0, 2, size);
            // Horizontal connectors
            ctx.fillStyle = palettes.iron_bars[1];
            ctx.fillRect(0, 4, size, 1);
            ctx.fillRect(0, 11, size, 1);
            break;
        }

        case 'survival_block': {
            const { base, skull, danger } = palettes.survival_block;
            // Dark base
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = base[Math.floor(seededRandom(seed++) * base.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Danger border
            ctx.fillStyle = danger[0];
            ctx.fillRect(0, 0, size, 2);
            ctx.fillRect(0, size - 2, size, 2);
            ctx.fillRect(0, 0, 2, size);
            ctx.fillRect(size - 2, 0, 2, size);
            // Skull icon (simplified)
            ctx.fillStyle = skull[0];
            // Skull head
            ctx.fillRect(5, 4, 6, 5);
            ctx.fillRect(6, 3, 4, 1);
            // Eye sockets
            ctx.fillStyle = '#000000';
            ctx.fillRect(6, 5, 2, 2);
            ctx.fillRect(9, 5, 2, 2);
            // Nose
            ctx.fillRect(8, 7, 1, 1);
            // Teeth
            ctx.fillStyle = skull[0];
            ctx.fillRect(6, 9, 5, 2);
            ctx.fillStyle = '#000000';
            ctx.fillRect(7, 9, 1, 2);
            ctx.fillRect(9, 9, 1, 2);
            // Timer/hourglass below
            ctx.fillStyle = danger[1];
            ctx.fillRect(6, 12, 4, 1);
            ctx.fillRect(7, 13, 2, 1);
            ctx.fillRect(6, 14, 4, 1);
            break;
        }

        case 'xbox_top':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.xbox.base[Math.floor(seededRandom(seed++) * palettes.xbox.base.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Large circular vent/logo in middle
            ctx.fillStyle = '#107c10';
            ctx.beginPath();
            ctx.arc(8, 8, 4, 0, Math.PI * 2);
            ctx.fill();
            // The "X"
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(6, 6); ctx.lineTo(10, 10);
            ctx.moveTo(10, 6); ctx.lineTo(6, 10);
            ctx.stroke();
            break;

        case 'xbox_front':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.xbox.base[Math.floor(seededRandom(seed++) * palettes.xbox.base.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Power button
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(12, 4, 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Disc slot
            ctx.fillStyle = '#000000';
            ctx.fillRect(2, 8, 12, 1);
            break;

        case 'xbox_side':
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    ctx.fillStyle = palettes.xbox.base[Math.floor(seededRandom(seed++) * palettes.xbox.base.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Small vent holes
            ctx.fillStyle = '#000000';
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    ctx.fillRect(2 + i * 3, 2 + j * 3, 1, 1);
                }
            }
            break;

        case 'disco_room_block': {
            // Funky colorful noise
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const r = Math.floor(seededRandom(seed++) * 255);
                    const g = Math.floor(seededRandom(seed++) * 255);
                    const b = Math.floor(seededRandom(seed++) * 255);
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Border
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
            break;
        }

        case 'disco_ball': {
            // Shiny mirrored facets
            ctx.fillStyle = '#C0C0C0'; // Silver base
            ctx.fillRect(0, 0, size, size);

            for (let i = 0; i < size; i += 2) {
                for (let j = 0; j < size; j += 2) {
                    // Random light reflection
                    const val = 150 + Math.floor(seededRandom(seed++) * 105);
                    ctx.fillStyle = `rgb(${val},${val},${val})`;
                    ctx.fillRect(i, j, 2, 2);
                }
            }
            break;
        }

        case 'cactus_side': {
            const colors = palettes.cactus;
            ctx.fillStyle = colors[1]; // Dark base
            ctx.fillRect(0, 0, size, size);
            // Vertical ribs
            ctx.fillStyle = colors[0];
            for (let i = 2; i < size; i += 4) {
                ctx.fillRect(i, 0, 2, size);
            }
            // Spines
            ctx.fillStyle = '#F0E68C'; // Khaki
            for (let y = 3; y < size; y += 4) {
                for (let x = 1; x < size; x += 4) {
                    if (seededRandom(seed++) > 0.3) {
                        ctx.fillRect(x, y, 2, 1);
                    }
                }
            }
            break;
        }

        case 'cactus_top': {
            const colors = palettes.cactus;
            ctx.fillStyle = colors[0];
            ctx.fillRect(0, 0, size, size);
            // Rings or dots
            ctx.fillStyle = colors[1];
            for (let i = 0; i < size; i += 2) {
                for (let j = 0; j < size; j += 2) {
                    if ((i + j) % 4 === 0) ctx.fillRect(i, j, 1, 1);
                }
            }
            break;
        }

        // ===== CRYSTAL WORLD BLOCKS =====

        case 'crystal_ground': {
            const colors = palettes.crystal_ground;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    ctx.fillStyle = colors[Math.floor(noise * colors.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add crystalline specks
            ctx.fillStyle = '#CC88FF';
            for (let i = 0; i < 8; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                ctx.fillRect(rx, ry, 1, 1);
            }
            break;
        }

        case 'crystal_stone': {
            const colors = palettes.crystal_stone;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    ctx.fillStyle = colors[Math.floor(noise * colors.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'crystal_shard': {
            ctx.clearRect(0, 0, size, size);
            const colors = palettes.crystal_shard;
            // Draw crystal shape (tall, narrow)
            ctx.fillStyle = colors[0];
            ctx.fillRect(6, 2, 4, 12);
            ctx.fillStyle = colors[1];
            ctx.fillRect(7, 1, 2, 14);
            ctx.fillStyle = colors[2];
            ctx.fillRect(5, 4, 2, 8);
            ctx.fillRect(9, 4, 2, 8);
            // Bright highlight
            ctx.fillStyle = colors[3];
            ctx.fillRect(7, 3, 1, 6);
            break;
        }

        case 'crystal_glow': {
            const colors = palettes.crystal_glow;
            ctx.fillStyle = colors[0];
            ctx.fillRect(0, 0, size, size);
            // Pulsing center
            ctx.fillStyle = colors[3];
            ctx.fillRect(4, 4, 8, 8);
            ctx.fillStyle = colors[2];
            ctx.fillRect(5, 5, 6, 6);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(6, 6, 4, 4);
            break;
        }

        case 'crystal_plant': {
            ctx.clearRect(0, 0, size, size);
            const colors = palettes.crystal_plant;
            // Crystal plant stalks
            ctx.fillStyle = colors[0];
            ctx.fillRect(7, 6, 2, 10);
            ctx.fillStyle = colors[1];
            ctx.fillRect(4, 4, 2, 8);
            ctx.fillRect(10, 5, 2, 7);
            // Tips
            ctx.fillStyle = colors[3];
            ctx.fillRect(7, 4, 2, 2);
            ctx.fillRect(4, 2, 2, 2);
            ctx.fillRect(10, 3, 2, 2);
            break;
        }

        // ===== LAVA WORLD BLOCKS =====

        case 'obsidite_ground': {
            const colors = palettes.obsidite_ground;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    ctx.fillStyle = colors[Math.floor(noise * colors.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add orange lava veins
            ctx.fillStyle = '#FF4400';
            for (let i = 0; i < 5; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                ctx.fillRect(rx, ry, 1, 1);
            }
            break;
        }

        case 'magma_stone': {
            const colors = palettes.magma_stone;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    ctx.fillStyle = colors[Math.floor(noise * colors.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add glowing cracks
            ctx.fillStyle = '#FF6600';
            for (let i = 0; i < 12; i++) {
                const rx = Math.floor(seededRandom(seed++) * size);
                const ry = Math.floor(seededRandom(seed++) * size);
                ctx.fillRect(rx, ry, 1, 1);
            }
            break;
        }

        case 'cooled_lava': {
            const colors = palettes.cooled_lava;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const noise = seededRandom(seed++);
                    ctx.fillStyle = colors[Math.floor(noise * colors.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'ember_block': {
            const colors = palettes.ember_block;
            ctx.fillStyle = colors[2];
            ctx.fillRect(0, 0, size, size);
            // Glowing ember pattern
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (seededRandom(seed++) > 0.6) {
                        ctx.fillStyle = colors[Math.floor(seededRandom(seed++) * colors.length)];
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
            // Bright center
            ctx.fillStyle = '#FFAA00';
            ctx.fillRect(5, 5, 6, 6);
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(6, 6, 4, 4);
            break;
        }

        case 'fire_plant': {
            ctx.clearRect(0, 0, size, size);
            const colors = palettes.fire_plant;
            // Flame-like plant
            ctx.fillStyle = colors[0];
            ctx.fillRect(7, 8, 2, 8);
            ctx.fillStyle = colors[1];
            ctx.fillRect(6, 6, 4, 4);
            ctx.fillRect(5, 4, 6, 2);
            ctx.fillStyle = colors[3];
            ctx.fillRect(7, 2, 2, 4);
            // Flame tips
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(7, 1, 2, 2);
            ctx.fillRect(5, 3, 2, 2);
            ctx.fillRect(9, 3, 2, 2);
            break;
        }

        // ===== SOCCER WORLD BLOCKS =====

        case 'soccer_field': {
            const colors = palettes.soccer_field;
            // Striped grass pattern like real soccer fields
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const stripe = Math.floor(x / 4) % 2;
                    const noise = seededRandom(seed++) * 0.3;
                    const baseIdx = stripe === 0 ? 0 : 1;
                    ctx.fillStyle = colors[baseIdx + (noise > 0.2 ? 1 : 0)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            break;
        }

        case 'soccer_line': {
            const colors = palettes.soccer_line;
            ctx.fillStyle = colors[0];
            ctx.fillRect(0, 0, size, size);
            // Add slight texture
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (seededRandom(seed++) > 0.9) {
                        ctx.fillStyle = colors[2];
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
            break;
        }

        case 'soccer_wall': {
            const colors = palettes.soccer_wall;
            // Translucent blue wall with panel effect
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const panel = ((x < 2 || x > 13) || (y < 2 || y > 13)) ? 2 : 0;
                    const noise = seededRandom(seed++);
                    ctx.fillStyle = colors[panel + (noise > 0.7 ? 1 : 0)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            // Add highlight edge
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.3;
            ctx.fillRect(0, 0, size, 1);
            ctx.fillRect(0, 0, 1, size);
            ctx.globalAlpha = 1.0;
            break;
        }

        case 'soccer_goal_frame': {
            const colors = palettes.soccer_goal_frame;
            ctx.fillStyle = colors[0];
            ctx.fillRect(0, 0, size, size);
            // Metallic highlight
            ctx.fillStyle = colors[3];
            ctx.fillRect(2, 0, 4, size);
            ctx.fillStyle = colors[1];
            ctx.fillRect(4, 0, 2, size);
            // Add some depth texture
            for (let y = 0; y < size; y++) {
                if (seededRandom(seed++) > 0.8) {
                    ctx.fillStyle = colors[2];
                    ctx.fillRect(0, y, size, 1);
                }
            }
            break;
        }

        case 'soccer_goal_net': {
            ctx.clearRect(0, 0, size, size);
            // Net mesh pattern
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            // Horizontal lines
            for (let y = 0; y < size; y += 3) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(size, y);
                ctx.stroke();
            }
            // Vertical lines
            for (let x = 0; x < size; x += 3) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, size);
                ctx.stroke();
            }
            break;
        }

        default:
            // Fallback: Generate a visible debug texture (magenta/pink checkered)
            // This makes missing textures obvious rather than pure black
            console.warn(`TextureGenerator: Unknown texture type '${type}', using fallback`);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Checkered magenta/pink pattern
                    const isLight = (x + y) % 2 === 0;
                    ctx.fillStyle = isLight ? '#FF00FF' : '#FF69B4';
                    ctx.fillRect(x, y, 1, 1);
                }
            }


            break;
    }
    return canvas;
}

export function generateHotbarIcons() {
    const blocks = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'water', 'brick', 'glass', 'stone_brick', 'bookshelf', 'door_closed', 'playground_block', 'disco_room_block', 'control_block'];
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
