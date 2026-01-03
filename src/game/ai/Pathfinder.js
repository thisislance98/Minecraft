import * as THREE from 'three';
import { Blocks } from '../core/Blocks.js';

class PriorityQueue {
    constructor() {
        this.elements = [];
    }

    enqueue(element, priority) {
        this.elements.push({ element, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    dequeue() {
        return this.elements.shift().element;
    }

    isEmpty() {
        return this.elements.length === 0;
    }
}

export class Pathfinder {
    constructor(game) {
        this.game = game;
    }

    /**
     * Find a path from start to end
     * @param {THREE.Vector3} start - Start position
     * @param {THREE.Vector3} end - Target position
     * @param {number} maxSteps - strict limit on iterations to prevent lag
     * @returns {Array<THREE.Vector3>|null} - Array of points or null if no path
     */
    findPath(start, end, maxSteps = 2000) {
        const startNode = {
            x: Math.floor(start.x),
            y: Math.floor(start.y),
            z: Math.floor(start.z),
            g: 0,
            h: 0,
            f: 0,
            parent: null
        };

        const targetNode = {
            x: Math.floor(end.x),
            y: Math.floor(end.y),
            z: Math.floor(end.z)
        };

        // If target is in passable block (air), drop it to nearest ground
        let dropCount = 0;
        while (!this.isSolid(targetNode.x, targetNode.y - 1, targetNode.z) && dropCount < 5) {
            targetNode.y--;
            dropCount++;
        }

        // If target is in air, drop it to ground?
        // For now assume target is valid.

        const openList = new PriorityQueue();
        const closedSet = new Set();

        // Helper key function
        const key = (n) => `${n.x},${n.y},${n.z}`;

        startNode.h = this.heuristic(startNode, targetNode);
        startNode.f = startNode.h;

        openList.enqueue(startNode, startNode.f);
        const openSet = new Map(); // For fast lookups in open list
        openSet.set(key(startNode), startNode);

        let steps = 0;

        while (!openList.isEmpty()) {
            steps++;
            if (steps > maxSteps) {
                // Return partial path or null?
                // Let's return closest node found so far?
                return null;
            }

            const current = openList.dequeue();
            const cKey = key(current);
            openSet.delete(cKey);
            closedSet.add(cKey);

            // Check if reached target (within distance 1 or exact block?)
            // Exact block match can be hard if target is moving or slightly off.
            // Let's say if we are at the same X/Z and Y is close enough.
            if (Math.abs(current.x - targetNode.x) <= 1 &&
                Math.abs(current.z - targetNode.z) <= 1 &&
                Math.abs(current.y - targetNode.y) <= 2) {
                return this.reconstructPath(current);
            }

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const nKey = key(neighbor);
                if (closedSet.has(nKey)) continue;

                const gScore = current.g + neighbor.cost;

                const existing = openSet.get(nKey);
                if (!existing || gScore < existing.g) {
                    neighbor.g = gScore;
                    neighbor.h = this.heuristic(neighbor, targetNode);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = current;

                    if (!existing) {
                        openList.enqueue(neighbor, neighbor.f);
                        openSet.set(nKey, neighbor);
                    } else {
                        // Update existing (re-sort not implemented in simple PQ, so just add again? NO, duplicate entries bad)
                        // With simple array sort PQ, we can just update properties and it might be out of order until next sort?
                        // Actually my PQ implementation sorts on enqueue. 
                        // Lazy approach: just add it again. The first one popped will be the best.
                        openList.enqueue(neighbor, neighbor.f);
                        openSet.set(nKey, neighbor);
                    }
                }
            }
        }

        return null; // No path found
    }

    heuristic(a, b) {
        // Manhattan distance usually better for grid
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
    }

    reconstructPath(node) {
        const path = [];
        let curr = node;
        while (curr) {
            // Center of block
            path.push(new THREE.Vector3(curr.x + 0.5, curr.y, curr.z + 0.5));
            curr = curr.parent;
        }
        return path.reverse();
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            { x: 1, z: 0 }, { x: -1, z: 0 },
            { x: 0, z: 1 }, { x: 0, z: -1 }
        ];

        for (const dir of directions) {
            const nx = node.x + dir.x;
            const nz = node.z + dir.z;

            // 1. Flat Move
            // Current Y
            if (!this.isSolid(nx, node.y, nz) &&
                !this.isSolid(nx, node.y + 1, nz) &&
                this.isSolid(nx, node.y - 1, nz)) {
                neighbors.push({ x: nx, y: node.y, z: nz, cost: 1 });
                continue;
            }

            // 2. Step Up (1 block)
            // Block in front is solid, but space above it is empty
            // And we have headroom to jump
            if (this.isSolid(nx, node.y, nz) &&
                !this.isSolid(nx, node.y + 1, nz) &&
                !this.isSolid(nx, node.y + 2, nz) &&
                !this.isSolid(node.x, node.y + 2, node.z)) { // Headroom at current pos
                neighbors.push({ x: nx, y: node.y + 1, z: nz, cost: 1.5 });
                continue;
            }

            // 3. Drop Down (up to 3 blocks)
            if (!this.isSolid(nx, node.y, nz) &&
                !this.isSolid(nx, node.y + 1, nz) &&
                !this.isSolid(nx, node.y - 1, nz)) { // Gap!

                for (let i = 2; i <= 4; i++) {
                    const dropY = node.y - i;
                    if (this.isSolid(nx, dropY, nz)) {
                        // Found ground
                        // Check headroom at target
                        if (!this.isSolid(nx, dropY + 1, nz) &&
                            !this.isSolid(nx, dropY + 2, nz)) {
                            neighbors.push({ x: nx, y: dropY + 1, z: nz, cost: 1 + (i * 0.5) });
                        }
                        break;
                    }
                }
            }
        }

        // Diagonals? Can be tricky with wall collisions. Let's stick to cardinal for now (Manhattan style).
        // It's safer for strict block movement.

        return neighbors;
    }

    isSolid(x, y, z) {
        const block = this.game.getBlock(x, y, z);
        if (!block) return false; // Treat null/undefined as air

        // Whitelist of passable blocks
        const PASSABLE = new Set([
            Blocks.AIR,
            Blocks.WATER,
            Blocks.DOOR_OPEN,
            Blocks.DOOR_CLOSED, // Villagers can open doors (conceptually)
            Blocks.TORCH,
            Blocks.FLOWER_RED,
            Blocks.FLOWER_YELLOW,
            Blocks.FLOWER_BLUE,
            Blocks.MUSHROOM_RED,
            Blocks.MUSHROOM_BROWN,
            Blocks.LONG_GRASS,
            Blocks.FERN,
            Blocks.DEAD_BUSH,
            Blocks.LADDER,
            Blocks.SIGN,
            Blocks.FIRE,
            Blocks.SNOW // If it's the layer type? Assuming block type for now
        ]);

        return !PASSABLE.has(block);
    }
}
