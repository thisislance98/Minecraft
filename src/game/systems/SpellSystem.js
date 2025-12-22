
import * as THREE from 'three';

export class SpellSystem {
    constructor(game) {
        this.game = game;
    }

    parse(input) {
        const text = input.toLowerCase();

        const spell = {
            name: input,
            type: 'projectile', // Default to projectile
            effects: []
        };

        // Parse Target Type
        if (text.includes('self') || text.includes('me')) {
            spell.type = 'self';
        } else if (text.includes('ray') || text.includes('laser')) {
            spell.type = 'ray';
        }

        // Parse Effects
        if (text.includes('levitate') || text.includes('float') || text.includes('lift')) {
            spell.effects.push({ type: 'levitate', duration: 10000 });
        }

        if (text.includes('damage') || text.includes('hurt') || text.includes('kill')) {
            spell.effects.push({ type: 'damage', amount: 20 });
        }

        if (text.includes('fire') || text.includes('burn')) {
            spell.effects.push({ type: 'fire', duration: 5000 });
        }

        if (text.includes('push') || text.includes('away')) {
            spell.effects.push({ type: 'push', force: 20 });
        }

        if (spell.effects.length === 0) {
            // Default effect if none found
            spell.effects.push({ type: 'particle', color: 0xff00ff });
        }

        return spell;
    }

    execute(spell, source, direction) {
        if (!spell) return;

        console.log("Executing spell:", spell);

        if (spell.type === 'self') {
            this.applyEffects(spell.effects, source);
        } else if (spell.type === 'projectile') {
            this.fireProjectile(spell, source, direction);
        } else if (spell.type === 'ray') {
            this.castRay(spell, source, direction);
        }
    }

    fireProjectile(spell, source, direction) {
        // We'll trust the game to have a generic projectile spawner or we make one here.
        // For now, let's piggy back off existing projectile logic or create a generic 'SpellProjectile' roughly.
        // Since we don't have a generic SpellProjectile yet, let's use what we have or add a hook.

        // Actually, best to delegate to game to spawn a "OmniProjectile" that carries these effects.
        if (this.game.spawnOmniProjectile) {
            const spawnPos = source.position ? source.position.clone() : new THREE.Vector3();
            // Adjust spawn pos to be in front of player if source is player
            if (source === this.game.player) {
                const camDir = new THREE.Vector3();
                this.game.camera.getWorldDirection(camDir);
                spawnPos.copy(this.game.camera.position).add(camDir.multiplyScalar(1.0));
            }

            this.game.spawnOmniProjectile(spawnPos, direction, spell.effects);
        } else {
            console.warn("spawnOmniProjectile not found on game");
        }
    }

    castRay(spell, source, direction) {
        // Simple raycast logic
        const raycaster = new THREE.Raycaster();
        raycaster.set(this.game.camera.position, direction); // Assuming source is player camera for now

        const intersects = raycaster.intersectObjects(this.game.scene.children, true);

        if (intersects.length > 0) {
            // Find first entity
            // This logic depends on how entities are stored in the scene.
            // For now, just logging hit.
            const hit = intersects[0];
            console.log("Ray hit:", hit);

            // If we hit something processing-worthy
            // this.applyEffects(spell.effects, entity);
        }
    }

    applyEffects(effects, target) {
        if (!target) return;

        effects.forEach(effect => {
            switch (effect.type) {
                case 'levitate':
                    if (typeof target.startLevitation === 'function') {
                        target.startLevitation(effect.duration);
                    }
                    break;
                case 'damage':
                    if (typeof target.takeDamage === 'function') {
                        target.takeDamage(effect.amount);
                    }
                    break;
                case 'push':
                    // Generic push logic
                    break;
            }
        });
    }
}
