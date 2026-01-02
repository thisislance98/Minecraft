
export const VerificationUtils = {
    /**
     * Scan for blocks and log their positions for AI verification
     * @param {Object} game - Game instance
     * @param {string} materialId - Block ID to check
     * @param {Object} center - Approx center position (uses spawn point if not provided)
     * @param {number} radius - Search radius (default 25 for wider coverage)
     * @returns {Object} { success, message, count }
     */
    logBlockPositions: (game, materialId, center, radius = 25) => {
        const blocks = [];
        // Use spawn point (32, 37, 32) as default if center is near origin
        const defaultCenter = center && (Math.abs(center.x) > 10 || Math.abs(center.z) > 10)
            ? center
            : { x: 32, y: 37, z: 32 };
        const pos = {
            x: Math.floor(defaultCenter.x),
            y: Math.floor(defaultCenter.y),
            z: Math.floor(defaultCenter.z)
        };

        console.log(`[Verification] Scanning for ${materialId} within radius ${radius} of ${pos.x},${pos.y},${pos.z}`);

        for (let x = pos.x - radius; x <= pos.x + radius; x++) {
            for (let y = pos.y - 10; y <= pos.y + 20; y++) {
                for (let z = pos.z - radius; z <= pos.z + radius; z++) {
                    const block = game.getBlock(x, y, z);
                    if (block && block.id === materialId) {
                        blocks.push({ x, y, z });
                        console.log(`[Verification] Found ${materialId} at ${x},${y},${z}`);
                    }
                }
            }
        }

        if (blocks.length === 0) {
            console.log(`[Verification] No ${materialId} blocks found.`);
            return { success: false, message: `No ${materialId} blocks found.` };
        }

        console.log(`[Verification] Summary: Found ${blocks.length} ${materialId} blocks.`);
        return {
            success: true,
            message: `Logged ${blocks.length} ${materialId} blocks.`,
            count: blocks.length
        };
    },

    /**
     * Verify object is relative to player
     */
    verifyRelativePosition: (game, position, targetDist, tolerance = 3.0) => {
        const playerPos = game.player.position;

        const dx = position.x - playerPos.x;
        const dz = position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (Math.abs(dist - targetDist) > tolerance) {
            return {
                success: false,
                message: `Object at dist ${dist.toFixed(1)}. Expected ${targetDist} (+/- ${tolerance}).`
            };
        }

        return { success: true, message: `Object correctly encountered at distance ${dist.toFixed(1)}` };
    }
};
