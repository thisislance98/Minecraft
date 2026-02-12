/**
 * Entity Commands
 *
 * Extracted from game-commands.js for better organization
 */

import chalk from 'chalk';

/**
 * Execute a command in the browser and return the result
 */
async function executeInBrowser(browser, fn, ...args) {
    return await browser.evaluate(fn, ...args);
}

/**
 * Get all entities in the scene
 */
export async function getEntities(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.animals) return { error: 'Game not ready' };

        const entities = game.animals.map(a => ({
            id: a.id,
            type: a.constructor.name,
            position: a.position ? { x: a.position.x, y: a.position.y, z: a.position.z } : null
        }));

        // Group by type
        const byType = {};
        for (const e of entities) {
            byType[e.type] = (byType[e.type] || 0) + 1;
        }

        return { count: entities.length, byType, entities: entities };
    });
}

/**
 * Print entity summary
 */
export function printEntities(entities) {
    console.log(chalk.blue('\n═══ Entities ═══'));
    console.log(`Total: ${entities.count}`);
    console.log(chalk.cyan('By Type:'));
    for (const [type, count] of Object.entries(entities.byType)) {
        console.log(`  ${type}: ${count}`);
    }
}

/**
 * Spawn a creature at player's position
 */
export async function spawnCreature(browser, creatureType, count = 1) {
    return await executeInBrowser(browser, (type, cnt) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        const AnimalClasses = window.AnimalClasses || {};
        const CreatureClass = AnimalClasses[type];
        if (!CreatureClass) {
            return { error: `Creature '${type}' not found`, available: Object.keys(AnimalClasses).slice(0, 20) };
        }

        // Spawn directly near player position (more reliable than spawnEntitiesInFrontOfPlayer in CLI)
        const player = game.player;
        if (!player) return { error: 'No player' };

        const spawned = [];
        for (let i = 0; i < cnt; i++) {
            const offsetX = (Math.random() - 0.5) * 10;
            const offsetZ = (Math.random() - 0.5) * 10;
            const x = player.position.x + 5 + offsetX;
            const z = player.position.z + 5 + offsetZ;
            const y = player.position.y + 2;

            try {
                const animal = new CreatureClass(game, x, y, z, Math.random());
                game.animals.push(animal);
                game.scene.add(animal.mesh);
                if (game.spawnManager?.entityRegistry) {
                    game.spawnManager.entityRegistry.register(animal.id, animal);
                }
                spawned.push({
                    type: animal.constructor.name,
                    position: { x, y, z },
                    isRideable: animal.isRideable || false
                });
            } catch (e) {
                return { error: `Failed to spawn ${type}: ${e.message}` };
            }
        }

        return { success: true, count: spawned.length, type, spawned };
    }, creatureType, count);
}

/**
 * Spawn creature at specific coordinates
 */
export async function spawnCreatureAt(browser, creatureType, x, y, z) {
    return await executeInBrowser(browser, (type, px, py, pz) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        const AnimalClasses = window.AnimalClasses || {};
        const CreatureClass = AnimalClasses[type];
        if (!CreatureClass) {
            return { error: `Creature '${type}' not found` };
        }

        // Create directly
        // createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null)
        // We want absolute control, so snapToGround = false? 
        // But createAnimal logic forces snapToGround if not specified.
        // Actually createAnimal signature: createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null)
        // Wait, I saw createAnimal code: createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null)
        // If I pass false, it should respect it.
        // But wait, the code I read earlier:
        /*
        createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null) {
            // ...
            if (snapToGround) {
                // ... finds ground ...
            }
            const animal = new AnimalClass(this.game, x, y, z, seed);
            // ...
        }
        */
        // So passing false should work.

        // However, `spawnManager.createAnimal` might not return the created instance.
        // It returns nothing usually.
        // But `spawnEntitiesInFrontOfPlayer` returns the list.
        // I'll implement a simple wrapper that instantiates or calls createAnimal.

        // Let's use createAnimal but with snapToGround=false to force position.

        game.spawnManager.createAnimal(CreatureClass, px, py, pz, false);
        return { success: true, type, x: px, y: py, z: pz };
    }, creatureType, x, y, z);
}

