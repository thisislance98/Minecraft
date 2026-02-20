import { Item } from './Item.js';
import * as THREE from 'three';

/**
 * PaintBrushItem - A tool that paints blocks in the world.
 *
 * Left-click: Paint the targeted block with the selected color
 * Right-click: Cycle through available paint colors
 *
 * Uses concrete blocks for smooth, vibrant colors.
 */
export class PaintBrushItem extends Item {
    constructor() {
        super('paint_brush', 'Paint Brush');
        this.maxStack = 1;
        this.isTool = true;
        this.paintCooldown = 80; // ms between paints for rapid painting
        this.lastPaintTime = 0;

        // Available paint colors - concrete blocks for smooth look
        this.colors = [
            { name: 'Red',    block: 'concrete_red',    hex: 0xCC3333 },
            { name: 'Orange', block: 'concrete_orange', hex: 0xE67E22 },
            { name: 'Yellow', block: 'concrete_yellow', hex: 0xF1C40F },
            { name: 'Green',  block: 'concrete_green',  hex: 0x27AE60 },
            { name: 'Blue',   block: 'concrete_blue',   hex: 0x2980B9 },
            { name: 'Purple', block: 'concrete_purple', hex: 0x8E44AD },
            { name: 'Pink',   block: 'concrete_pink',   hex: 0xE91E8E },
            { name: 'Cyan',   block: 'concrete_cyan',   hex: 0x00BCD4 },
            { name: 'White',  block: 'concrete_white',  hex: 0xEEEEEE },
            { name: 'Gray',   block: 'concrete_gray',   hex: 0x888888 },
            { name: 'Black',  block: 'concrete_black',  hex: 0x222222 },
            { name: 'Brown',  block: 'concrete_brown',  hex: 0x795548 },
        ];
        this.selectedColorIndex = 0;

        // Color indicator overlay element
        this._colorIndicator = null;
    }

    get currentColor() {
        return this.colors[this.selectedColorIndex];
    }

    /**
     * Right-click: Cycle to the next paint color
     */
    onUseDown(game, player) {
        this.selectedColorIndex = (this.selectedColorIndex + 1) % this.colors.length;
        const color = this.currentColor;

        // Show color indicator
        this._showColorIndicator(color);

        // Play a click sound if available
        if (game.soundManager?.playSound) {
            game.soundManager.playSound('click');
        }

        return true;
    }

    /**
     * Left-click: Paint the block the player is looking at
     */
    onPrimaryDown(game, player) {
        const now = performance.now();
        if (now - this.lastPaintTime < this.paintCooldown) return false;
        this.lastPaintTime = now;

        // Raycast to find the block the player is looking at
        const target = game.physicsManager?.getTargetBlock();
        if (!target) return false;

        const currentBlock = game.getBlock(target.x, target.y, target.z);
        if (!currentBlock) return false;

        // Don't paint special/interactive blocks
        const unpaintable = [
            'air', 'bedrock', 'water', 'lava',
            'door_closed', 'door_open', 'sign',
            'survival_block', 'control_block', 'mob_waves_block',
            'xbox', 'parkour_block', 'disco_room_block',
            'torch', 'fire', 'ladder',
        ];
        if (unpaintable.includes(currentBlock.type)) return false;

        // Don't repaint if already the same color
        if (currentBlock.type === this.currentColor.block) return true;

        // Paint the block!
        game.setBlock(target.x, target.y, target.z, this.currentColor.block);

        // Swing arm animation
        if (player.swingArm) player.swingArm();

        return true;
    }

    /**
     * Show a color indicator overlay on screen
     */
    _showColorIndicator(color) {
        // Remove existing indicator
        if (this._colorIndicator) {
            this._colorIndicator.remove();
            this._colorIndicator = null;
        }

        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
            z-index: 1000;
            pointer-events: none;
            transition: opacity 0.3s;
            font-family: 'Segoe UI', Arial, sans-serif;
        `;

        const swatch = document.createElement('div');
        const hexStr = '#' + color.hex.toString(16).padStart(6, '0');
        swatch.style.cssText = `
            width: 20px;
            height: 20px;
            border-radius: 4px;
            border: 2px solid white;
            background: ${hexStr};
        `;

        const label = document.createElement('span');
        label.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: 600;
        `;
        label.textContent = color.name;

        indicator.appendChild(swatch);
        indicator.appendChild(label);
        document.body.appendChild(indicator);
        this._colorIndicator = indicator;

        // Fade out after 1.5s
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0';
                setTimeout(() => indicator.remove(), 300);
                if (this._colorIndicator === indicator) {
                    this._colorIndicator = null;
                }
            }
        }, 1500);
    }

    /**
     * Cleanup the color indicator when switching items
     */
    onDeselect() {
        if (this._colorIndicator) {
            this._colorIndicator.remove();
            this._colorIndicator = null;
        }
    }

    /**
     * 3D mesh: Paint brush with colored bristles
     */
    getMesh() {
        const group = new THREE.Group();
        const color = this.currentColor;

        // Brush handle (wooden stick)
        const handleGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.55, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x8B6914 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = 0.1;
        group.add(handle);

        // Metal ferrule (silver band connecting handle to bristles)
        const ferruleGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.07, 8);
        const ferruleMat = new THREE.MeshStandardMaterial({
            color: 0xC0C0C0,
            metalness: 0.8,
            roughness: 0.3
        });
        const ferrule = new THREE.Mesh(ferruleGeo, ferruleMat);
        ferrule.position.y = -0.2;
        group.add(ferrule);

        // Bristles base (tan/natural)
        const bristleBaseGeo = new THREE.BoxGeometry(0.1, 0.06, 0.06);
        const bristleBaseMat = new THREE.MeshStandardMaterial({ color: 0xD4A843 });
        const bristleBase = new THREE.Mesh(bristleBaseGeo, bristleBaseMat);
        bristleBase.position.y = -0.27;
        group.add(bristleBase);

        // Bristle tip (paint-dipped, shows current color)
        const bristleTipGeo = new THREE.BoxGeometry(0.1, 0.1, 0.06);
        const bristleTipMat = new THREE.MeshStandardMaterial({
            color: color.hex,
            emissive: color.hex,
            emissiveIntensity: 0.15
        });
        const bristleTip = new THREE.Mesh(bristleTipGeo, bristleTipMat);
        bristleTip.position.y = -0.35;
        group.add(bristleTip);

        return group;
    }
}
