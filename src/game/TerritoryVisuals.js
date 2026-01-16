import * as THREE from 'three';

/**
 * TerritoryVisuals - Handles visual representation of territories
 */
export class TerritoryVisuals {
    constructor(game) {
        this.game = game;
        this.boundaryLines = new Map(); // territoryId -> THREE.Line
        this.particles = new Map(); // territoryId -> particle systems
    }

    /**
     * Create boundary visualization for a territory
     */
    createBoundary(territory) {
        // Create a line around the territory border
        const { minX, maxX, minZ, maxZ } = territory.bounds;
        const y = 45; // Height above ground

        const points = [
            new THREE.Vector3(minX, y, minZ),
            new THREE.Vector3(maxX, y, minZ),
            new THREE.Vector3(maxX, y, maxZ),
            new THREE.Vector3(minX, y, maxZ),
            new THREE.Vector3(minX, y, minZ) // Close the loop
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: territory.owner === 'localPlayer' ? 0x4CAF50 : 0xFFEB3B,
            linewidth: 2,
            transparent: true,
            opacity: 0.6
        });

        const line = new THREE.Line(geometry, material);
        this.game.scene.add(line);
        this.boundaryLines.set(territory.id, line);

        // Add corner markers
        this.createCornerMarkers(territory, y);
    }

    /**
     * Create markers at territory corners
     */
    createCornerMarkers(territory, y) {
        const { minX, maxX, minZ, maxZ } = territory.bounds;
        const corners = [
            [minX, y, minZ],
            [maxX, y, minZ],
            [maxX, y, maxZ],
            [minX, y, maxZ]
        ];

        const markerGroup = new THREE.Group();

        corners.forEach(([x, y, z]) => {
            const geometry = new THREE.CylinderGeometry(0.5, 0.5, 5, 8);
            const material = new THREE.MeshBasicMaterial({
                color: territory.owner === 'localPlayer' ? 0x4CAF50 : 0xFFEB3B,
                transparent: true,
                opacity: 0.7
            });
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(x, y, z);
            markerGroup.add(marker);
        });

        this.game.scene.add(markerGroup);

        // Store reference
        if (!this.boundaryLines.has(territory.id + '_markers')) {
            this.boundaryLines.set(territory.id + '_markers', markerGroup);
        }
    }

    /**
     * Create ambient particles for active territory
     */
    createParticles(territory) {
        // Simple particle effect - could be enhanced
        const particleCount = 50;
        const { minX, maxX, minZ, maxZ } = territory.bounds;

        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = minX + Math.random() * (maxX - minX);
            positions[i * 3 + 1] = 40 + Math.random() * 10;
            positions[i * 3 + 2] = minZ + Math.random() * (maxZ - minZ);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x4CAF50,
            size: 0.3,
            transparent: true,
            opacity: 0.6
        });

        const particles = new THREE.Points(geometry, material);
        this.game.scene.add(particles);
        this.particles.set(territory.id, particles);
    }

    /**
     * Update particles animation
     */
    update(deltaTime) {
        for (const [territoryId, particles] of this.particles) {
            // Animate particles floating up
            const positions = particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += deltaTime * 2; // Float upward

                // Reset if too high
                if (positions[i + 1] > 60) {
                    positions[i + 1] = 40;
                }
            }
            particles.geometry.attributes.position.needsUpdate = true;
        }
    }

    /**
     * Remove boundary visualization
     */
    removeBoundary(territoryId) {
        const line = this.boundaryLines.get(territoryId);
        if (line) {
            this.game.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
            this.boundaryLines.delete(territoryId);
        }

        const markers = this.boundaryLines.get(territoryId + '_markers');
        if (markers) {
            this.game.scene.remove(markers);
            this.boundaryLines.delete(territoryId + '_markers');
        }

        const particles = this.particles.get(territoryId);
        if (particles) {
            this.game.scene.remove(particles);
            particles.geometry.dispose();
            particles.material.dispose();
            this.particles.delete(territoryId);
        }
    }

    /**
     * Show all territory boundaries
     */
    showAllBoundaries(territoryManager) {
        for (const territory of territoryManager.territories.values()) {
            if (!this.boundaryLines.has(territory.id)) {
                this.createBoundary(territory);
            }
        }
    }

    /**
     * Hide all boundaries
     */
    hideAllBoundaries() {
        for (const territoryId of this.boundaryLines.keys()) {
            this.removeBoundary(territoryId);
        }
    }
}