/**
 * Get all registered creature classes
 */
export async function getRegisteredCreatures(browser) {
    return await executeInBrowser(browser, () => {
        const AnimalClasses = window.AnimalClasses || {};
        const DynamicCreatures = window.DynamicCreatures || {};
        return {
            all: Object.keys(AnimalClasses),
            dynamic: Object.keys(DynamicCreatures)
        };
    });
}

/**
 * Check if a creature class is registered
 */
export async function isCreatureRegistered(browser, creatureName) {
    return await executeInBrowser(browser, (name) => {
        const AnimalClasses = window.AnimalClasses || {};
        return {
            registered: name in AnimalClasses,
            isDynamic: name in (window.DynamicCreatures || {})
        };
    }, creatureName);
}

/**
 * Get all creature registration errors (for debugging AI-generated creatures)
 */
export async function getCreatureErrors(browser) {
    return await executeInBrowser(browser, () => {
        const errors = window.DynamicCreatureErrors || {};
        return {
            count: Object.keys(errors).length,
            errors: errors
        };
    });
}

/**
 * Get detailed info about dynamic creatures (for debugging)
 */
export async function getDynamicCreatureInfo(browser) {
    return await executeInBrowser(browser, () => {
        const DynamicCreatures = window.DynamicCreatures || {};
        const DynamicCreatureErrors = window.DynamicCreatureErrors || {};
        const AnimalClasses = window.AnimalClasses || {};

        const info = {};
        for (const name of Object.keys(DynamicCreatures)) {
            info[name] = {
                registered: name in AnimalClasses,
                hasError: name in DynamicCreatureErrors,
                error: DynamicCreatureErrors[name]?.error || null
            };
        }
        return info;
    });
}

/**
 * Get creature statistics and counts
 */
export async function getCreatureStats(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        const stats = {
            totalCreatures: game.animals?.length || 0,
            entitiesTracked: game.spawnManager.entities.size,
            creaturesByType: {}
        };

        // Count creatures by type
        if (game.animals) {
            for (const animal of game.animals) {
                const typeName = animal.constructor.name;
                stats.creaturesByType[typeName] = (stats.creaturesByType[typeName] || 0) + 1;
            }
        }

        // Get allowed creatures filter info
        const allowed = game.spawnManager.allowedCreatures;
        stats.allowAll = allowed === null;
        stats.allowedCreatures = allowed ? Array.from(allowed) : null;

        // Get ambient manager stats
        if (game.entityManager) {
            stats.ambientManagers = {
                birdManager: game.entityManager.birdManager?.count || 0,
                butterflyManager: game.entityManager.butterflyManager?.count || 0,
                pixieManager: game.entityManager.pixieManager?.count || 0,
                batManager: game.entityManager.batManager?.count || 0,
                mosquitoManager: game.entityManager.mosquitoManager?.count || 0
            };
        }

        return stats;
    });
}

/**
 * Detect what's in front of the player using raycasting
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} maxDistance - Maximum detection distance
 */
