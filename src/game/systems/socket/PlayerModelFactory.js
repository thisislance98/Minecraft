import * as THREE from 'three';

/**
 * PlayerModelFactory - Creates 3D character models for remote players
 */
export class PlayerModelFactory {
    // Shared geometries and materials (cached for performance)
    static _assets = null;

    static getAssets() {
        if (!PlayerModelFactory._assets) {
            PlayerModelFactory._assets = PlayerModelFactory.createAssets();
        }
        return PlayerModelFactory._assets;
    }

    static createAssets() {
        const geometries = {
            torso: new THREE.BoxGeometry(0.6, 0.65, 0.3),
            head: new THREE.BoxGeometry(0.5, 0.5, 0.5),
            hair: new THREE.BoxGeometry(0.55, 0.2, 0.55),
            eye: new THREE.BoxGeometry(0.08, 0.08, 0.02),
            pupil: new THREE.BoxGeometry(0.04, 0.04, 0.02),
            nose: new THREE.BoxGeometry(0.06, 0.06, 0.06),
            arm: new THREE.BoxGeometry(0.2, 0.55, 0.2),
            hand: new THREE.BoxGeometry(0.12, 0.12, 0.08),
            leg: new THREE.BoxGeometry(0.25, 0.55, 0.25),
            foot: new THREE.BoxGeometry(0.2, 0.1, 0.35),
            broomStick: new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8),
            broomHead: new THREE.BoxGeometry(0.25, 0.4, 0.15)
        };

        const materials = {
            shirt: new THREE.MeshLambertMaterial({ color: 0x3366FF }),
            skin: new THREE.MeshLambertMaterial({ color: 0xFFDBAC }),
            hair: new THREE.MeshLambertMaterial({ color: 0x3D2314 }),
            eyeWhite: new THREE.MeshBasicMaterial({ color: 0xFFFFFF }),
            pupil: new THREE.MeshBasicMaterial({ color: 0x000000 }),
            mouth: new THREE.MeshBasicMaterial({ color: 0xCC6666 }),
            pants: new THREE.MeshLambertMaterial({ color: 0x333366 }),
            shoes: new THREE.MeshLambertMaterial({ color: 0x333333 }),
            arm: new THREE.MeshLambertMaterial({ color: 0x4488FF }),
            broomStick: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            broomHead: new THREE.MeshLambertMaterial({ color: 0xD2691E })
        };

