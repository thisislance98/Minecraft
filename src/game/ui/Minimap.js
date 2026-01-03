
import * as THREE from 'three';

export class Minimap {
    constructor(game) {
        this.game = game;
        this.size = 150; // Small size px
        this.expandedSize = 400; // Expanded size px
        this.isExpanded = false;

        // Configuration
        this.zoom = 2; // Pixels per block
        this.range = 40; // Blocks radius to show

        this.initDOM();
        this.startLoop();
    }

    initDOM() {
        // Container
        this.container = document.createElement('div');
        this.container.id = 'minimap-container';
        this.container.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: ${this.size}px;
            height: ${this.size}px;
            border: 4px solid rgba(0, 0, 0, 0.5);
            border-radius: 50%;
            background: #000;
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
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        // Compass / Player Marker
        // We'll draw the player indicator on the canvas, but maybe a static overlay for "North" is useful?
        // Actually, let's just draw everything on canvas.

        // Events
        this.container.addEventListener('click', (e) => this.toggleExpand(e));

        // Add to document
        document.body.appendChild(this.container);
    }

    toggleExpand(e) {
        this.isExpanded = !this.isExpanded;
        const s = this.isExpanded ? this.expandedSize : this.size;
        this.container.style.width = `${s}px`;
        this.container.style.height = `${s}px`;
        this.container.style.borderRadius = this.isExpanded ? '10px' : '50%';
        this.canvas.width = s;
        this.canvas.height = s;

        // Adjust zoom/range?
        this.range = this.isExpanded ? 100 : 40;
    }