export async function detectInFront(browser, maxDistance = 50) {
    return await executeInBrowser(browser, (dist) => {
        const game = window.__VOXEL_GAME__;
        const vw = window.VoxelWorld;
        if (!game?.player || !game.camera) return { error: 'Game not ready' };

        const THREE = window.THREE;
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3();
        game.camera.getWorldDirection(direction);

        raycaster.set(game.camera.position, direction);
        raycaster.far = dist;

        const results = {
            block: null,
            entity: null,
            sdkObject: null,
            distance: null
        };

        // Check for block intersection
        if (game.physicsManager?.targetBlock) {
            const tb = game.physicsManager.targetBlock;
            results.block = {
                type: tb.type,
                position: { x: tb.x, y: tb.y, z: tb.z }
            };
        }

        // Check entities (animals)
        if (game.animals) {
            const meshes = game.animals
                .filter(a => a.mesh)
                .map(a => a.mesh);

            const hits = raycaster.intersectObjects(meshes, true);
            if (hits.length > 0) {
                const hit = hits[0];
                const animal = game.animals.find(a =>
                    a.mesh === hit.object || a.mesh === hit.object.parent
                );
                if (animal) {
                    results.entity = {
                        type: animal.constructor.name,
                        distance: hit.distance.toFixed(2),
                        position: animal.position ? {
                            x: Math.round(animal.position.x),
                            y: Math.round(animal.position.y),
                            z: Math.round(animal.position.z)
                        } : null,
                        health: animal.health
                    };
                    results.distance = hit.distance;
                }
            }
        }

        // Check SDK instances
        if (vw?._instances) {
            const sdkMeshes = [];
            const meshToInstance = new Map();

            for (const inst of vw._instances) {
                if (inst.mesh && !inst._destroyed) {
                    sdkMeshes.push(inst.mesh);
                    meshToInstance.set(inst.mesh, inst);
                }
            }

            if (sdkMeshes.length > 0) {
                const hits = raycaster.intersectObjects(sdkMeshes, true);
                if (hits.length > 0) {
                    const hit = hits[0];
                    // Find the root mesh
                    let obj = hit.object;
                    while (obj.parent && !meshToInstance.has(obj)) {
                        obj = obj.parent;
                    }
                    const inst = meshToInstance.get(obj) || meshToInstance.get(hit.object);

                    if (inst && (!results.distance || hit.distance < results.distance)) {
                        results.sdkObject = {
                            name: inst.name,
                            id: inst.id,
                            distance: hit.distance.toFixed(2),
                            position: inst.position ? {
                                x: Math.round(inst.position.x),
                                y: Math.round(inst.position.y),
                                z: Math.round(inst.position.z)
                            } : null,
                            scripts: inst._scripts?.map(s => s.type || s.constructor?.name).filter(Boolean) || []
                        };
                        results.distance = hit.distance;
                    }
                }
            }
        }

        return results;
    }, maxDistance);
}

/**
 * Detect ALL objects around the player (not just in front)
 * Returns everything within radius: SDK objects, animals, blocks, drops, etc.
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} radius - Detection radius (default 50)
 */
export async function detectAround(browser, radius = 50) {
    return await executeInBrowser(browser, (r) => {
        const game = window.__VOXEL_GAME__;
        const vw = window.VoxelWorld;
        if (!game?.player) return { error: 'Game not ready' };

        const playerPos = game.player.position;
        const results = {
            playerPosition: {
                x: Math.round(playerPos.x),
                y: Math.round(playerPos.y),
                z: Math.round(playerPos.z)
            },
            radius: r,
            sdkObjects: [],
            animals: [],
            drops: [],
            sceneMeshes: []
        };

        // Helper to check if in range
        const inRange = (pos) => {
            if (!pos) return false;
            const dx = pos.x - playerPos.x;
            const dy = pos.y - playerPos.y;
            const dz = pos.z - playerPos.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz) <= r;
        };

        // Check SDK instances
        if (vw?._instances) {
            for (const inst of vw._instances) {
                if (inst._destroyed) continue;
                if (inst.position && inRange(inst.position)) {
                    results.sdkObjects.push({
                        name: inst.name,
                        id: inst.id,
                        position: {
                            x: Math.round(inst.position.x),
                            y: Math.round(inst.position.y),
                            z: Math.round(inst.position.z)
                        },
                        hasMesh: !!inst.mesh,
                        meshInScene: inst.mesh?.parent?.type === 'Scene',
                        meshVisible: inst.mesh?.visible !== false,
                        scripts: inst._scripts?.map(s => s.type || s.constructor?.name).filter(Boolean) || []
                    });
                }
            }
        }

        // Check animals
        if (game.animals) {
            for (const animal of game.animals) {
                if (animal.position && inRange(animal.position)) {
                    results.animals.push({
                        type: animal.constructor.name,
                        id: animal.id,
                        position: {
                            x: Math.round(animal.position.x),
                            y: Math.round(animal.position.y),
                            z: Math.round(animal.position.z)
                        },
                        health: animal.health
                    });
                }
            }
        }

        // Check drops/items on ground
        if (game.drops) {
            for (const drop of game.drops) {
                if (drop.position && inRange(drop.position)) {
                    results.drops.push({
                        item: drop.item || drop.type,
                        position: {
                            x: Math.round(drop.position.x),
                            y: Math.round(drop.position.y),
                            z: Math.round(drop.position.z)
                        }
                    });
                }
            }
        }

        // Get some scene info for meshes near player (for debugging)
        if (game.scene) {
            game.scene.traverse((obj) => {
                if (obj.isMesh && obj.position) {
                    const worldPos = obj.getWorldPosition(new window.THREE.Vector3());
                    if (inRange(worldPos) && results.sceneMeshes.length < 10) {
                        results.sceneMeshes.push({
                            name: obj.name || 'unnamed',
                            type: obj.type,
                            geometryType: obj.geometry?.type,
                            visible: obj.visible,
                            position: {
                                x: Math.round(worldPos.x),
                                y: Math.round(worldPos.y),
                                z: Math.round(worldPos.z)
                            }
                        });
                    }
                }
            });
        }

        results.summary = {
            sdkObjectCount: results.sdkObjects.length,
            animalCount: results.animals.length,
            dropCount: results.drops.length
        };

        return results;
    }, radius);
}

