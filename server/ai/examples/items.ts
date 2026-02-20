/**
 * Item Examples for Few-Shot AI
 * Items MUST have: getMesh() for 3D preview, SVG icon for inventory
 * Uses semantic search to find the most relevant examples for each request
 */

import { semanticSearchExamples } from '../../services/SemanticSearch';

export const itemExamples = [
    {
        name: "MagicWand",
        description: "A wand that shoots magic projectiles - tool item with shooting action",
        keywords: ["wand", "magic", "shoot", "projectile", "staff", "spell", "cast"],
        code: `class MagicWand extends WandItem {
    constructor() {
        super('magic_wand', 'Magic Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.fireCooldown = 500;
        this.lastFireTime = 0;
    }

    onUseDown(game, player) {
        const now = performance.now();
        if (now - this.lastFireTime < this.fireCooldown) return false;
        this.lastFireTime = now;

        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(1.0);

        game.spawnMagicProjectile(spawnPos, velocity);
        if (player.swingArm) player.swingArm();
        return true;
    }

    getMesh() {
        const group = new THREE.Group();

        // Handle (brown wooden stick)
        const handleGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        group.add(handle);

        // Glowing tip
        const tipGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const tipMat = new THREE.MeshStandardMaterial({ color: 0x8844FF, emissive: 0x8844FF, emissiveIntensity: 0.5 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.y = 0.45;
        group.add(tip);

        return group;
    }
}`,
        icon: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="20" width="4" height="40" fill="#5c4033" rx="1"/>
  <circle cx="32" cy="15" r="8" fill="#8844FF"/>
  <circle cx="32" cy="15" r="5" fill="#aa66ff" opacity="0.7"/>
</svg>`
    },
    {
        name: "FireSword",
        description: "A flaming sword that deals fire damage - melee weapon",
        keywords: ["sword", "fire", "flame", "weapon", "melee", "blade", "attack", "damage"],
        code: `class FireSword extends Item {
    constructor() {
        super('fire_sword', 'Fire Sword');
        this.maxStack = 1;
        this.isTool = true;
        this.damage = 8;
        this.attackCooldown = 400;
        this.lastAttackTime = 0;
    }

    onPrimaryDown(game, player) {
        const now = performance.now();
        if (now - this.lastAttackTime < this.attackCooldown) return false;
        this.lastAttackTime = now;

        // Swing animation
        if (player.swingArm) player.swingArm();

        // Find target in front of player
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);
        const attackRange = 3.0;

        if (game.animals) {
            for (const animal of game.animals) {
                if (animal.isDead) continue;
                const dist = player.position.distanceTo(animal.position);
                if (dist < attackRange) {
                    const toAnimal = new THREE.Vector3().subVectors(animal.position, player.position).normalize();
                    if (camDir.dot(toAnimal) > 0.5) {
                        animal.takeDamage(this.damage, player);
                        // Knockback
                        animal.knockback(toAnimal, 8);
                        return true;
                    }
                }
            }
        }
        return true;
    }

    getMesh() {
        const group = new THREE.Group();

        // Handle
        const handleGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = -0.1;
        group.add(handle);

        // Guard
        const guardGeo = new THREE.BoxGeometry(0.25, 0.05, 0.1);
        const guardMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const guard = new THREE.Mesh(guardGeo, guardMat);
        guard.position.y = 0.05;
        group.add(guard);

        // Blade
        const bladeGeo = new THREE.BoxGeometry(0.08, 0.6, 0.04);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.3 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.35;
        group.add(blade);

        // Tip
        const tipGeo = new THREE.BoxGeometry(0.08, 0.1, 0.04);
        const tip = new THREE.Mesh(tipGeo, bladeMat);
        tip.position.y = 0.7;
        tip.rotation.z = Math.PI / 4;
        tip.scale.set(0.7, 1, 1);
        group.add(tip);

        return group;
    }
}`,
        icon: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="29" y="40" width="6" height="20" fill="#4a3728"/>
  <rect x="22" y="38" width="20" height="4" fill="#ffd700" rx="1"/>
  <rect x="28" y="8" width="8" height="32" fill="#ff4400"/>
  <polygon points="32,2 28,8 36,8" fill="#ff6600"/>
  <rect x="30" y="10" width="4" height="25" fill="#ff6600" opacity="0.5"/>
</svg>`
    },
    {
        name: "HealingPotion",
        description: "A consumable potion that restores health",
        keywords: ["potion", "heal", "health", "drink", "consumable", "restore", "medicine"],
        code: `class HealingPotion extends Item {
    constructor() {
        super('healing_potion', 'Healing Potion');
        this.maxStack = 16;
        this.isTool = false;
        this.healAmount = 10;
    }

    onUseDown(game, player) {
        // Only use if player is damaged
        if (player.health >= player.maxHealth) {
            return false;
        }

        // Heal player
        player.health = Math.min(player.health + this.healAmount, player.maxHealth);

        // Consume one potion from inventory
        const inventory = game.inventoryManager;
        if (inventory) {
            const slot = inventory.findItem(this.id);
            if (slot !== -1) {
                inventory.removeItem(slot, 1);
            }
        }

        // Play sound effect
        if (game.soundManager) {
            game.soundManager.playSound('drink');
        }

        return true;
    }

    getMesh() {
        const group = new THREE.Group();

        // Bottle body
        const bodyGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.35, 8);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xff4466,
            transparent: true,
            opacity: 0.7
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Bottle neck
        const neckGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.12, 8);
        const neckMat = new THREE.MeshStandardMaterial({
            color: 0xff4466,
            transparent: true,
            opacity: 0.7
        });
        const neck = new THREE.Mesh(neckGeo, neckMat);
        neck.position.y = 0.23;
        group.add(neck);

        // Cork
        const corkGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.08, 8);
        const corkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const cork = new THREE.Mesh(corkGeo, corkMat);
        cork.position.y = 0.32;
        group.add(cork);

        return group;
    }
}`,
        icon: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="42" rx="12" ry="18" fill="#ff4466" opacity="0.8"/>
  <rect x="28" y="20" width="8" height="10" fill="#ff4466" opacity="0.8"/>
  <rect x="29" y="14" width="6" height="8" fill="#8b4513"/>
  <ellipse cx="32" cy="38" rx="6" ry="10" fill="#ff6688" opacity="0.5"/>
</svg>`
    },
    {
        name: "Flashlight",
        description: "A tool that creates light in front of the player",
        keywords: ["light", "flashlight", "torch", "lamp", "glow", "illuminate", "dark"],
        code: `class Flashlight extends Item {
    constructor() {
        super('flashlight', 'Flashlight');
        this.maxStack = 1;
        this.isTool = true;
        this.isOn = false;
        this.light = null;
    }

    onUseDown(game, player) {
        this.isOn = !this.isOn;

        if (this.isOn) {
            // Create spotlight
            if (!this.light) {
                this.light = new THREE.SpotLight(0xffffcc, 2, 30, Math.PI / 6, 0.3);
                this.light.castShadow = true;
                game.scene.add(this.light);
                game.scene.add(this.light.target);
            }
        } else {
            // Remove light
            if (this.light) {
                game.scene.remove(this.light);
                game.scene.remove(this.light.target);
                this.light = null;
            }
        }
        return true;
    }

    // Called every frame when held
    onHeldUpdate(game, player, dt) {
        if (this.light && this.isOn) {
            // Position light at player
            this.light.position.copy(game.camera.position);

            // Point in camera direction
            const dir = new THREE.Vector3();
            game.camera.getWorldDirection(dir);
            this.light.target.position.copy(game.camera.position).add(dir.multiplyScalar(10));
        }
    }

    getMesh() {
        const group = new THREE.Group();

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Head/lens
        const headGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.1, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.25;
        group.add(head);

        // Lens (glass)
        const lensGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 8);
        const lensMat = new THREE.MeshStandardMaterial({
            color: 0xffffcc,
            emissive: 0xffffcc,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.8
        });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.y = 0.31;
        group.add(lens);

        return group;
    }
}`,
        icon: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="26" y="28" width="12" height="30" fill="#333333" rx="2"/>
  <rect x="24" y="20" width="16" height="10" fill="#222222" rx="2"/>
  <ellipse cx="32" cy="18" rx="7" ry="3" fill="#ffffcc"/>
  <line x1="32" y1="8" x2="32" y2="14" stroke="#ffffcc" stroke-width="2"/>
  <line x1="22" y1="12" x2="26" y2="16" stroke="#ffffcc" stroke-width="2"/>
  <line x1="42" y1="12" x2="38" y2="16" stroke="#ffffcc" stroke-width="2"/>
</svg>`
    },
    {
        name: "MazeBlock",
        description: "A maze block that builds a navigable maze in front of the player when used - places blocks using game.setBlock",
        keywords: ["maze", "labyrinth", "puzzle", "block", "build", "place", "generate", "walls", "corridors"],
        code: `class MazeBlockItem extends Item {
    constructor() {
        super('maze_block', 'Maze Block');
        this.maxStack = 16;
        this.isTool = true;
        this.useCooldown = 2000;
        this.lastUseTime = 0;
    }

    onUseDown(game, player) {
        const now = performance.now();
        if (now - this.lastUseTime < this.useCooldown) return false;
        this.lastUseTime = now;

        if (player.swingArm) player.swingArm();

        // Get direction player is facing
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Place maze 3 blocks in front of player
        const px = Math.floor(player.position.x + camDir.x * 3);
        const py = Math.floor(player.position.y);
        const pz = Math.floor(player.position.z + camDir.z * 3);

        const mazeCols = 6;
        const mazeRows = 6;
        const wallHeight = 3;
        const gridW = mazeCols * 2 + 1;
        const gridD = mazeRows * 2 + 1;

        // Initialize grid - 1 = wall, 0 = path
        const grid = [];
        for (let i = 0; i < gridW; i++) {
            grid[i] = [];
            for (let j = 0; j < gridD; j++) {
                grid[i][j] = 1;
            }
        }

        // Carve maze using DFS
        const stack = [];
        grid[1][1] = 0;
        stack.push([1, 1]);

        let seed = (px * 73 + pz * 37 + Math.floor(now)) & 0x7fffffff;
        const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

        while (stack.length > 0) {
            const [cx, cz] = stack[stack.length - 1];
            const neighbors = [];
            for (const [dx, dz] of [[0,2],[0,-2],[2,0],[-2,0]]) {
                const nx = cx + dx, nz = cz + dz;
                if (nx > 0 && nx < gridW - 1 && nz > 0 && nz < gridD - 1 && grid[nx][nz] === 1) {
                    neighbors.push([nx, nz, cx + dx/2, cz + dz/2]);
                }
            }
            if (neighbors.length > 0) {
                const [nx, nz, wx, wz] = neighbors[Math.floor(rand() * neighbors.length)];
                grid[wx][wz] = 0;
                grid[nx][nz] = 0;
                stack.push([nx, nz]);
            } else {
                stack.pop();
            }
        }

        // Entrance and exit
        grid[0][1] = 0;
        grid[gridW - 1][gridD - 2] = 0;

        // Place floor
        for (let x = 0; x < gridW; x++) {
            for (let z = 0; z < gridD; z++) {
                game.setBlock(px + x, py, pz + z, 'stone');
            }
        }

        // Place walls
        for (let x = 0; x < gridW; x++) {
            for (let z = 0; z < gridD; z++) {
                if (grid[x][z] === 1) {
                    for (let y = 1; y <= wallHeight; y++) {
                        game.setBlock(px + x, py + y, pz + z, 'stone_brick');
                    }
                }
            }
        }

        // Glowstone lighting on top of some walls
        for (let x = 0; x < gridW; x += 4) {
            for (let z = 0; z < gridD; z += 4) {
                if (grid[x][z] === 1) {
                    game.setBlock(px + x, py + wallHeight + 1, pz + z, 'glowstone');
                }
            }
        }

        // Gold block at exit
        game.setBlock(px + gridW, py + 1, pz + gridD - 2, 'gold_block');

        // Consume one item
        const inventory = game.inventoryManager;
        if (inventory) {
            const slot = inventory.findItem(this.id);
            if (slot !== -1) {
                inventory.removeItem(slot, 1);
            }
        }

        return true;
    }

    getMesh() {
        const group = new THREE.Group();

        // Base cube (stone)
        const baseGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        group.add(base);

        // Mini maze walls on top face
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        // Outer walls
        const wallGeos = [
            { w: 0.4, h: 0.08, d: 0.02, x: 0, y: 0.24, z: -0.19 },
            { w: 0.4, h: 0.08, d: 0.02, x: 0, y: 0.24, z: 0.19 },
            { w: 0.02, h: 0.08, d: 0.4, x: -0.19, y: 0.24, z: 0 },
            { w: 0.02, h: 0.08, d: 0.4, x: 0.19, y: 0.24, z: 0 },
        ];
        for (const w of wallGeos) {
            const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(w.x, w.y, w.z);
            group.add(mesh);
        }
        // Inner maze walls
        const innerWalls = [
            { w: 0.02, h: 0.08, d: 0.2, x: -0.08, y: 0.24, z: -0.09 },
            { w: 0.15, h: 0.08, d: 0.02, x: 0.07, y: 0.24, z: 0 },
            { w: 0.02, h: 0.08, d: 0.15, x: 0.08, y: 0.24, z: 0.07 },
        ];
        for (const w of innerWalls) {
            const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(w.x, w.y, w.z);
            group.add(mesh);
        }

        return group;
    }
}`,
        icon: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="56" height="56" fill="#888888" rx="3"/>
  <rect x="8" y="8" width="48" height="48" fill="none" stroke="#444444" stroke-width="3"/>
  <line x1="8" y1="20" x2="36" y2="20" stroke="#444444" stroke-width="3"/>
  <line x1="28" y1="20" x2="28" y2="44" stroke="#444444" stroke-width="3"/>
  <line x1="20" y1="32" x2="20" y2="56" stroke="#444444" stroke-width="3"/>
  <line x1="36" y1="8" x2="36" y2="32" stroke="#444444" stroke-width="3"/>
  <line x1="44" y1="24" x2="44" y2="56" stroke="#444444" stroke-width="3"/>
  <line x1="36" y1="44" x2="56" y2="44" stroke="#444444" stroke-width="3"/>
  <rect x="48" y="48" width="6" height="6" fill="#ffd700"/>
</svg>`
    }
];

/**
 * Find the best matching item examples using semantic search
 * @param userRequest - The user's item creation request
 * @param count - Number of examples to return (default 2)
 * @returns Promise resolving to array of best matching examples
 */
export async function findBestItemExamples(userRequest: string, count: number = 2): Promise<typeof itemExamples> {
    if (itemExamples.length === 0) {
        return [];
    }

    try {
        const results = await semanticSearchExamples(userRequest, itemExamples, count);

        // If no good semantic matches, return defaults
        if (results.length === 0) {
            console.log(`[ItemExamples] No semantic matches, returning defaults`);
            return [itemExamples[0], itemExamples[1]]; // Wand and Sword as defaults
        }

        return results.map(r => r.example);
    } catch (error) {
        console.error('[ItemExamples] Semantic search failed, returning defaults:', error);
        return [itemExamples[0], itemExamples[1]];
    }
}