    startLoop() {
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    animate() {
        // Run loop
        requestAnimationFrame(this.animate);

        // Throttle? 60fps might be fine for simple canvas
        this.update();
        this.draw();
    }

    update() {
        // Update logic if needed
    }

    draw() {
        if (!this.game.player) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);

        const px = this.game.player.position.x;
        const pz = this.game.player.position.z;
        const py = this.game.player.position.y;

        // Map dimensions
        const range = this.range;

        // Save Context for map rotation
        ctx.save();

        // Center the map
        ctx.translate(width / 2, height / 2);

        // Rotate map so "Forward" is Up?
        // Usually minimaps rotate so player is always facing UP.
        // Player rotation Y
        const rot = this.game.player.rotation.y;

        if (!this.isExpanded) {
            // Rotating map mode for small round map
            ctx.rotate(rot);
            // Note: If player yaw is 0 (facing South in Three.js usually?), we might need adjustment.
            // ThreeJS: -Z is forward. 
        } else {
            // Static North-Up map for expanded mode? Or keep standard?
            // Let's keep it North-Up for expanded, Player-Up for small.
            // Actually, North-Up is easier to read for broad maps.
            // Let's do North-Up for Expanded.
        }

        // Scale: map world units to pixels
        // range is "number of blocks from center to edge"
        const scale = (width / 2) / range;
        ctx.scale(scale, scale);

        // Draw Terrain (Simplified)
        // We scan a grid around the player.
        // Optimization: Don't draw every single block. Draw chunks? 
        // For a 40 radius, that's 80x80 = 6400 points. Fast enough.
        // For 100 radius, 200x200 = 40000 points. Might be slow on 60fps.
        // Optimization: Reduce resolution.

        const resolution = this.isExpanded ? 2 : 1; // skip blocks in expanded mode?

        // In "Player Up" mode (Small), we need to fill the corners too because of rotation.
        // Radius needs to cover sqrt(2) * range.
        const drawRadius = Math.ceil(range * (this.isExpanded ? 1.0 : 1.5));

        // Use pixel manipulation for speed? Or fillRect? fillRect is easiest to read.
        // ImageData is faster for pixels.

        // Let's stick to fillRect for now, see performance.

        // We need to iterate relative to player position
        // But if North-Up (Expanded), we draw relative to world
        // If Player-Up (Small), we rotate context.
        // Ideally we just draw relative to player (0,0 is player) and let canvas transform handle rotation.

        // Offset for drawing loops
        const start = -drawRadius;
        const end = drawRadius;
        const step = this.isExpanded ? 2 : 2; // Optimization: step 2 blocks

        // Pixel size in world units
        const pixelSize = step;

        for (let z = start; z <= end; z += step) {
            for (let x = start; x <= end; x += step) {
                // World coords
                const wx = px + x;
                const wz = pz + z;

                // Get terrain height
                // Using worldGen directly to avoid chunk lookups for now
                let h = 0;
                if (this.game.worldGen) {
                    h = this.game.worldGen.getTerrainHeight(wx, wz);
                }

                // Color based on height/biome
                let color = '#228B22'; // Forest Green

                if (h < 4) color = '#1E90FF'; // Water
                else if (h < 6) color = '#F4A460'; // Sand
                else if (h > 40) color = '#808080'; // Stone
                else if (h > 60) color = '#FFFafa'; // Snow

                // Shading relative to player height?
                // Or standard topographic shading

                // Draw rect
                ctx.fillStyle = color;
                // We draw at x, z (relative to player)
                // Note: Canvas Y is "Down", World Z is "Down"? THREE.js Z is "Back"?
                // In Top-Down: x is x, z is y (on canvas)
                ctx.fillRect(x, z, pixelSize * 1.05, pixelSize * 1.05); // slight overlap to fix gaps
            }
        }

        // Draw Player Marker (Self)
        // Since we translated to center and (in small mode) rotated around it:
        // Player is always at 0,0
        // BUT if we are in North Up mode (Expanded), player is at center but we didn't rotate.
        // So player always at 0,0 relative to context center.

        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(0, 0, 2 / scale * 3, 0, Math.PI * 2); // Fixed size (approx 3px visual)
        ctx.fill();

        // If North-Up, draw an arrow for player rotation
        if (this.isExpanded) {
            ctx.save();
            ctx.rotate(-this.game.player.rotation.y); // Rotate arrow to match player heading
            // Draw Arrow
            ctx.beginPath();
            ctx.moveTo(0, -5 / scale);
            ctx.lineTo(-3 / scale, 3 / scale);
            ctx.lineTo(3 / scale, 3 / scale);
            ctx.closePath();
            ctx.fillStyle = '#FF0000';
            ctx.fill();
            ctx.restore();
        }

        // Draw Other Players
        if (this.game.socketManager && this.game.socketManager.playerMeshes) {
            this.game.socketManager.playerMeshes.forEach((meshInfo, id) => {
                const otherPos = meshInfo.group.position;

                // Relative pos
                const dx = otherPos.x - px;
                const dz = otherPos.z - pz;

                // Draw
                // If rotated map (small), the canvas rotation handles the dx, dz alignment?
                // Yes, if we draw at (dx, dz) on the transformed canvas.
                // WAIT: If we rotated the CANVAS by `rot`, then points drawn at `dx, dz` will be rotated.
                // Correct.

                ctx.fillStyle = '#FFFF00'; // Yellow dot for others
                ctx.beginPath();
                ctx.arc(dx, dz, 2 / scale * 3, 0, Math.PI * 2);
                ctx.fill();

                // Name Tag
                if (this.isExpanded) {
                    ctx.save();
                    // Reset scale for text so it's readable?
                    // Complex with transform. 
                    // Let's just draw text in world coords but big enough?
                    // Better: Transform back for text.
                    ctx.scale(1 / scale, 1 / scale);

                    ctx.fillStyle = '#FFF';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    // Need to scale positions up
                    ctx.fillText(meshInfo.name || "Player", dx * scale, (dz * scale) - 10);
                    ctx.restore();
                }
            });
        }

        // Restore context
        ctx.restore();

        // Border / UI Overlay
        if (!this.isExpanded) {
            // Draw N pointer on the rim if rotating?
        }
    }
}
