import { Item } from './Item.js';
import * as THREE from 'three';

/**
 * GrapplingHookItem - A tool that shoots a hook and pulls the player toward the target.
 *
 * Right-click to fire the grappling hook toward where you're looking.
 * The hook attaches to the first surface it hits and pulls you toward it.
 * Right-click again (or release) to cancel the grapple mid-flight.
 */
export class GrapplingHookItem extends Item {
    constructor() {
        super('grappling_hook', 'Grappling Hook');
        this.maxStack = 1;
        this.isTool = true;
        this.fireCooldown = 800;
        this.lastFireTime = 0;
        this.isGrappling = false;
        this.grappleTarget = null;
        this.grappleLine = null;
        this.grappleSpeed = 28;
        this.maxRange = 60;
        this._animFrame = null;
        this._gameRef = null;
        this._playerRef = null;
    }

    onUseDown(game, player) {
        const now = performance.now();

        // If already grappling, cancel it
        if (this.isGrappling) {
            this.stopGrapple(game);
            return true;
        }

        // Cooldown check
        if (now - this.lastFireTime < this.fireCooldown) return false;
        this.lastFireTime = now;

        // Raycast from camera to find target
        const raycaster = new THREE.Raycaster();
        raycaster.far = this.maxRange;
        const direction = new THREE.Vector3();
        game.camera.getWorldDirection(direction);
        raycaster.set(game.camera.position.clone(), direction);

        // Find intersections with scene objects
        const intersects = raycaster.intersectObjects(game.scene.children, true);

        let hitPoint = null;
        for (const hit of intersects) {
            // Skip invisible/transparent/line objects
            if (hit.object.visible === false) continue;
            if (hit.object instanceof THREE.Line || hit.object instanceof THREE.LineSegments) continue;
            if (hit.object.material && hit.object.material.transparent && hit.object.material.opacity < 0.3) continue;
            // Skip very close hits (our own rope, etc)
            if (hit.distance < 1.5) continue;
            hitPoint = hit.point.clone();
            break;
        }

        if (!hitPoint) {
            return false; // Nothing to grapple to
        }

        // Start grappling!
        this.isGrappling = true;
        this.grappleTarget = hitPoint;
        this._gameRef = game;
        this._playerRef = player;

        // Create visual rope line
        const points = [game.camera.position.clone(), hitPoint];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x8B7355, linewidth: 2 });
        this.grappleLine = new THREE.Line(lineGeo, lineMat);
        game.scene.add(this.grappleLine);

        // Trigger arm swing
        if (player.swingArm) player.swingArm();

        // Start the pull animation loop
        this._startPullLoop();

        return true;
    }

    onUseUp(game, player) {
        // Stop grapple on release
        if (this.isGrappling) {
            this.stopGrapple(game);
            return true;
        }
        return false;
    }

    _startPullLoop() {
        const self = this;
        let lastTime = performance.now();

        function pullFrame() {
            if (!self.isGrappling || !self.grappleTarget || !self._playerRef) {
                return;
            }

            const now = performance.now();
            const dt = Math.min((now - lastTime) / 1000, 0.05); // Cap dt to prevent huge jumps
            lastTime = now;

            const player = self._playerRef;
            const game = self._gameRef;

            // Update rope visual
            if (self.grappleLine && game) {
                const positions = self.grappleLine.geometry.attributes.position;
                if (positions) {
                    // Update start point to camera position
                    const camPos = game.camera.position;
                    positions.setXYZ(0, camPos.x, camPos.y, camPos.z);
                    positions.needsUpdate = true;
                }
            }

            // Calculate direction to target
            const toTarget = new THREE.Vector3().subVectors(self.grappleTarget, player.position);
            const dist = toTarget.length();

            // Reached target - stop
            if (dist < 2.5) {
                // Give a small upward boost on arrival
                if (player.velocity) {
                    player.velocity.y = 4;
                    player.velocity.x *= 0.3;
                    player.velocity.z *= 0.3;
                }
                self.stopGrapple(game);
                return;
            }

            // Apply velocity toward grapple point
            const moveDir = toTarget.normalize();
            if (player.velocity) {
                player.velocity.x = moveDir.x * self.grappleSpeed;
                player.velocity.y = moveDir.y * self.grappleSpeed + 2; // Small upward bias to counteract gravity
                player.velocity.z = moveDir.z * self.grappleSpeed;
            }

            self._animFrame = requestAnimationFrame(pullFrame);
        }

        this._animFrame = requestAnimationFrame(pullFrame);
    }

    stopGrapple(game) {
        this.isGrappling = false;
        this.grappleTarget = null;

        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }

        if (this.grappleLine && game) {
            game.scene.remove(this.grappleLine);
            if (this.grappleLine.geometry) this.grappleLine.geometry.dispose();
            if (this.grappleLine.material) this.grappleLine.material.dispose();
            this.grappleLine = null;
        }

        this._gameRef = null;
        this._playerRef = null;
    }

    // Clean up if item is deselected
    onDeselect(game, player) {
        if (this.isGrappling) {
            this.stopGrapple(game);
        }
    }

    getMesh() {
        const group = new THREE.Group();

        // Handle/grip (dark brown wood)
        const handleGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.35, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = -0.15;
        group.add(handle);

        // Barrel/mechanism housing (dark metal)
        const barrelGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.2, 8);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.y = 0.08;
        group.add(barrel);

        // Spool (rope drum)
        const spoolGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8);
        const spoolMat = new THREE.MeshStandardMaterial({ color: 0x8B7355 });
        const spool = new THREE.Mesh(spoolGeo, spoolMat);
        spool.position.y = 0.08;
        spool.rotation.x = Math.PI / 2;
        group.add(spool);

        // Hook shaft
        const hookMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.3 });
        const shaftGeo = new THREE.BoxGeometry(0.04, 0.22, 0.04);
        const shaft = new THREE.Mesh(shaftGeo, hookMat);
        shaft.position.y = 0.3;
        group.add(shaft);

        // Hook prong left
        const prong1Geo = new THREE.BoxGeometry(0.1, 0.04, 0.04);
        const prong1 = new THREE.Mesh(prong1Geo, hookMat);
        prong1.position.set(-0.05, 0.4, 0);
        prong1.rotation.z = -0.4;
        group.add(prong1);

        // Hook prong right
        const prong2 = new THREE.Mesh(prong1Geo.clone(), hookMat);
        prong2.position.set(0.05, 0.4, 0);
        prong2.rotation.z = 0.4;
        group.add(prong2);

        // Hook tips (pointed downward)
        const tipGeo = new THREE.BoxGeometry(0.03, 0.07, 0.03);
        const tip1 = new THREE.Mesh(tipGeo, hookMat);
        tip1.position.set(-0.1, 0.37, 0);
        group.add(tip1);

        const tip2 = new THREE.Mesh(tipGeo.clone(), hookMat);
        tip2.position.set(0.1, 0.37, 0);
        group.add(tip2);

        return group;
    }
}