/**
 * Get all objects visible in the player's view frustum
 * Uses the camera's frustum to determine what the player can currently see
 * @param {Object} browser - Puppeteer browser instance
 * @param {Object} options - Options for visibility check
 * @param {number} options.maxDistance - Maximum distance to check (default: 100)
 * @param {boolean} options.includeAnimals - Include animals/entities (default: true)
 * @param {boolean} options.includeChunks - Include terrain chunks (default: false)
 * @param {boolean} options.checkOcclusion - Check line-of-sight occlusion (default: false)
 * @returns {Object} Object with visible entities, counts, and player view info
 */
export async function getObjectsInView(browser, options = {}) {
    return await executeInBrowser(browser, (opts) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player || !game?.camera) return { error: 'Game not ready' };

        const {
            maxDistance = 100,
            includeAnimals = true,
            includeChunks = false,
            checkOcclusion = false
        } = opts;

        // Use the game's built-in getObjectsInView if available
        if (typeof game.getObjectsInView === 'function') {
            const rawResults = game.getObjectsInView({
                maxDistance,
                includeAnimals,
                includeChunks,
                checkOcclusion
            });

            // Strip the THREE.js object references for serialization
            const serializable = rawResults.map(obj => {
                const { object, ...rest } = obj;
                return rest;
            });

            // Group entities by type
            const byType = {};
            for (const obj of serializable) {
                if (obj.type === 'entity') {
                    byType[obj.entityType] = (byType[obj.entityType] || 0) + 1;
                }
            }

            return {
                success: true,
                viewInfo: {
                    playerPosition: {
                        x: Math.round(game.player.position.x * 10) / 10,
                        y: Math.round(game.player.position.y * 10) / 10,
                        z: Math.round(game.player.position.z * 10) / 10
                    },
                    cameraDirection: {
                        x: Math.round(game.camera.getWorldDirection(new window.THREE.Vector3()).x * 100) / 100,
                        y: Math.round(game.camera.getWorldDirection(new window.THREE.Vector3()).y * 100) / 100,
                        z: Math.round(game.camera.getWorldDirection(new window.THREE.Vector3()).z * 100) / 100
                    },
                    maxDistance,
                    checkOcclusion
                },
                objects: serializable,
                summary: {
                    total: serializable.length,
                    entities: serializable.filter(o => o.type === 'entity').length,
                    chunks: serializable.filter(o => o.type === 'chunk').length,
                    byType
                }
            };
        }

        return { error: 'getObjectsInView not available on game object' };
    }, options);
}

/**
 * Verify that a specific entity type is visible to the player
 * Useful for testing if AI-created objects appear correctly
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} entityType - Entity type name to look for (e.g., 'Slime', 'Wolf')
 * @param {Object} options - Additional options
 * @param {number} options.maxDistance - Maximum distance to check (default: 50)
 * @param {number} options.minCount - Minimum number expected (default: 1)
 * @returns {Object} Verification result with found status and details
 */
