import * as THREE from 'three';

export class TextureAtlas {
    constructor(game, size = 1024) {
        this.game = game;
        this.size = size;
        this.canvas = document.createElement('canvas');
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d');

        // Packing state
        this.currentX = 0;
        this.currentY = 0;
        this.rowMaxH = 0;
        this.padding = 1; // 1px padding to avoid bleeding

        this.textures = {}; // name -> { u, v, w, h, u1, v1 } (normalized)

        // Debug
        // document.body.appendChild(this.canvas);
        // this.canvas.style.position = 'fixed';
        // this.canvas.style.top = '0';
        // this.canvas.style.left = '0';
        // this.canvas.style.zIndex = '10000';
        // this.canvas.style.width = '256px'; // View scalar
    }

    addTexture(name, image) {
        if (this.textures[name]) return; // Already added

        const w = image.width;
        const h = image.height;

        // Wrap to next row
        if (this.currentX + w + this.padding > this.size) {
            this.currentX = 0;
            this.currentY += this.rowMaxH + this.padding;
            this.rowMaxH = 0;
        }

        if (this.currentY + h + this.padding > this.size) {
            console.error('Texture Atlas Full!');
            return;
        }

        // Draw
        this.ctx.drawImage(image, this.currentX, this.currentY);

        // Store Normalized UVs
        // To avoid bleeding, we might want to inset half a pixel? 
        // For Minecraft style (pixel art), NearestFilter is used. 
        // Padding is usually best.

        this.textures[name] = {
            u: this.currentX / this.size,
            v: 1.0 - ((this.currentY + h) / this.size), // Top-left V (Three.js UV origin is bottom-left usually, but images draw from top-left. Textures are flippedY?)
            // WAIT. Three.js CanvasTexture usually has flipY=true by default? 
            // Actually, let's adhere to standard UV: (0,0) is bottom-left. 
            // Canvas (0,0) is top-left.
            // If we map UV (0,0) to mesh, it picks bottom-left of texture.
            // So if we draw at (0,0) in canvas, that is Top-Left of the image.
            // In UV space, Top-Left is (0, 1).
            // So y in canvas = 1.0 - v in UV.
            // Let's keep it simple: We calculate UVs assuming standard orientation.

            // Correct UV mapping for "Standard" plane output:
            // x, y, w, h in canvas pixels
            x: this.currentX,
            y: this.currentY,
            w: w,
            h: h
        };

        this.currentX += w + this.padding;
        this.rowMaxH = Math.max(this.rowMaxH, h);
    }

    getUVs(name) {
        const t = this.textures[name];
        if (!t) return null;

        // Return array of UVs for a quad [0,1, 1,1, 0,0, 1,0] ... wait, standard buffer geometry order?
        // Let's just return the raw range (uMin, vMin, uMax, vMax)
        // Canvas Y starts at 0 (top). 
        // In Three.js UVs: v=1 is Top. v=0 is Bottom.

        // Top edge of sprite in canvas (y) -> UV V = 1.0 - (y / size)
        // Bottom edge (y+h) -> UV V = 1.0 - ((y+h) / size)

        const uMin = t.x / this.size;
        const uMax = (t.x + t.w) / this.size;

        const vMax = 1.0 - (t.y / this.size); // Higher V value (Top of image)
        const vMin = 1.0 - ((t.y + t.h) / this.size); // Lower V value (Bottom of image)

        return { uMin, uMax, vMin, vMax };
    }

    createMaterial(transparent = false) {
        const texture = new THREE.CanvasTexture(this.canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: transparent,
            alphaTest: transparent ? 0 : 0.1, // Cutout for opaque
            side: THREE.DoubleSide,
            vertexColors: true
        });

        return mat;
    }
}