        return { geometries, materials };
    }

    /**
     * Create a name label sprite for a player
     */
    static createNameLabel(playerName) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.roundRect(0, 16, 256, 32, 8);
        context.fill();

        context.font = 'Bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Shadow
        context.fillStyle = 'black';
        context.fillText(playerName, 130, 34);

        // Text
        context.fillStyle = 'white';
        context.fillText(playerName, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 0.5, 1);
        return sprite;
    }

    /**
     * Create a health bar sprite
     */
    static createHealthBar() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 32;

        // Background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(4, 8, 120, 16);

        // Health fill (full by default)
        context.fillStyle = '#00FF00';
        context.fillRect(6, 10, 116, 12);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 0.375, 1);

        sprite.userData = {
            canvas,
            context,
            texture,
            maxWidth: 116
        };

        return sprite;
    }

    /**
     * Update health bar display
     */
    static updateHealthBar(healthBarSprite, health, maxHealth) {
        if (!healthBarSprite || !healthBarSprite.userData) return;

        const { canvas, context, texture, maxWidth } = healthBarSprite.userData;
        const percentage = Math.max(0, Math.min(1, health / maxHealth));
        const fillWidth = maxWidth * percentage;

        // Clear and redraw
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(4, 8, 120, 16);

        // Health fill with color gradient based on health
        if (percentage > 0.5) {
            context.fillStyle = '#00FF00'; // Green
        } else if (percentage > 0.25) {
            context.fillStyle = '#FFFF00'; // Yellow
        } else {
            context.fillStyle = '#FF0000'; // Red
        }

        if (fillWidth > 0) {
            context.fillRect(6, 10, fillWidth, 12);
        }

        texture.needsUpdate = true;
    }

    /**
     * Create a flying broom for the player model
     */
    static createRidingBroom() {
        const { geometries, materials } = PlayerModelFactory.getAssets();
        const broom = new THREE.Group();

        // Stick
        const stick = new THREE.Mesh(geometries.broomStick, materials.broomStick);
        stick.rotation.x = Math.PI / 2;
        broom.add(stick);

        // Broom head
        const head = new THREE.Mesh(geometries.broomHead, materials.broomHead);
        head.position.z = -0.5;
        broom.add(head);

        return broom;
    }

    /**
     * Create a full character model
     */
    static createCharacterModel(id, playerName = 'Player', shirtColor = null) {
        const group = new THREE.Group();

        // Name label
        const nameLabel = PlayerModelFactory.createNameLabel(playerName);
        nameLabel.position.set(0, 2.9, 0);
        group.add(nameLabel);

        // Health bar
        const healthBar = PlayerModelFactory.createHealthBar();
        healthBar.position.set(0, 2.6, 0);
        group.add(healthBar);

        // Get cached assets
        const { geometries, materials: sharedMaterials } = PlayerModelFactory.getAssets();

        // Clone materials for this instance
        const materials = {};
        for (const [key, mat] of Object.entries(sharedMaterials)) {
            materials[key] = mat.clone();
        }

        // Randomize shirt color if not provided
        if (shirtColor !== null && shirtColor !== undefined) {
            materials.shirt.color.setHex(shirtColor);
        } else {
            const shirtColors = [
                0xFF5733, 0x33FF57, 0x3357FF, 0xFF33A8,
                0xFFD700, 0x00CED1, 0x9400D3, 0xFF6347,
                0x20B2AA, 0x8B4513, 0x4169E1, 0xDC143C
            ];
            materials.shirt.color.setHex(shirtColors[Math.floor(Math.random() * shirtColors.length)]);
        }

        // Torso
        const torso = new THREE.Mesh(geometries.torso, materials.shirt);
        torso.position.y = 1.05;
        group.add(torso);

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.675;
        group.add(headGroup);

        const head = new THREE.Mesh(geometries.head, materials.skin);
        headGroup.add(head);

        // Hair
        const hair = new THREE.Mesh(geometries.hair, materials.hair);
        hair.position.y = 0.2;
        headGroup.add(hair);

        // Eyes
        const createEye = (x) => {
            const eye = new THREE.Group();
            const white = new THREE.Mesh(geometries.eye, materials.eyeWhite);
            const pupil = new THREE.Mesh(geometries.pupil, materials.pupil);
            pupil.position.z = -0.03;
            eye.add(white, pupil);
            eye.position.set(x, 0, -0.251);
            return eye;
        };
        headGroup.add(createEye(-0.12), createEye(0.12));

        // Nose
        const nose = new THREE.Mesh(geometries.nose, materials.skin);
        nose.position.set(0, -0.05, -0.28);
        headGroup.add(nose);

        // Right Arm
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(-0.4, 1.15, 0);
        group.add(rightArmGroup);

        const rightArm = new THREE.Mesh(geometries.arm, materials.arm);
        rightArm.position.y = -0.25;
        rightArmGroup.add(rightArm);

        const rightHand = new THREE.Mesh(geometries.hand, materials.skin);
        rightHand.position.y = -0.55;
        rightArmGroup.add(rightHand);

        // Tool attachment point
        const toolAttachment = new THREE.Group();
        toolAttachment.position.set(0, -0.6, -0.15);
        toolAttachment.rotation.set(Math.PI / 2, 0, 0);
        rightArmGroup.add(toolAttachment);

        // Left Arm
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(0.4, 1.15, 0);
        group.add(leftArmGroup);

        const leftArm = new THREE.Mesh(geometries.arm, materials.arm);
        leftArm.position.y = -0.25;
        leftArmGroup.add(leftArm);

        const leftHand = new THREE.Mesh(geometries.hand, materials.skin);
        leftHand.position.y = -0.55;
        leftArmGroup.add(leftHand);

        // Right Leg
        const rightLegGroup = new THREE.Group();
        rightLegGroup.position.set(-0.15, 0.6, 0);
        group.add(rightLegGroup);

        const rightLeg = new THREE.Mesh(geometries.leg, materials.pants);
        rightLeg.position.y = -0.2;
        rightLegGroup.add(rightLeg);

        const rightFoot = new THREE.Mesh(geometries.foot, materials.shoes);
        rightFoot.position.set(0, -0.5, -0.05);
        rightLegGroup.add(rightFoot);

        // Left Leg
        const leftLegGroup = new THREE.Group();
        leftLegGroup.position.set(0.15, 0.6, 0);
        group.add(leftLegGroup);

        const leftLeg = new THREE.Mesh(geometries.leg, materials.pants);
        leftLeg.position.y = -0.2;
        leftLegGroup.add(leftLeg);

        const leftFoot = new THREE.Mesh(geometries.foot, materials.shoes);
        leftFoot.position.set(0, -0.5, -0.05);
        leftLegGroup.add(leftFoot);

        // Riding broom (hidden by default)
        const ridingBroom = PlayerModelFactory.createRidingBroom();
        ridingBroom.position.set(0, 0.4, 0);
        ridingBroom.rotation.x = Math.PI / 12;
        ridingBroom.visible = false;
        group.add(ridingBroom);

        return {
            group,
            nameLabel,
            healthBar,
            headGroup,
            torso,
            rightArmGroup,
            rightArm,
            rightHand,
            leftArmGroup,
            leftArm,
            leftHand,
            rightLegGroup,
            rightLeg,
            leftLegGroup,
            leftLeg,
            toolAttachment,
            ridingBroom,
            shirtMaterial: materials.shirt,
            targetPosition: new THREE.Vector3(),
            targetRotationY: 0,
            animTime: 0,
            isCrouching: false,
            isFlying: false,
            isDying: false,
            buffer: []
        };
    }
}
