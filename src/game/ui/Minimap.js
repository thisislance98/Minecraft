
import * as THREE from 'three';
import { Blocks } from '../core/Blocks.js';

export class Minimap {
    constructor(game) {
        this.game = game;
        this.size = 180; // Slightly larger
        this.expandedSize = 400;
        this.isExpanded = false;
        this.visible = true; // Visibility state

        // Configuration
        this.zoom = 1;
        this.range = 64; // Block radius to show

        this.initDOM();
        this.startLoop();
    }

    initDOM() {
        // Container
        this.container = document.createElement('div');
        this.container.id = 'minimap-container';
        this.container.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            width: ${this.size}px;
            height: ${this.size}px;
            border: 4px solid rgba(0, 0, 0, 0.5);
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.5); // Translucent background
            overflow: hidden;
            z-index: 1000;
            transition: all 0.3s ease;
            cursor: pointer;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        `;

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d', { alpha: true });

        // Events
        this.container.addEventListener('click', (e) => this.toggleExpand(e));

        // Add to document
        document.body.appendChild(this.container);
    }

    toggleVisibility() {
        this.setVisible(!this.visible);
    }

    setVisible(visible) {
        this.visible = visible;
        this.container.style.display = this.visible ? 'block' : 'none';
    }

    toggleExpand(e) {
        this.isExpanded = !this.isExpanded;
        const s = this.isExpanded ? this.expandedSize : this.size;
        this.container.style.width = `${s}px`;
        this.container.style.height = `${s}px`;
        this.container.style.borderRadius = this.isExpanded ? '10px' : '50%';
        this.canvas.width = s;
        this.canvas.height = s;

        if (this.isExpanded) {
            // Move to center or just expand in place?
            // User requested bottom left. Let's keep it bottom left but maybe move it up a bit if it expands too much?
            // Default expansion in corner is fine.
        } else {
            // Reset range/zoom if we changed it
        }
    }

    startLoop() {
        this.animate = this.animate.bind(this);
        this._lastDrawTime = 0;
        requestAnimationFrame(this.animate);
    }

    animate(timestamp) {
        // Run loop
        requestAnimationFrame(this.animate);

        // PERFORMANCE: Only redraw every 200ms (5 FPS) - minimap doesn't need 60 FPS
        if (timestamp - this._lastDrawTime < 200) return;
        this._lastDrawTime = timestamp;

        this.draw();
    }

    draw() {
        if (!this.game.player || !this.visible) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear
        ctx.clearRect(0, 0, width, height);
        // Fill properly with translucent black if needed, but CSS handles background.
        // However, we want the map content to be somewhat opaque or translucent?
        // User asked for "minimap should be translucent".
        // Let's make the canvas clear and draw content with some alpha or just let the background shine through?
        // The background is rgba(0,0,0,0.5).
        // If we clearRect, we see the background.
        // Let's keep it simple: clearRect.

        const px = Math.floor(this.game.player.position.x);
        const pz = Math.floor(this.game.player.position.z);
        const py = Math.floor(this.game.player.position.y);
        const prot = this.game.player.rotation.y;

        // Draw Setting
        const range = this.isExpanded ? 120 : 60;
        const scale = (width / 2) / range; // pixels per block

        ctx.save();
        ctx.translate(width / 2, height / 2);

        // Map Rotation
        // If expanded, keep North up. If small, rotate so player is up.
        if (!this.isExpanded) {
            ctx.rotate(prot);
        }

        ctx.scale(scale, scale);

        // Optimization: Draw in low res or skip every other pixel?
        // 60 radius = 120x120 = 14400 iter. JS can handle this easily in rAF.

        // Scan area
        const start = -range;
        const end = range;

        // Caching vars
        const worldGen = this.game.worldGen;
        const seaLevel = worldGen ? worldGen.seaLevel : 62;

        const drawStep = 2; // Use 2 for performance safety first.

        for (let z = start; z <= end; z += drawStep) {
            for (let x = start; x <= end; x += drawStep) {
                // Optimization: Circular clip - skip corners
                if (!this.isExpanded && (x * x + z * z > range * range)) continue;

                const wx = px + x;
                const wz = pz + z;

                let color = '#000'; // Void

                if (worldGen) {
                    // 1. Get Biome/Terrain info
                    const terrainH = worldGen.getTerrainHeight(wx, wz);
                    const biome = worldGen.getBiome(wx, wz);

                    // 2. Check for Surface Block (Top-Down View)
                    // We want to see what is actually there (trees, player builds).
                    // This is expensive: game.getBlockWorld(wx, top, wz)
                    // Optimizations:
                    // - Only check locally loaded chunks (getBlockWorld does this).
                    // - Start check from player height + 20? 
                    // - If chunk not loaded, fall back to terrain generation (prediction).

                    // Simple approach: Check top-most block in the column?
                    // We don't have a fast "getTopBlock" method.
                    // Let's use getBlockWorld at predicted surface + check up/down a bit.
                    // Or... since we want to be performant, let's rely on Terrain H for base, 
                    // and check specific layers if needed.

                    // BETTER ACCURACY: Scan down from a reasonable height? 
                    // Scanning 100 blocks per pixel is too slow (1.4M checks).

                    // HYBRID: Use Terrain Height as guess.
                    // If chunk is loaded, check block at TerrainHeight + 1 (Grass? Flower?)
                    // Or TerrainHeight + 5 (Tree?).

                    // Let's just use Biome colors first, as that is fast.
                    // Then overlay Water.

                    if (terrainH < seaLevel) {
                        color = '#3366ff'; // Water
                        // Depth shading?
                    } else {
                        // Biome Colors
                        switch (biome) {
                            case 'DESERT': color = '#F0E68C'; break; // Khaki
                            case 'SNOW': color = '#FFFAFA'; break; // Snow
                            case 'FOREST': color = '#228B22'; break; // Forest Green
                            case 'PLAINS': color = '#32CD32'; break; // Lime Green
                            case 'MOUNTAIN': color = '#808080'; break; // Grey
                            default: color = '#32CD32';
                        }
                    }

                    // 3. Structure / Tree detection (Performance sensitive)
                    // Check 5 blocks above terrain height. If solid, it's a tree or building.
                    // Can we do this selectively?
                    // Let's rely on game.getBlockWorld(wx, terrainH + 1, wz) ...

                    // Let's try to grab the actual block at the "surface" or slightly above.
                    // If we find a LEAVES block, color it dark green.
                    // If we find PLANKS, color brown.

                    const blockAbove = this.game.getBlockWorld(wx, terrainH + 1, wz);
                    if (blockAbove) {
                        if (blockAbove === Blocks.LEAVES || blockAbove === Blocks.PINE_LEAVES || blockAbove === Blocks.BIRCH_LEAVES) {
                            color = '#006400'; // Dark Green
                        } else if (blockAbove === Blocks.LOG || blockAbove === Blocks.PLANKS) {
                            color = '#8B4513'; // Brown
                        } else if (blockAbove === Blocks.STONE_BRICK || blockAbove === Blocks.COBBLESTONE) {
                            color = '#696969'; // Dim Gray
                        }
                    }

                    // Check slightly higher for trees?
                    // Trees can be +4 to +8.
                    // Skipping for performance unless requested.
                }

                ctx.fillStyle = color;
                // Draw pixel (slight overlap)
                // Note: coordinates. 
                // in small map: we rotated around center. x, z are relative.
                // we draw at x, z.
                ctx.fillRect(x, z, drawStep * 1.1, drawStep * 1.1);
            }
        }

        // Draw Player Marker (Always center)
        ctx.fillStyle = '#FFFFFF';

        // If expanded (North Up), we need to draw an arrow showing player direction
        if (this.isExpanded) {
            ctx.save();
            ctx.rotate(-prot); // Rotate arrow
            this.drawArrow(ctx, 0, 0, 4 / scale);
            ctx.restore();
        } else {
            // Small map (Player Up), just a dot or fixed arrow
            this.drawArrow(ctx, 0, 0, 4 / scale);
        }

        // Draw Other Players
        if (this.game.socketManager && this.game.socketManager.playerMeshes) {
            this.game.socketManager.playerMeshes.forEach((meshInfo) => {
                const otherPos = meshInfo.group.position;
                const dx = Math.floor(otherPos.x) - px;
                const dz = Math.floor(otherPos.z) - pz;

                // range check
                if (dx * dx + dz * dz > range * range) return;

                ctx.fillStyle = '#FFFF00';
                ctx.beginPath();
                ctx.arc(dx, dz, 3 / scale, 0, Math.PI * 2);
                ctx.fill();

                // Name?
                if (this.isExpanded) {
                    ctx.fillStyle = 'white';
                    ctx.font = '2px Arial'; // scaled font?
                    // Text is hard with canvas scaling.
                }
            });
        }

        ctx.restore();
    }

    drawArrow(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size * 0.7, y + size);
        ctx.lineTo(x + size * 0.7, y + size);
        ctx.closePath();
        ctx.fill();
    }
}
