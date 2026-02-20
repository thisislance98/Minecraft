export class Pathfinder {
    static findPath(game, startPos, endPos, maxSteps = 100) {
        // Simple A* implementation
        // startPos and endPos are THREE.Vector3-like objects (floats)
        // We convert them to integers for the grid

        const startNode = {
            x: Math.floor(startPos.x),
            y: Math.floor(startPos.y),
            z: Math.floor(startPos.z),
            g: 0,
            h: 0,
            f: 0,
            parent: null
        };

        const endNode = {
            x: Math.floor(endPos.x),
            y: Math.floor(endPos.y),
            z: Math.floor(endPos.z)
        };

        const openList = [];
        const closedList = new Map();

        openList.push(startNode);

        // Limit iterations to prevent freezing
        let iterations = 0;

        while (openList.length > 0 && iterations < maxSteps) {
            iterations++;

            // Get node with lowest f
            let currentNode = openList[0];
            let currentIndex = 0;

            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < currentNode.f) {
                    currentNode = openList[i];
                    currentIndex = i;
                }
            }

            // Pop current
            openList.splice(currentIndex, 1);

            const key = `${currentNode.x},${currentNode.y},${currentNode.z}`;
            closedList.set(key, currentNode);

            // Found goal? (Check within distance of 1, not exact match, to carry over 'close enough')
            // Actually exact match for voxel pathing is usually best, but endPos might be inside a block?
            // Let's rely on integer coordinates.
            const dist = Math.abs(currentNode.x - endNode.x) + Math.abs(currentNode.y - endNode.y) + Math.abs(currentNode.z - endNode.z);
            if (dist <= 1) {
                // Return path
                return Pathfinder.reconstructPath(currentNode);
            }

            const children = [];
            const moves = [
                { x: 0, z: -1 }, // North
                { x: 0, z: 1 },  // South
                { x: -1, z: 0 }, // West
                { x: 1, z: 0 }   // East
            ];

            for (const move of moves) {
                // Current base coords
                const cx = currentNode.x;
                const cy = currentNode.y;
                const cz = currentNode.z;

                // Target X/Z
                const nx = cx + move.x;
                const nz = cz + move.z;

                // 3 Possible Target Ys: Same level, Jump Up, Drop Down
                let ny = cy;
                let valid = false;
                let cost = 1;

                // 1. Move Flat
                if (!game.getBlock(nx, cy, nz) && !game.getBlock(nx, cy + 1, nz)) {
                    // Check ground support
                    if (game.getBlock(nx, cy - 1, nz)) {
                        ny = cy;
                        valid = true;
                    }
                    // 3. Drop Down (up to 3 blocks)
                    else {
                        // Check down 1
                        if (game.getBlock(nx, cy - 2, nz)) { // Solid at y-2 means we stand at y-1
                            ny = cy - 1;
                            valid = true;
                            cost = 1.2;
                        } else if (game.getBlock(nx, cy - 3, nz)) { // Solid at y-3 means we stand at y-2
                            ny = cy - 2;
                            valid = true;
                            cost = 1.5;
                        }
                        // Else too deep hole
                    }
                }
                // 2. Jump Up (1 block)
                else if (game.getBlock(nx, cy, nz)) { // Wall in front
                    // Check if we can stand on top of it
                    if (!game.getBlock(nx, cy + 1, nz) && !game.getBlock(nx, cy + 2, nz)) {
                        // Check head clearance above current position before jumping?
                        // Usually not strictly enforced in simple MC physics unless tightly enclosed, 
                        // but good to check current head room: !game.getBlock(cx, cy + 2, cz)
                        if (!game.getBlock(cx, cy + 2, cz)) {
                            ny = cy + 1;
                            valid = true;
                            cost = 1.3;
                        }
                    }
                }

                if (valid) {
                    const neighbor = {
                        x: nx,
                        y: ny,
                        z: nz,
                        g: 0,
                        h: 0,
                        f: 0,
                        parent: currentNode
                    };
                    children.push(neighbor);
                }
            }

            for (const child of children) {
                const childKey = `${child.x},${child.y},${child.z}`;

                if (closedList.has(childKey)) {
                    continue;
                }

                child.g = currentNode.g + 1; // Simplistic cost
                child.h = Math.abs(child.x - endNode.x) + Math.abs(child.y - endNode.y) + Math.abs(child.z - endNode.z);
                child.f = child.g + child.h;

                // Check open list
                let inOpen = false;
                for (const openNode of openList) {
                    if (openNode.x === child.x && openNode.y === child.y && openNode.z === child.z) {
                        if (child.g > openNode.g) {
                            inOpen = true; // Use existing better path
                            break;
                        }
                    }
                }

                if (!inOpen) {
                    openList.push(child);
                }
            }
        }

        // Return best effort if no path found? 
        // Or null? Let's return null to indicate failure.
        return null;
    }

    static reconstructPath(node) {
        const path = [];
        let curr = node;
        while (curr) {
            path.push({ x: curr.x, y: curr.y, z: curr.z });
            curr = curr.parent;
        }
        return path.reverse(); // Start to End
    }
}