export async function verifyEntityVisible(browser, entityType, options = {}) {
    const { maxDistance = 50, minCount = 1 } = options;

    const viewResult = await getObjectsInView(browser, {
        maxDistance,
        includeAnimals: true,
        checkOcclusion: false
    });

    if (viewResult.error) {
        return { success: false, error: viewResult.error };
    }

    const matchingEntities = viewResult.objects.filter(
        obj => obj.type === 'entity' &&
               obj.entityType.toLowerCase() === entityType.toLowerCase()
    );

    return {
        success: matchingEntities.length >= minCount,
        found: matchingEntities.length,
        expected: minCount,
        entityType,
        entities: matchingEntities,
        message: matchingEntities.length >= minCount
            ? `Found ${matchingEntities.length} ${entityType}(s) in view`
            : `Expected ${minCount} ${entityType}(s) but found ${matchingEntities.length}`
    };
}

/**
 * Diagnose entity health - check for common issues like falling through ground
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} entityType - Optional: filter by entity type
 * @returns {Object} Diagnostic results with issues found
 */
export async function diagnoseEntities(browser, entityType = null) {
    return await executeInBrowser(browser, (filterType) => {
        const game = window.__VOXEL_GAME__;
        const VoxelWorld = window.VoxelWorld;
        if (!game) return { error: 'Game not ready' };

        const results = {
            timestamp: Date.now(),
            issues: [],
            healthy: [],
            summary: { total: 0, healthy: 0, issues: 0 }
        };

        // Check SDK instances
        const sdkInstances = VoxelWorld?._instances ? [...VoxelWorld._instances] : [];

        // Check game animals
        const animals = game.animals || [];

        // Combine all entities
        const allEntities = [
            ...sdkInstances.map(e => ({ source: 'sdk', entity: e, name: e.name })),
            ...animals.map(e => ({ source: 'animal', entity: e, name: e.constructor?.name || 'Unknown' }))
        ];

        for (const { source, entity, name } of allEntities) {
            if (filterType && name.toLowerCase() !== filterType.toLowerCase()) continue;

            results.summary.total++;

            const issues = [];
            let pos = null;

            // Get position
            if (entity.mesh?.position) {
                pos = entity.mesh.position;
            } else if (entity.position) {
                pos = entity.position;
            } else if (entity.transform?.position) {
                pos = entity.transform.position;
            }

            if (!pos) {
                issues.push('NO_POSITION: Entity has no position');
            } else {
                // Check if below world (falling through ground)
                if (pos.y < -10) {
                    issues.push(`FELL_THROUGH_GROUND: Y=${pos.y.toFixed(1)} (below -10)`);
                }

                // Check if way too high (stuck in sky)
                if (pos.y > 200) {
                    issues.push(`TOO_HIGH: Y=${pos.y.toFixed(1)} (above 200)`);
                }

                // Get expected ground level
                if (game.getGroundLevel && pos.y < -10) {
                    const groundY = game.getGroundLevel(pos.x, pos.z);
                    issues.push(`GROUND_LEVEL_AT_POS: ${groundY}`);
                }
            }

            // Check for mesh
            if (!entity.mesh) {
                issues.push('NO_MESH: Entity has no visible mesh');
            }

            // Check SDK-specific issues
            if (source === 'sdk') {
                const hasPhysics = entity.hasScript?.('PhysicsScript');
                const hasAI = entity.hasScript?.('AIScript');

                if (hasPhysics) {
                    const physics = entity.getScript('PhysicsScript');
                    if (physics && !physics.grounded && pos && pos.y < 0) {
                        issues.push('PHYSICS_NOT_GROUNDED: Physics says not grounded but Y < 0');
                    }
                }

                if (!hasPhysics && hasAI) {
                    issues.push('AI_WITHOUT_PHYSICS: Has AI but no physics (cannot move properly)');
                }
            }

            const entityInfo = {
                name,
                source,
                position: pos ? { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) } : null,
                issues
            };

            if (issues.length > 0) {
                results.issues.push(entityInfo);
                results.summary.issues++;
            } else {
                results.healthy.push(entityInfo);
                results.summary.healthy++;
            }
        }

        return results;
    }, entityType);
}

/**
 * Watch an entity's position over time to detect falling/stuck issues
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} entityName - Name of entity to watch
 * @param {number} duration - How long to watch in ms (default 3000)
 * @param {number} interval - Check interval in ms (default 500)
 */
export async function watchEntity(browser, entityName, duration = 3000, interval = 500) {
    const samples = [];
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
        const sample = await executeInBrowser(browser, (name) => {
            const VoxelWorld = window.VoxelWorld;
            const game = window.__VOXEL_GAME__;

            // Find in SDK instances
            let entity = null;
            if (VoxelWorld?._instances) {
                entity = [...VoxelWorld._instances].find(e =>
                    e.name?.toLowerCase() === name.toLowerCase()
                );
            }

            // Find in game animals
            if (!entity && game?.animals) {
                entity = game.animals.find(a =>
                    a.constructor?.name?.toLowerCase() === name.toLowerCase()
                );
            }

            if (!entity) return { error: 'Entity not found', name };

            let pos = entity.mesh?.position || entity.position || entity.transform?.position;
            if (!pos) return { error: 'No position', name };

            const groundY = game?.getGroundLevel?.(pos.x, pos.z) ?? null;

            return {
                time: Date.now(),
                y: pos.y,
                x: pos.x,
                z: pos.z,
                groundY,
                grounded: entity.getScript?.('PhysicsScript')?.grounded ?? null
            };
        }, entityName);

        samples.push(sample);
        await new Promise(r => setTimeout(r, interval));
    }

    // Analyze samples
    const analysis = {
        entityName,
        samples,
        issues: []
    };

    if (samples.length >= 2 && !samples[0].error) {
        const firstY = samples[0].y;
        const lastY = samples[samples.length - 1].y;
        const deltaY = lastY - firstY;

        // Check if continuously falling
        if (deltaY < -5) {
            analysis.issues.push(`FALLING: Dropped ${Math.abs(deltaY).toFixed(1)} units over ${duration}ms`);
        }

        // Check if below ground
        if (lastY < -10) {
            analysis.issues.push(`BELOW_WORLD: Final Y=${lastY.toFixed(1)}`);
        }

        // Check if below terrain
        const lastSample = samples[samples.length - 1];
        if (lastSample.groundY !== null && lastY < lastSample.groundY - 2) {
            analysis.issues.push(`BELOW_TERRAIN: Y=${lastY.toFixed(1)}, ground=${lastSample.groundY}`);
        }
    }

    analysis.healthy = analysis.issues.length === 0;
    return analysis;
}

/**
 * Print entity diagnostics in a nice format
 */
export function printDiagnostics(results) {
    if (results.error) {
        console.log(chalk.red(`Error: ${results.error}`));
        return;
    }

    console.log(chalk.blue('\n═══ Entity Diagnostics ═══'));
    console.log(`Total: ${results.summary.total} | Healthy: ${chalk.green(results.summary.healthy)} | Issues: ${chalk.red(results.summary.issues)}`);

    if (results.issues.length > 0) {
        console.log(chalk.red('\n─── Issues Found ───'));
        for (const entity of results.issues) {
            console.log(chalk.yellow(`\n${entity.name} (${entity.source}):`));
            console.log(`  Position: ${entity.position ? `(${entity.position.x}, ${entity.position.y}, ${entity.position.z})` : 'N/A'}`);
            for (const issue of entity.issues) {
                console.log(chalk.red(`  ⚠ ${issue}`));
            }
        }
    }

    if (results.healthy.length > 0 && results.healthy.length <= 10) {
        console.log(chalk.green('\n─── Healthy Entities ───'));
        for (const entity of results.healthy) {
            console.log(`  ✓ ${entity.name} at (${entity.position?.x}, ${entity.position?.y}, ${entity.position?.z})`);
        }
    }
}
