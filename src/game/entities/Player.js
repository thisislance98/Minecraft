// Player entity
import * as THREE from 'three';
import { Config } from '../core/Config.js';
import { ThirdPersonCamera } from '../systems/ThirdPersonCamera.js';

/**
 * Player class handles player state, physics, body model, and animation
 */
export class Player {
    constructor(game) {
        this.game = game;

        // Player state - Random spawn position within world bounds
        const worldRadius = Config.WORLD.WORLD_RADIUS_CHUNKS * Config.WORLD.CHUNK_SIZE;
        const spawnX = Math.floor(Math.random() * worldRadius * 2) - worldRadius;
        const spawnZ = Math.floor(Math.random() * worldRadius * 2) - worldRadius;
        const spawnY = Config.PLAYER.SPAWN_POINT.y; // Start high to land safely

        this.position = new THREE.Vector3(spawnX, spawnY, spawnZ);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = { x: 0, y: Math.PI };
        this.orbitRotation = { x: 0, y: 0 }; // Camera orbit angles
        this.height = Config.PLAYER.HEIGHT;
        this.width = Config.PLAYER.WIDTH;
        this.onGround = false;
        this.speed = Config.PLAYER.SPEED;
        this.sprintMultiplier = Config.PLAYER.SPRINT_MULTIPLIER;
        this.jumpForce = Config.PLAYER.JUMP_FORCE;
        this.isDead = false;

        // Health (hunger system disabled)
        this.health = Config.PLAYER.MAX_HEALTH;       // Max 20 (displayed as 10 hearts)
        this.maxHealth = Config.PLAYER.MAX_HEALTH;
        this.regenTimer = 0;
        this.lastPosition = null;
        this.highestY = 0; // Track highest point for fall damage
        this.stepSmoothingY = 0; // Visual offset for smooth step-ups

        // Animation
        this.armSwingAngle = 0;
        this.isMoving = false;
        this.isMining = false;
        this.miningTimer = 0;
        this.wasSpacePressed = false;
        this.cameraMode = 0; // 0: First Person, 1: Third Person (smooth follow)
        this.wasCPressed = false;

        // Third person camera controller
        this.thirdPersonCamera = new ThirdPersonCamera(game, {
            offset: new THREE.Vector3(0, 6, 12),       // Higher and further back
            lookAtOffset: new THREE.Vector3(0, 2, -15), // Look far ahead of player so crosshair aims forward
            smoothing: 0.02,                           // Very smooth follow
            enableCollision: true
        });
        this.isFlying = false;
        this.flightTime = 0;

        // Animation state
        this.swingCompleted = false; // Init flag
        this.mount = null;

        // Body parts
        this.body = null;
        this.leftArmPivot = null;
        this.rightArmPivot = null;
        this.leftArm = null;
        this.rightArm = null;
        this.leftLegPivot = null;
        this.rightLegPivot = null;
        this.leftLeg = null;
        this.rightLeg = null;

        // Speech bubble for player chat
        this.speechBubble = null;
        this.speechCanvas = null;
        this.speechContext = null;
        this.speechTexture = null;
        this.speechTimer = 0;

        this.createBody();
        this.createSpeechBubble();
    }

    /**
     * Create speech bubble sprite for local player chat
     */
    createSpeechBubble() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        this.speechCanvas = canvas;
        this.speechContext = canvas.getContext('2d');

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        this.speechTexture = texture;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2.5, 0.625, 1);
        // Position above the body (which is attached to camera)
        // Body is at y=-0.3, head is at y=0.2, so bubble should be above that in world space
        sprite.position.set(0, 0.8, -0.4); // Above head relative to camera
        sprite.visible = false;
        this.game.camera.add(sprite);
        this.speechBubble = sprite;
    }

    /**
     * Show speech bubble with text for a duration
     */
    showSpeechBubble(text, duration = 5) {
        if (!this.speechContext) return;

        const ctx = this.speechContext;
        const canvas = this.speechCanvas;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!text) {
            this.speechBubble.visible = false;
            return;
        }

        // Draw bubble background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;

        const padding = 20;
        const radius = 20;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2, radius);
        } else {
            ctx.rect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxLength = 40;
        const displayText = text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
        ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);

        this.speechTexture.needsUpdate = true;
        this.speechBubble.visible = true;
        this.speechTimer = duration;
    }

    /**
     * Update speech bubble timer (called from update loop)
     */
    updateSpeechBubble(deltaTime) {
        if (this.speechTimer > 0) {
            this.speechTimer -= deltaTime;
            if (this.speechTimer <= 0) {
                this.speechTimer = 0;
                this.speechBubble.visible = false;
            }
        }
    }

    createBody() {
        // Colors matching Minecraft Steve skin
        const skinColor = 0xB58D6E; // Steve's tan

        // Load shirt color from localStorage or pick a random one
        let shirtColor;
        const savedColor = localStorage.getItem('settings_shirt_color');
        if (savedColor) {
            shirtColor = parseInt(savedColor);
        } else {
            const shirtColors = [
                0xFF5733, // Orange-red
                0x33FF57, // Green
                0x3357FF, // Blue
                0xFF33A8, // Pink
                0xFFD700, // Gold
                0x00CED1, // Dark cyan
                0x9400D3, // Dark violet
                0xFF6347, // Tomato
                0x20B2AA, // Light sea green
                0x8B4513, // Saddle brown
                0x4169E1, // Royal blue
                0xDC143C, // Crimson
            ];
            shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
            localStorage.setItem('settings_shirt_color', shirtColor);
        }

        const pantsColor = 0x3333AA; // Indigo/Blue

        const skinMaterial = new THREE.MeshLambertMaterial({ color: skinColor });
        this.shirtMaterial = new THREE.MeshLambertMaterial({ color: shirtColor });
        const pantsMaterial = new THREE.MeshLambertMaterial({ color: pantsColor });

        this.body = new THREE.Group();

        // Torso
        const torsoWidth = 0.5;
        const torsoHeight = 0.75;
        const torsoDepth = 0.25;

        const torsoGeom = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
        this.torso = new THREE.Mesh(torsoGeom, this.shirtMaterial);
        this.torso.position.set(0, -0.5, 0);
        this.body.add(this.torso);

        // Arms dimensions
        const armWidth = 0.25;
        const armHeight = 0.7;
        const armDepth = 0.25;

        // Left Arm
        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-torsoWidth / 2 - armWidth / 2, -0.15, 0);
        const leftArmGeom = new THREE.BoxGeometry(armWidth, armHeight, armDepth);
        this.leftArm = new THREE.Mesh(leftArmGeom, skinMaterial);
        this.leftArm.position.set(0, -armHeight / 2, 0);
        this.leftArmPivot.add(this.leftArm);
        this.body.add(this.leftArmPivot);

        // Right Arm
        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(torsoWidth / 2 + armWidth / 2, -0.15, 0);
        const rightArmGeom = new THREE.BoxGeometry(armWidth, armHeight, armDepth);
        this.rightArm = new THREE.Mesh(rightArmGeom, skinMaterial);
        this.rightArm.position.set(0, -armHeight / 2, 0);
        this.rightArmPivot.add(this.rightArm);
        this.body.add(this.rightArmPivot);

        // Tool Attachment Point
        this.toolAttachment = new THREE.Group();
        this.toolAttachment.position.set(0, -0.35, 0);
        this.toolAttachment.rotation.set(Math.PI / 2, Math.PI / 2, 0);
        this.rightArm.add(this.toolAttachment);

        // Legs dimensions
        const legWidth = 0.25;
        const legHeight = 0.7;
        const legDepth = 0.25;

        // Left Leg
        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-legWidth / 2, -0.87, 0);
        const leftLegGeom = new THREE.BoxGeometry(legWidth, legHeight, legDepth);
        this.leftLeg = new THREE.Mesh(leftLegGeom, pantsMaterial);
        this.leftLeg.position.set(0, -legHeight / 2, 0);
        this.leftLegPivot.add(this.leftLeg);
        this.body.add(this.leftLegPivot);

        // Right Leg
        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(legWidth / 2, -0.87, 0);
        const rightLegGeom = new THREE.BoxGeometry(legWidth, legHeight, legDepth);
        this.rightLeg = new THREE.Mesh(rightLegGeom, pantsMaterial);
        this.rightLeg.position.set(0, -legHeight / 2, 0);
        this.rightLegPivot.add(this.rightLeg);
        this.body.add(this.rightLegPivot);

        // Head
        const headSize = 0.5;
        const headGeom = new THREE.BoxGeometry(headSize, headSize, headSize);
        this.head = new THREE.Mesh(headGeom, skinMaterial);
        this.head.position.set(0, 0.2, 0); // Position above torso
        this.body.add(this.head);

        // Hair (Hat layer)
        const hairSize = headSize + 0.05; // Slightly larger
        const hairGeom = new THREE.BoxGeometry(hairSize, hairSize * 0.25, hairSize);
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x4A3222 }); // Dark Brown
        this.hair = new THREE.Mesh(hairGeom, hairMat);
        this.hair.position.set(0, headSize / 2 - (hairSize * 0.25) / 2 + 0.02, 0); // Top of head
        this.head.add(this.hair);

        // Hair Sides/Back (Simplified as extra boxes or just texture... let's use boxes for 3D look)
        // Back hair
        const backHairGeom = new THREE.BoxGeometry(hairSize, headSize, 0.05);
        const backHair = new THREE.Mesh(backHairGeom, hairMat);
        backHair.position.set(0, 0, 0.26);
        this.head.add(backHair);

        // Sideburns
        const sideHairGeom = new THREE.BoxGeometry(0.05, headSize, hairSize);
        // Left
        const leftSideHair = new THREE.Mesh(sideHairGeom, hairMat);
        leftSideHair.position.set(-0.26, 0, 0);
        this.head.add(leftSideHair);
        // Right
        const rightSideHair = new THREE.Mesh(sideHairGeom, hairMat);
        rightSideHair.position.set(0.26, 0, 0);
        this.head.add(rightSideHair);


        // Eyes
        const eyeSize = 0.08;
        const eyeGeom = new THREE.BoxGeometry(eyeSize, eyeSize, 0.05);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // White
        const pupilGeom = new THREE.BoxGeometry(eyeSize / 2, eyeSize / 2, 0.01);
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x493B7F }); // Steve's Indigo/Purple eyes

        // Left Eye group
        const leftEye = new THREE.Group();
        const leWhite = new THREE.Mesh(eyeGeom, eyeMat);
        const lePupil = new THREE.Mesh(pupilGeom, pupilMat);
        lePupil.position.z = -0.03; // In front of white (-Z direction)
        lePupil.position.x = 0; // Centered
        leftEye.add(leWhite);
        leftEye.add(lePupil);

        leftEye.position.set(-0.12, 0.0, -0.25); // Lowered slightly
        this.head.add(leftEye);

        // Right Eye group
        const rightEye = leftEye.clone();
        rightEye.position.set(0.12, 0.0, -0.25);
        this.head.add(rightEye);

        // Mouth / Beard area
        const mouthGeom = new THREE.BoxGeometry(0.2, 0.06, 0.05);
        const mouthMat = new THREE.MeshLambertMaterial({ color: 0x4A3222 }); // Dark brown
        const mouth = new THREE.Mesh(mouthGeom, mouthMat);
        mouth.position.set(0, -0.12, -0.25);
        this.head.add(mouth);

        // Position body - adjusted for "swing both arms" visibility
        this.body.position.set(0, -0.3, -0.4);

        // Add to camera so it moves with player view
        this.game.camera.add(this.body);

        // Add pickaxe
        this.createPickaxe();

        // Initialize head visibility based on camera mode
        if (this.cameraMode === 0 && this.head) {
            this.head.visible = false;
        }
    }

    /**
     * Update the player's shirt color
     * @param {number} color - Hex color
     */
    setShirtColor(color) {
        if (this.shirtMaterial) {
            this.shirtMaterial.color.setHex(color);
        }
    }

    mountEntity(entity) {
        console.log('[Player] Attempting to mount:', entity.constructor.name, 'isRideable:', entity.isRideable);
        if (entity.isRideable === false) return;
        if (this.mount) this.dismount();
        this.mount = entity;
        entity.rider = this;
        // Move player to entity position
        this.position.copy(entity.position);
        this.velocity.set(0, 0, 0);
    }

    dismount() {
        if (this.mount) {
            this.mount.rider = null;
            this.mount = null;
            // Pop player up slightly
            this.velocity.y = 5;
        }
    }

    createPickaxe() {
        const handleColor = 0x5C4033; // Dark wood
        const headColor = 0x00CED1;   // Diamond mostly

        // Create handle - player grips at top, handle extends downward
        const handleGeom = new THREE.BoxGeometry(0.04, 0.6, 0.04);
        // Use depthTest: false so pickaxe renders on top of blocks
        const handleMat = new THREE.MeshLambertMaterial({ color: handleColor, depthTest: false });
        const handle = new THREE.Mesh(handleGeom, handleMat);
        handle.renderOrder = 999; // Render on top
        // Position handle so the grip point (top) is at origin, handle extends down
        handle.position.y = -0.3; // Half the handle length down

        // Create pickaxe head at the bottom of the handle
        const headGeom = new THREE.BoxGeometry(0.4, 0.04, 0.04);
        const headMat = new THREE.MeshLambertMaterial({ color: headColor, depthTest: false });
        const head = new THREE.Mesh(headGeom, headMat);
        head.renderOrder = 999; // Render on top
        head.position.y = -0.55; // At the end of the handle, away from grip

        // Create a pivot group for the pickaxe
        const pickaxe = new THREE.Group();
        pickaxe.add(handle);
        pickaxe.add(head);

        // Reset transforms as they are now handled by toolAttachment
        pickaxe.position.set(0, 0, 0);
        pickaxe.rotation.set(0, 0, 0);

        this.toolAttachment.add(pickaxe);
        this.pickaxe = pickaxe; // Store reference

        this.createBow();
        this.createSword();
        this.createWand();
        this.createLevitationWand();
        this.createShrinkWand();
        this.createGrowthWand();

        this.createRideWand();
        this.createWizardTowerWand();
        this.createBroom();
        this.createBinoculars();
        this.createFoodModels();
        this.createFurnitureModels();
        this.updateHeldItemVisibility();
    }

    /**
     * Factory method to create a wand with consistent styling
     * @param {number} tipColor - Hex color for the gem tip
     * @param {number} handleColor - Hex color for the handle (default: wood brown)
     * @returns {THREE.Group} - The wand group (hidden by default)
     */
    createWandModel(tipColor, handleColor = 0x5C4033) {
        const wandGroup = new THREE.Group();

        // Handle (Stick)
        const handleGeo = new THREE.BoxGeometry(0.04, 0.4, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: handleColor, depthTest: false });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.2;
        wandGroup.add(handle);

        // Tip (Gem)
        const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const tipMat = new THREE.MeshBasicMaterial({ color: tipColor, depthTest: false });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 999;
        tip.position.y = -0.42;
        wandGroup.add(tip);

        wandGroup.position.set(0, 0, 0);
        wandGroup.rotation.set(0, 0, 0);

        this.toolAttachment.add(wandGroup);
        wandGroup.visible = false;
        return wandGroup;
    }

    createWand() {
        this.wand = this.createWandModel(0xFF00FF); // Magenta
    }

    createLevitationWand() {
        this.levitationWand = this.createWandModel(0xFFFF00); // Yellow
    }

    createShrinkWand() {
        this.shrinkWand = this.createWandModel(0x00FFFF, 0x3d2b1f); // Cyan, darker handle
    }

    createGrowthWand() {
        this.growthWand = this.createWandModel(0x00FF00, 0x3d2b1f); // Green, darker handle
    }

    createRideWand() {
        this.rideWand = this.createWandModel(0x8B4513); // Saddle Brown
    }

    createWizardTowerWand() {
        this.wizardTowerWand = this.createWandModel(0x8A2BE2); // BlueViolet
    }

    createBroom() {
        const broomGroup = new THREE.Group();

        // Handle (Stick)
        const handleColor = 0x5C4033;
        const handleGeo = new THREE.BoxGeometry(0.08, 2.0, 0.08); // Doubled size
        const handleMat = new THREE.MeshLambertMaterial({ color: handleColor }); // Enable depthTest
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.3;
        broomGroup.add(handle);

        // Brush (Straw)
        const brushColor = 0xC19A6B; // Wheat/Tan
        const brushGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24); // Doubled size
        const brushMat = new THREE.MeshLambertMaterial({ color: brushColor }); // Enable depthTest
        const brush = new THREE.Mesh(brushGeo, brushMat);
        brush.renderOrder = 999;
        brush.position.y = -0.8; // Bottom
        broomGroup.add(brush);

        // Position handled by toolAttachment
        broomGroup.position.set(0, 0, 0);
        broomGroup.rotation.y = Math.PI; // Turn 180 degrees

        this.toolAttachment.add(broomGroup);
        this.broom = broomGroup;
        this.broom.visible = false;

        // --- Riding Broom (Attached to Body) ---
        const ridingBroom = broomGroup.clone();
        // Adjust for sitting position (under body) - Moved up slightly
        ridingBroom.position.set(0, -0.6, -0.6); // Moved forward (up in Z relative to user intent?)
        ridingBroom.rotation.set(-Math.PI / 2, 0, 0); // Flat forward (90 deg)

        this.body.add(ridingBroom);
        this.ridingBroom = ridingBroom;
        this.ridingBroom.visible = false;
    }

    createSword() {
        const handleColor = 0x5C4033; // Dark wood
        const guardColor = 0x8B4513;  // Brownish guard
        const bladeColor = 0xE6E6E6;  // Iron/Steel color

        const swordGroup = new THREE.Group();

        // Handle - length 0.2, extends from 0 to -0.2
        const handleGeom = new THREE.BoxGeometry(0.04, 0.2, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: handleColor, depthTest: false });
        const handle = new THREE.Mesh(handleGeom, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.1;
        swordGroup.add(handle);

        // Guard (cross-piece) - at the end of the handle
        const guardGeom = new THREE.BoxGeometry(0.15, 0.04, 0.06);
        const guardMat = new THREE.MeshLambertMaterial({ color: guardColor, depthTest: false });
        const guard = new THREE.Mesh(guardGeom, guardMat);
        guard.renderOrder = 999;
        guard.position.y = -0.2;
        swordGroup.add(guard);

        // Blade - length 0.6, starts at -0.2, center at -0.5
        const bladeGeom = new THREE.BoxGeometry(0.08, 0.6, 0.02);
        const bladeMat = new THREE.MeshLambertMaterial({ color: bladeColor, depthTest: false });
        const blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.renderOrder = 999;
        blade.position.y = -0.5;
        swordGroup.add(blade);

        // Position handled by toolAttachment
        swordGroup.position.set(0, 0, 0);
        swordGroup.rotation.set(0, 0, 0);

        this.toolAttachment.add(swordGroup);
        this.sword = swordGroup;
    }

    createFoodModels() {
        // Apple Model
        this.apple = new THREE.Group();
        const appleSkin = new THREE.MeshLambertMaterial({ color: 0xFF0000, depthTest: false });
        const appleStem = new THREE.MeshLambertMaterial({ color: 0x5C4033, depthTest: false });

        // Body
        // Increased size: 0.15 -> 0.3
        const bodyGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const body = new THREE.Mesh(bodyGeo, appleSkin);
        body.renderOrder = 999;
        this.apple.add(body);

        // Stem
        const stemGeo = new THREE.BoxGeometry(0.04, 0.1, 0.04);
        const stem = new THREE.Mesh(stemGeo, appleStem);
        stem.renderOrder = 999;
        stem.position.y = 0.16; // Adjusted for larger body
        this.apple.add(stem);

        // Position in hand
        this.apple.position.set(0, -0.35, -0.15); // Lowered slightly
        this.apple.visible = false;
        this.rightArm.add(this.apple);

        // Bread Model
        this.bread = new THREE.Group();
        const breadCrust = new THREE.MeshLambertMaterial({ color: 0xD2691E, depthTest: false }); // Chocolate color, kinda brownish
        const breadInside = new THREE.MeshLambertMaterial({ color: 0xF4A460, depthTest: false }); // Sandy brown

        // Loaf shape - make it a bit oblong
        // Increased size: 0.15, 0.1, 0.25 -> 0.3, 0.2, 0.5
        const loafGeo = new THREE.BoxGeometry(0.3, 0.2, 0.5);
        const loaf = new THREE.Mesh(loafGeo, breadCrust);
        loaf.renderOrder = 999;
        this.bread.add(loaf);

        // Position in hand
        this.bread.position.set(0, -0.35, -0.15);
        this.bread.rotation.y = Math.PI / 2; // Hold it lengthwise
        this.bread.visible = false;
        this.rightArm.add(this.bread);

        // Chocolate Bar Model
        this.chocolateBar = new THREE.Group();
        const chocoColor = 0x5c3317; // Dark chocolate
        const wrapperColor = 0xC0C0C0; // Silver

        const barGeo = new THREE.BoxGeometry(0.25, 0.05, 0.4);
        const barMat = new THREE.MeshLambertMaterial({ color: chocoColor, depthTest: false });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.renderOrder = 999;
        this.chocolateBar.add(bar);

        // Wrapper (bottom half)
        const wrapGeo = new THREE.BoxGeometry(0.26, 0.06, 0.2);
        const wrapMat = new THREE.MeshLambertMaterial({ color: wrapperColor, depthTest: false });
        const wrap = new THREE.Mesh(wrapGeo, wrapMat);
        wrap.renderOrder = 999;
        wrap.position.z = 0.1;
        this.chocolateBar.add(wrap);

        this.chocolateBar.position.set(0, -0.35, -0.15);
        this.chocolateBar.rotation.y = Math.PI / 2;
        this.chocolateBar.visible = false;
        this.rightArm.add(this.chocolateBar);
    }

    createFurnitureModels() {
        // Chair Model (Mini)
        this.chairModel = new THREE.Group();
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513, depthTest: false }); // Saddle Brown

        // Seat
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), woodMat);
        seat.position.y = 0;
        this.chairModel.add(seat);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.05, 0.25, 0.05);
        const fl = new THREE.Mesh(legGeo, woodMat); fl.position.set(-0.1, -0.15, -0.1); this.chairModel.add(fl);
        const fr = new THREE.Mesh(legGeo, woodMat); fr.position.set(0.1, -0.15, -0.1); this.chairModel.add(fr);
        const bl = new THREE.Mesh(legGeo, woodMat); bl.position.set(-0.1, -0.15, 0.1); this.chairModel.add(bl);
        const br = new THREE.Mesh(legGeo, woodMat); br.position.set(0.1, -0.15, 0.1); this.chairModel.add(br);

        // Back
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), woodMat);
        back.position.set(0, 0.15, -0.12);
        this.chairModel.add(back);

        this.chairModel.position.set(0, -0.5, 0);
        this.chairModel.scale.set(0.8, 0.8, 0.8);
        this.chairModel.visible = false;

        // Add to hand (toolAttachment is better for tools, rightArm direct add for items usually)
        // Let's use rightArm like food
        this.rightArm.add(this.chairModel);

        // Table Model (Mini)
        this.tableModel = new THREE.Group();
        const tableMat = new THREE.MeshLambertMaterial({ color: 0x5C4033, depthTest: false });

        const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), tableMat);
        top.position.y = 0.1;
        this.tableModel.add(top);

        // Legs
        const tLegGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
        const tfl = new THREE.Mesh(tLegGeo, tableMat); tfl.position.set(-0.15, -0.05, -0.15); this.tableModel.add(tfl);
        const tfr = new THREE.Mesh(tLegGeo, tableMat); tfr.position.set(0.15, -0.05, -0.15); this.tableModel.add(tfr);
        const tbl = new THREE.Mesh(tLegGeo, tableMat); tbl.position.set(-0.15, -0.05, 0.15); this.tableModel.add(tbl);
        const tbr = new THREE.Mesh(tLegGeo, tableMat); tbr.position.set(0.15, -0.05, 0.15); this.tableModel.add(tbr);

        this.tableModel.position.set(0, -0.5, 0);
        this.tableModel.scale.set(0.8, 0.8, 0.8);
        this.tableModel.visible = false;
        this.rightArm.add(this.tableModel);

        // Couch Model (Mini)
        this.couchModel = new THREE.Group();
        const fabricMat = new THREE.MeshLambertMaterial({ color: 0xAA3333, depthTest: false });

        const cBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.25), fabricMat);
        this.couchModel.add(cBase);

        const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.05), fabricMat);
        cBack.position.set(0, 0.2, -0.1);
        this.couchModel.add(cBack);

        const cLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.25), fabricMat);
        cLeft.position.set(-0.25, 0.1, 0);
        this.couchModel.add(cLeft);

        const cRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.25), fabricMat);
        cRight.position.set(0.25, 0.1, 0);
        this.couchModel.add(cRight);

        this.couchModel.position.set(0, -0.5, 0);
        this.couchModel.scale.set(0.6, 0.6, 0.6); // Slightly smaller to fit
        this.couchModel.visible = false;
        this.rightArm.add(this.couchModel);
    }

    createBinoculars() {
        const binoculars = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({ color: 0x333333, depthTest: false }); // Dark grey

        // Left Tube
        const leftTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8), material);
        leftTube.rotation.x = Math.PI / 2;
        leftTube.position.set(-0.06, 0, 0);
        leftTube.renderOrder = 999;
        binoculars.add(leftTube);

        // Right Tube
        const rightTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8), material);
        rightTube.rotation.x = Math.PI / 2;
        rightTube.position.set(0.06, 0, 0);
        rightTube.renderOrder = 999;
        binoculars.add(rightTube);

        // Bridge
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), material);
        bridge.position.set(0, 0, 0);
        bridge.renderOrder = 999;
        binoculars.add(bridge);

        // Position - adjusted to look held
        binoculars.position.set(0, -0.3, 0);

        this.toolAttachment.add(binoculars);
        this.binoculars = binoculars;
        this.binoculars.visible = false;
    }

    createBow() {
        const bowGroup = new THREE.Group();

        // Bow Body - wood material
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513, depthTest: false });

        // Center handle (grip)
        const handleGeo = new THREE.BoxGeometry(0.04, 0.15, 0.05);
        const handle = new THREE.Mesh(handleGeo, woodMat);
        handle.renderOrder = 999;
        handle.position.y = -0.3; // In hand position
        bowGroup.add(handle);

        // Upper Limb
        const upperGeo = new THREE.BoxGeometry(0.03, 0.25, 0.04);
        const upper = new THREE.Mesh(upperGeo, woodMat);
        upper.renderOrder = 999;
        upper.position.set(0, -0.15, -0.08);
        upper.rotation.x = -0.4;
        bowGroup.add(upper);

        // Lower Limb
        const lowerGeo = new THREE.BoxGeometry(0.03, 0.25, 0.04);
        const lower = new THREE.Mesh(lowerGeo, woodMat);
        lower.renderOrder = 999;
        lower.position.set(0, -0.45, -0.08);
        lower.rotation.x = 0.4;
        bowGroup.add(lower);

        // Bowstring
        const stringMat = new THREE.LineBasicMaterial({ color: 0xDDDDDD });
        const stringGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -0.05, -0.18),  // Top tip
            new THREE.Vector3(0, -0.55, -0.18)   // Bottom tip
        ]);
        const string = new THREE.Line(stringGeo, stringMat);
        string.renderOrder = 999;
        bowGroup.add(string);

        // Position like pickaxe - attach to toolAttachment
        bowGroup.position.set(0, 0, 0);
        bowGroup.rotation.set(0, 0, 0);

        this.toolAttachment.add(bowGroup);
        this.bow = bowGroup;
        this.bow.visible = false;
    }

    updateHeldItemVisibility() {
        const selectedItem = this.game.inventory ? this.game.inventory.getSelectedItem() : null;
        const itemType = selectedItem ? selectedItem.item : null;

        if (this.pickaxe) this.pickaxe.visible = itemType === 'pickaxe';
        if (this.sword) this.sword.visible = itemType === 'sword';
        if (this.bow) this.bow.visible = itemType === 'bow';
        if (this.binoculars) this.binoculars.visible = itemType === 'binoculars';
        if (this.apple) this.apple.visible = itemType === 'apple';
        if (this.bread) this.bread.visible = itemType === 'bread';
        if (this.chocolateBar) this.chocolateBar.visible = itemType === 'chocolate_bar';
        if (this.wand) this.wand.visible = itemType === 'wand';
        if (this.levitationWand) this.levitationWand.visible = itemType === 'levitation_wand';
        if (this.shrinkWand) this.shrinkWand.visible = itemType === 'shrink_wand';
        if (this.growthWand) this.growthWand.visible = itemType === 'growth_wand';

        if (this.rideWand) this.rideWand.visible = itemType === 'ride_wand';
        if (this.wizardTowerWand) this.wizardTowerWand.visible = itemType === 'wizard_tower_wand';
        if (this.broom) {
            // Held broom: Only show if selected AND not flying (when flying we show riding version)
            this.broom.visible = (itemType === 'flying_broom' && !this.isFlying);

            // Riding broom: Always show while flying (regardless of selected item)
            // The broom only disappears when flight is toggled off via use item button
            if (this.ridingBroom) {
                this.ridingBroom.visible = this.isFlying;
            }
        }

        if (this.chairModel) this.chairModel.visible = itemType === 'chair';
        if (this.tableModel) this.tableModel.visible = itemType === 'table';
        if (this.couchModel) this.couchModel.visible = itemType === 'couch';
    }

    swingArm() {
        this.isMining = true;
        this.miningTimer = 0;

        // Attempt to attack entity or player
        this.attackPlayer();

        // Broadcast action to other players
        if (this.game.socketManager) {
            this.game.socketManager.sendPlayerAction('swing');
        }
    }

    attackPlayer() {
        if (!this.game.camera) return;

        // Simple raycast from camera center
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);

        // Reach distance (3 blocks standard, maybe 4)
        raycaster.far = 4.0;

        // Get remote player meshes
        const socketManager = this.game.socketManager;
        if (!socketManager || !socketManager.playerMeshes) return;

        // Collect all remote player groups
        const targets = [];
        const idMap = new Map(); // Object3D uuid -> playerId

        socketManager.playerMeshes.forEach((meshInfo, id) => {
            if (meshInfo.group) {
                targets.push(meshInfo.group);
                // Map the group AND its children to the ID, just in case
                // Actually usually we intersectObjects(groups, true)
                // We'll need to walk up from the hit object to find the group
                meshInfo.group.userData.playerId = id;
            }
        });

        if (targets.length === 0) return;

        const intersects = raycaster.intersectObjects(targets, true);

        if (intersects.length > 0) {
            // Find the root group to get the player ID
            let hitObject = intersects[0].object;
            let playerId = null;

            // Traverse up to find userData.playerId
            while (hitObject) {
                if (hitObject.userData && hitObject.userData.playerId) {
                    playerId = hitObject.userData.playerId;
                    break;
                }
                hitObject = hitObject.parent;
                if (hitObject === this.game.scene) break;
            }

            if (playerId) {
                console.log(`Attacked player ${playerId}!`);
                // Calculate damage based on held item
                let damage = 1; // Fist
                const heldItem = this.game.inventory ? this.game.inventory.getSelectedItem() : null;
                if (heldItem && heldItem.item === 'sword') damage = 4;
                if (heldItem && heldItem.item === 'pickaxe') damage = 2; // improvised weapon

                socketManager.sendDamage(playerId, damage);

                // Visual feedback (swing already happens)
                // Maybe sound?
            }
        }
    }

    checkCrosshairTarget(dt) {
        if (!this.game.camera || !this.tooltipElement) return;

        // Raycast from camera center
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
        raycaster.far = 10.0; // Check up to 10 blocks away

        // 1. Check Entities (Animals/Monsters)
        // We need to check all meshes in the scene that are children of Animals
        // But looping all scene objects is slow.
        // Game keeps a list of animals! game.animals (Array of Animal)

        const candidates = [];
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal.mesh && animal.mesh.visible) {
                    candidates.push(animal.mesh);
                }
            }
        }

        // Add remote players to candidates
        if (this.game.socketManager && this.game.socketManager.playerMeshes) {
            this.game.socketManager.playerMeshes.forEach((meshInfo) => {
                if (meshInfo.group) {
                    candidates.push(meshInfo.group);
                }
            });
        }

        const transmits = raycaster.intersectObjects(candidates, true);

        let targetName = null;

        if (transmits.length > 0) {
            // Found something!
            // Walk up to find the root object with userData.entity or userData.playerId
            let hitObject = transmits[0].object;
            let entity = null;
            let distance = transmits[0].distance;

            // Only care if close enough?
            if (distance <= 10) {
                while (hitObject) {
                    if (hitObject.userData && hitObject.userData.entity) {
                        entity = hitObject.userData.entity;
                        targetName = entity.constructor.name; // "Pig", "Dragon", etc.
                        break;
                    }
                    if (hitObject.userData && hitObject.userData.playerId) {
                        targetName = "Player " + hitObject.userData.playerId.substr(0, 4);
                        break;
                    }
                    hitObject = hitObject.parent;
                    if (hitObject === this.game.scene) break;
                }
            }
        }

        // Update Tooltip Logic
        if (targetName) {
            if (this.lastCrosshairTarget === targetName) {
                // Same target, increment timer
                this.crosshairTimer += dt;
            } else {
                // New target, reset timer
                this.lastCrosshairTarget = targetName;
                this.crosshairTimer = 0;
            }

            // Show after 0.2 seconds of hovering
            if (this.crosshairTimer > 0.2) {
                this.tooltipElement.textContent = targetName;
                this.tooltipElement.classList.add('visible');
            }
        } else {
            // No target, clear and hide
            this.lastCrosshairTarget = null;
            this.crosshairTimer = 0;
            this.tooltipElement.classList.remove('visible');
        }
    }

    update(deltaTime, allowInput = true) {
        // Skip update if player is dead
        if (this.isDead) return;

        // Update Crosshair Target
        this.checkCrosshairTarget(deltaTime);

        // Update step smoothing
        const smoothingSpeed = 10.0;
        this.stepSmoothingY *= Math.max(0, 1 - deltaTime * smoothingSpeed);
        if (Math.abs(this.stepSmoothingY) < 0.01) this.stepSmoothingY = 0;


        const input = this.game.inputManager;
        // REF_FPS allows us to tune values as if running at 60 FPS
        const REF_FPS = 60.0;

        // Only read movement input if allowed (pointer lock engaged or mobile controls)
        let moveForward = 0;
        let moveRight = 0;
        let speed = 0;
        let velX = 0;
        let velZ = 0;

        if (allowInput) {
            // Scale speed to blocks/second
            speed = (this.speed * REF_FPS) * (input.isActionActive('SPRINT') ? this.sprintMultiplier : (input.isActionActive('SNEAK') ? 0.3 : 1));

            // Calculate movement input
            moveForward = (input.isActionActive('FORWARD') ? 1 : 0) - (input.isActionActive('BACKWARD') ? 1 : 0);
            moveRight = (input.isActionActive('RIGHT') ? 1 : 0) - (input.isActionActive('LEFT') ? 1 : 0);

            // Apply rotation to movement (local to character facing direction)
            const sin = Math.sin(this.rotation.y);
            const cos = Math.cos(this.rotation.y);

            // Forward/back moves along player's facing direction, left/right strafes perpendicular
            // These velocities are now in blocks per second
            velX = (-moveForward * sin + moveRight * cos) * speed;
            velZ = (-moveForward * cos - moveRight * sin) * speed;

        }

        // Studio mode - disable physics and allow free movement
        if (this.game.studio && this.game.studio.isActive) {
            // Free movement in studio - no gravity, no collision
            this.position.x += velX * deltaTime;
            this.position.z += velZ * deltaTime;

            // Allow vertical movement with space/shift
            if (input.isActionActive('JUMP')) this.position.y += speed * 0.5 * deltaTime;
            if (input.isActionActive('SPRINT')) this.position.y -= speed * 0.5 * deltaTime;

            // Keep player on the studio floor (Y=5002 is the floor level)
            const studioFloorY = this.game.studio.position.y + 2;
            if (this.position.y < studioFloorY) {
                this.position.y = studioFloorY;
            }

            // Update camera
            const camera = this.game.camera;
            camera.position.copy(this.position);
            camera.position.y += 1.6;
            camera.rotation.order = 'YXZ';
            camera.rotation.y = this.rotation.y;
            camera.rotation.x = this.rotation.x;

            return; // Skip normal physics
        }

        if (this.mount) {
            // RIDING LOGIC
            // Only dismount on F if we are ON THE GROUND
            // If flying (Dragon), F won't dismount while in air.
            // For now, let's keep it simple: F Dismounts ONLY if on ground.

            let canDismount = true;
            if (this.mount.constructor.name === 'Dragon' && !this.mount.onGround) {
                canDismount = false;
            }

            const shiftJustPressed = input.isActionActive('SNEAK') && !this.wasShiftPressed;
            if ((input.isActionActive('INTERACT') || shiftJustPressed) && canDismount) {
                this.dismount();
            } else {
                if (this.mount.handleRiding) {
                    this.mount.handleRiding(moveForward, moveRight, input.isActionActive('JUMP'), this.rotation.y, deltaTime);
                }
                // Sync position
                this.position.copy(this.mount.position);
                // Horse height (1.2) + offset to sit on back
                // Lowered from 1.6 to 0.8 to sit ON the back
                this.position.y += 0.8;
                this.velocity.set(0, 0, 0);
            }
            this.wasShiftPressed = input.isActionActive('SNEAK');
        } else {
            // NORMAL PHYSICS OR FLYING
            if (this.isFlying) {
                // Flying Physics
                // Base flight speed is 1.5x walk speed (Reduced from 3x)
                // Shift (Sprint) boosts it to 3.0x (Reduced from 6x)
                let currentFlightSpeed = (this.speed * REF_FPS) * (input.isActionActive('SPRINT') ? 3.0 : 1.5);

                this.flightTime += deltaTime;

                const camDir = new THREE.Vector3();
                this.game.camera.getWorldDirection(camDir);

                // Calculate move direction based on camera
                if (Math.abs(moveForward) > 0) {
                    this.velocity.x = camDir.x * currentFlightSpeed * moveForward;
                    this.velocity.y = camDir.y * currentFlightSpeed * moveForward;
                    this.velocity.z = camDir.z * currentFlightSpeed * moveForward;
                } else {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.velocity.z = 0;
                }

                // Add gentle bobbing motion
                // Reduced amplitude from 0.03 to 0.005 for subtler effect
                // Reduced frequency from 3.0 to 2.0
                const bobbing = Math.cos(this.flightTime * 2.0) * (0.005 * REF_FPS); // Scale bobbing velocity?
                // Actually bobbing is usually position offset or velocity?
                // Original: velocity.y += bobbing. 
                // bobbing was result of cos() * 0.005. 0.005 units/frame.
                this.velocity.y += bobbing;

                if (moveRight !== 0) {
                    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
                    this.velocity.x += right.x * currentFlightSpeed * moveRight;
                    this.velocity.z += right.z * currentFlightSpeed * moveRight;
                }

                // Vertical controls (Space to go straight up)
                if (input.isActionActive('JUMP')) this.velocity.y += currentFlightSpeed;
                if (input.isActionActive('SNEAK')) this.velocity.y -= currentFlightSpeed;

                // Descent is handled by looking down and moving forward.

                // Move (using collision or just position?)
                // Use collision to prevent going through walls
                // Integrate velocity * deltaTime
                this.moveWithCollision(this.velocity.x * deltaTime, this.velocity.y * deltaTime, this.velocity.z * deltaTime);

                // Reset falling state
                this.onGround = false;
                this.highestY = this.position.y; // Fix fall damage accumulation

            } else {
                // Check if in water
                const blockAtFeet = this.game.getBlock(this.position.x, this.position.y, this.position.z);
                const inWater = blockAtFeet && blockAtFeet.type === 'water';

                // Track highest Y for fall damage - only track while falling, not climbing
                if (this.onGround || inWater) {
                    // Reset highestY when on ground or in water - this prevents accumulating height while climbing
                    this.highestY = this.position.y;
                } else if (this.velocity.y <= 0) {
                    // Only track highest point when falling (negative or zero velocity)
                    // This prevents taking damage from climbing up to high places
                    this.highestY = Math.max(this.highestY, this.position.y);
                } else {
                    // While going up (positive velocity), reset highestY to current position
                    // So we only measure fall distance from the apex
                    this.highestY = this.position.y;
                }

                // Void Damage - Check against current world's floor level
                // Each world has different Y ranges:
                // - Earth: Y < -64
                // - Moon: Y chunks 40-48, floor at ~640
                // - Crystal World: Y chunks 50-58, floor at ~800
                // - Lava World: Y chunks 60-68, floor at ~960
                const chunkSize = this.game.chunkSize || 16;
                let voidThreshold = -64; // Earth default

                // Determine current world based on Y position
                const playerChunkY = Math.floor(this.position.y / chunkSize);

                if (playerChunkY >= 60 || (this.position.y >= 960 && this.position.y < 1200)) {
                    // Lava World - floor is at Y chunk 60 * 16 = 960, void below 900
                    voidThreshold = 900;
                } else if (playerChunkY >= 50 || (this.position.y >= 800 && this.position.y < 960)) {
                    // Crystal World - floor is at Y chunk 50 * 16 = 800, void below 740
                    voidThreshold = 740;
                } else if (playerChunkY >= 40 || (this.position.y >= 640 && this.position.y < 800)) {
                    // Moon - floor is at Y chunk 40 * 16 = 640, void below 580
                    voidThreshold = 580;
                }
                // Else Earth: voidThreshold stays at -64

                if (this.position.y < voidThreshold) {
                    this.takeDamage(10, 'Void'); // Take damage every frame until death
                }

                // Apply gravity
                if (inWater) {
                    const gravityAccel = this.game.gravity * 0.2 * REF_FPS * REF_FPS;
                    this.velocity.y -= gravityAccel * deltaTime; // Reduced gravity

                    if (input.isActionActive('JUMP')) {
                        this.velocity.y = 0.1 * REF_FPS; // Swim up
                    }

                    // Drag: 0.5 per frame decay means speed halving every frame.
                    // (0.5)^FPS per second.
                    // frameFactor = 0.5. dt=1/60. 
                    // To do time based: factor = Math.pow(0.5, deltaTime * 60)
                    const drag = Math.pow(0.5, deltaTime * REF_FPS);
                    this.velocity.x *= drag;
                    this.velocity.z *= drag;
                } else {
                    const gravityAccel = this.game.gravity * REF_FPS * REF_FPS;
                    this.velocity.y -= gravityAccel * deltaTime;

                    // Apply friction to horizontal momentum (knockback)
                    const friction = this.onGround ? 6.0 : 1.0;
                    const damping = Math.max(0, 1 - friction * deltaTime);
                    this.velocity.x *= damping;
                    this.velocity.z *= damping;
                    // Cutoff small velocities
                    if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
                    if (Math.abs(this.velocity.z) < 0.1) this.velocity.z = 0;

                    // Jump (only when input is allowed)
                    if (allowInput && input.isActionActive('JUMP') && !this.wasSpacePressed && this.onGround) {
                        this.velocity.y = this.jumpForce * REF_FPS;
                        this.onGround = false;
                        this.game.soundManager.playSound('jump');
                    }
                }

                this.wasSpacePressed = input.isActionActive('JUMP');
                this.wasShiftPressed = input.isActionActive('SNEAK');

                // Move with collision detection
                // Apply delta time integration here
                this.moveWithCollision((velX + this.velocity.x) * deltaTime, this.velocity.y * deltaTime, (velZ + this.velocity.z) * deltaTime);

                // Check for mounting
                this.checkMountCollision();
            }
        }

        // Update camera
        // Toggle Camera View with 'C'
        if (input.isActionActive('CAMERA') && !this.wasCPressed) {
            this.toggleCameraView();
        }
        this.wasCPressed = input.isActionActive('CAMERA');

        // Update camera and body based on view mode
        const camera = this.game.camera;

        // 3rd Person - Smooth Follow Camera
        if (this.cameraMode === 1) {
            // Update body position for 3rd person view
            this.body.position.copy(this.position);
            this.body.position.y += 1.57 + this.stepSmoothingY;
            this.body.rotation.set(0, this.rotation.y, 0);

            // Use smooth follow camera
            this.thirdPersonCamera.update(deltaTime, this);

        } else {
            // 1st Person Logic (Default)
            camera.position.copy(this.position);
            camera.position.y += this.stepSmoothingY; // Apply smoothing to camera base position

            // Adjust camera height for Sneak
            const targetHeight = input.isActionActive('SNEAK') ? 1.4 : 1.6;
            // Simple interpolation for smoothness (or instant?)
            if (!this.currentCameraHeight) this.currentCameraHeight = 1.6;
            this.currentCameraHeight += (targetHeight - this.currentCameraHeight) * 10 * deltaTime;

            camera.position.y += this.currentCameraHeight;
            camera.rotation.order = 'YXZ';
            camera.rotation.y = this.rotation.y;
            camera.rotation.x = this.rotation.x;

            // Visual Improvements: Weapon Inertia (Hand Sway)
            // Calculate how much we turned this frame
            const deltaY = this.rotation.y - (this.lastRotationY || this.rotation.y);
            this.lastRotationY = this.rotation.y;

            const deltaX = this.rotation.x - (this.lastRotationX || this.rotation.x);
            this.lastRotationX = this.rotation.x;

            // Apply inertia to the tool attachment group
            if (this.toolAttachment) {
                // Target is 0 (centered)
                // We drag it opposite to the turn direction
                // Limit the drag so it doesn't spin around
                const inertiaStrength = 0.1;
                const recoverySpeed = 10.0 * deltaTime;

                // Current inertia
                if (!this.inertiaRotation) this.inertiaRotation = { x: 0, y: 0 };

                // Add drag
                this.inertiaRotation.y -= deltaY * inertiaStrength;
                this.inertiaRotation.x -= deltaX * inertiaStrength;

                // Clamp
                const maxInertia = 0.1;
                this.inertiaRotation.x = Math.max(-maxInertia, Math.min(maxInertia, this.inertiaRotation.x));
                this.inertiaRotation.y = Math.max(-maxInertia, Math.min(maxInertia, this.inertiaRotation.y));

                // Recover to 0
                this.inertiaRotation.x -= this.inertiaRotation.x * recoverySpeed;
                this.inertiaRotation.y -= this.inertiaRotation.y * recoverySpeed;

                // Apply to toolAttachment (on top of its base rotation of PI/2, PI/2, 0)
                // toolAttachment base: .rotation.set(Math.PI / 2, Math.PI / 2, 0);
                // We add the inertia offset
                this.toolAttachment.rotation.set(
                    (Math.PI / 2) + this.inertiaRotation.x,
                    (Math.PI / 2) + this.inertiaRotation.y,
                    0
                );
            }
        }

        // Animate arms and legs
        this.updateBodyAnimation(moveForward, moveRight, input, deltaTime);

        // Update hunger and health
        this.updateHungerAndHealth(deltaTime, input);

        // Update speech bubble timer
        this.updateSpeechBubble(deltaTime);
    }


    // ...

    // Duplicate toggleCameraView removed

    updateHungerAndHealth(deltaTime, input) {
        // Health regeneration over time
        if (this.health < this.maxHealth) {
            this.regenTimer += deltaTime;
            if (this.regenTimer >= 4) {
                this.heal(1);
                this.regenTimer = 0;
            }
        } else {
            this.regenTimer = 0;
        }

        // Update HUD
        this.updateStatusBars();
    }

    takeDamage(amount, source = 'Unknown') {
        this.health = Math.max(0, this.health - amount);

        // Visual feedback - flash screen red
        const damageOverlay = document.getElementById('damage-overlay');
        if (damageOverlay) {
            damageOverlay.classList.add('active');
            setTimeout(() => damageOverlay.classList.remove('active'), 200);
        }

        // Show damage source text
        this.showDamageSource(source, amount);

        // Visual Improvements: Camera Shake
        this.triggerCameraShake(0.1, 150); // intensity, duration ms

        // Sync health immediately
        if (this.game.socketManager) {
            this.game.socketManager.sendPlayerState();
        }

        // Check for death
        if (this.health <= 0) {
            this.lastDamageSource = source; // Store for death screen
            this.onDeath();
        }
    }

    showDamageSource(source, amount) {
        // Create or get the damage source display element
        let damageSourceEl = document.getElementById('damage-source-display');
        if (!damageSourceEl) {
            damageSourceEl = document.createElement('div');
            damageSourceEl.id = 'damage-source-display';
            damageSourceEl.style.cssText = `
                position: fixed;
                top: 30%;
                left: 50%;
                transform: translateX(-50%);
                font-family: 'VT323', 'Minecraft', monospace;
                font-size: 28px;
                color: #ff4444;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(255,68,68,0.5);
                z-index: 2000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease-out;
                text-align: center;
            `;
            document.body.appendChild(damageSourceEl);
        }

        // Set the damage text
        damageSourceEl.textContent = `💔 -${amount} ${source}`;
        damageSourceEl.style.opacity = '1';

        // Clear any existing timeout
        if (this.damageSourceTimeout) {
            clearTimeout(this.damageSourceTimeout);
        }

        // Hide after 2 seconds
        this.damageSourceTimeout = setTimeout(() => {
            damageSourceEl.style.opacity = '0';
        }, 2000);
    }

    triggerCameraShake(intensity, durationMs) {
        if (!this.game.camera) return;

        const originalPosition = this.game.camera.position.clone();
        const startTime = performance.now();

        const shake = () => {
            const elapsed = performance.now() - startTime;
            if (elapsed > durationMs) {
                // Reset camera position (handled by normal update loop)
                return;
            }

            const progress = elapsed / durationMs;
            const currentIntensity = intensity * (1 - progress); // Fade out

            // Add random offset
            this.cameraShakeOffset = {
                x: (Math.random() - 0.5) * 2 * currentIntensity,
                y: (Math.random() - 0.5) * 2 * currentIntensity
            };

            requestAnimationFrame(shake);
        };

        shake();
    }

    knockback(direction, force) {
        // direction is a normalized Vector3
        // force is scalar (assumed blocks/frame impulse)
        // Add to velocity (simple impulse)
        const REF_FPS = 60.0;
        this.velocity.x += direction.x * force * REF_FPS;
        this.velocity.z += direction.z * force * REF_FPS;
        this.velocity.y = 0.1 * REF_FPS; // Reduced hop (was 0.2)
        this.onGround = false;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        if (this.game.socketManager) {
            this.game.socketManager.sendPlayerState();
        }
    }

    // eat() method removed - hunger system disabled



    dismount() {
        if (!this.mount) return;

        const entity = this.mount;
        this.mount = null;
        entity.rider = null;

        // Drop player slightly to the side
        // But safe check?
        this.position.x += 1.0;
        this.position.y = Math.floor(this.position.y); // Floor it? Or keeps falling?
        this.velocity.y = 0;

        console.log("Dismounted.");
    }

    toggleFlying() {
        this.isFlying = !this.isFlying;
        if (this.isFlying) {
            const REF_FPS = 60.0;
            this.velocity.y = 0.5 * REF_FPS; // Hop
            this.game.addMessage && this.game.addMessage("You are now flying!");

            // Check if holding broom
            const selectedItem = this.game.inventory ? this.game.inventory.getSelectedItem() : null;
            const isHoldingBroom = selectedItem && selectedItem.item === 'flying_broom';

            // Switch to Riding Model ONLY if holding broom
            if (this.ridingBroom) this.ridingBroom.visible = isHoldingBroom;
            if (this.broom) this.broom.visible = false; // Always hide held broom when flying (if we were holding it)

            // Sitting Pose ONLY if holding broom
            if (isHoldingBroom) {
                // Lift legs up forward (90 degrees / PI/2)
                if (this.leftLeg) this.leftLeg.rotation.x = Math.PI / 2;
                if (this.rightLeg) this.rightLeg.rotation.x = Math.PI / 2;

                // Arm position? Maybe holding the handle in front?
                this.rightArm.rotation.x = Math.PI / 3;
            } else {
                // Normal flying (superman or just standing? Standing is easiest for now)
                if (this.leftLeg) this.leftLeg.rotation.x = 0;
                if (this.rightLeg) this.rightLeg.rotation.x = 0;
                this.rightArm.rotation.x = 0;
            }

        } else {
            this.game.addMessage && this.game.addMessage("You stopped flying.");

            // Switch back to Held Model (if selected, handled by updateHeldItemVisibility mostly, but force update)
            if (this.ridingBroom) this.ridingBroom.visible = false;
            this.updateHeldItemVisibility(); // Will show held broom if selected

            // Reset Pose
            if (this.leftLeg) this.leftLeg.rotation.x = 0;
            if (this.rightLeg) this.rightLeg.rotation.x = 0;
            this.rightArm.rotation.x = 0;
        }
    }

    checkMountCollision() {
        if (this.mount) return;
        if (this.isFlying) return; // Don't mount while flying
        if (!this.game.animals) return;

        for (const animal of this.game.animals) {
            // Check if it is a Horse by instance check or name
            // Safest is to check constructor name if import not available
            // but we can also check if it has 'saddle' logic or just any horse.
            // User said "touch a horse".

            if (animal.constructor.name === 'Horse' || animal.constructor.name === 'Dragon') {
                const dist = this.position.distanceTo(animal.position);
                const maxDist = (animal.constructor.name === 'Dragon') ? 4.0 : 1.5; // Larger range for dragon
                if (dist < maxDist) {
                    this.mountEntity(animal);
                    break;
                }
            }
        }
    }

    // startEating() and stopEating() removed - hunger system disabled

    onDeath() {
        // Set player as dead (prevents movement/input)
        this.isDead = true;

        if (this.game.analyticsManager) {
            this.game.analyticsManager.logPlayerDeath('unknown'); // Cause unknown for now unless passed
        }

        // Save death position for respawning
        // Clone so we don't hold a reference to a changing vector
        this.deathPosition = this.position.clone();

        // Show death screen via UIManager
        if (this.game.uiManager) {
            this.game.uiManager.showDeathScreen();
        }

        // Notify server
        if (this.game.socketManager) {
            this.game.socketManager.sendDeath();
        }
    }

    respawn() {
        // Reset player state
        this.isDead = false;
        this.health = this.maxHealth;
        this.highestY = -Infinity; // Reset fall damage tracker

        // Always respawn in the main Earth world (Y level 0-127)
        // Use default spawn position regardless of where player died
        this.deathPosition = null;

        // Reset environment to Earth world (fixes sky color staying red/purple from alien worlds)
        if (this.game.environment && this.game.environment.setWorld) {
            this.game.environment.setWorld('earth');
        }

        if (this.game.spawnPlayer) {
            this.game.spawnPlayer();
        } else {
            // Fallback to main world spawn
            this.position.set(32, 80, 32);
            this.velocity.set(0, 0, 0);
            this.highestY = 80;

            // Sync camera
            if (this.game.camera) {
                this.game.camera.position.copy(this.position);
                this.game.camera.position.y += 1.6;
            }

            if (this.game.uiManager) {
                this.game.uiManager.hideDeathScreen();
            }
        }

        // Update HUD
        this.updateStatusBars();
    }

    updateStatusBars() {
        // Update health bar
        const healthFill = document.getElementById('health-fill');
        if (healthFill) {
            const healthPercent = (this.health / this.maxHealth) * 100;
            healthFill.style.width = healthPercent + '%';
        }

        // Crosshair targeting initialization
        this.crosshairTimer = 0;
        this.lastCrosshairTarget = null;
        this.tooltipElement = document.getElementById('creature-tooltip');

        this.updateHearts();
    }

    updateHearts() {
        const container = document.getElementById('health-hearts');
        if (!container) return;

        const fullHearts = Math.floor(this.health / 2);
        const halfHeart = this.health % 2 >= 1;

        let html = '';
        for (let i = 0; i < 10; i++) {
            if (i < fullHearts) {
                html += '<span class="heart full">❤️</span>';
            } else if (i === fullHearts && halfHeart) {
                html += '<span class="heart half">💔</span>';
            } else {
                html += '<span class="heart empty">🖤</span>';
            }
        }
        container.innerHTML = html;
    }

    updateBodyAnimation(moveX, moveZ, input, deltaTime) {
        const isBowVisible = this.bow && this.bow.visible;

        // Mining animation (also used for eating)
        if (this.isMining && !isBowVisible) {
            this.miningTimer += deltaTime * 16; // Faster swing speed
            if (this.miningTimer > Math.PI) {
                this.isMining = false;
                this.miningTimer = 0;
                this.swingCompleted = true; // Signal that swing is done
            } else {
                if (this.rightArmPivot) {
                    // Mining swing override
                    const swing = Math.sin(this.miningTimer) * 2.2; // Higher arm raise (was 1.5)
                    const basePitch = (this.cameraMode !== 0) ? this.rotation.x : 0;
                    this.rightArmPivot.rotation.x = basePitch + swing;
                    return; // Skip walking anim for right arm while mining
                }
            }
        }

        // Bow holding animation (Arm pointing forward)
        if (isBowVisible) {
            if (this.rightArmPivot) {
                // Raise arm to point forward (90 degrees, or -PI/2)
                // Smooth transition could be nice, but instant is fine for now
                this.rightArmPivot.rotation.x = -Math.PI / 2;
                // Maybe tilt slightly if aiming? (Not implemented yet)
            }
            if (this.leftArmPivot) {
                // Maybe raise left arm too like holding the bow body?
                // But bow is in right arm... usually bow is left hand, pull with right.
                // Current code puts bow in rightArm.
                // Let's stick with right arm holding it out.
            }
        }

        // Check if player is moving
        const isMoving = moveX !== 0 || moveZ !== 0;

        // Swing speed - faster when sprinting
        const swingSpeed = input.isActionActive('SPRINT') ? 12 : 8;
        const maxSwingAngle = input.isActionActive('SPRINT') ? 1.2 : 0.8;

        // Calculate base pitch (only for 3rd person, as 1st person body rotates with camera)
        const basePitch = (this.cameraMode !== 0) ? this.rotation.x : 0;

        if (this.mount) {
            // RIDING POSE
            // Legs sitting forward
            if (this.leftLegPivot) this.leftLegPivot.rotation.x = -Math.PI / 2.5;
            if (this.rightLegPivot) this.rightLegPivot.rotation.x = -Math.PI / 2.5;

            // Arms holding reins (slightly forward)
            if (this.rightArmPivot && !this.isMining && !isBowVisible) {
                this.rightArmPivot.rotation.x = -Math.PI / 6;
            }
            if (this.leftArmPivot) {
                this.leftArmPivot.rotation.x = -Math.PI / 6;
            }
            return; // Skip walking animation
        }

        if (this.isFlying) {
            const selectedItem = this.game.inventory ? this.game.inventory.getSelectedItem() : null;
            const isHoldingBroom = selectedItem && selectedItem.item === 'flying_broom';

            if (isHoldingBroom) {
                // Flying Pose - Static arms and legs (Riding Broom)
                // Legs sitting forward (Positive rotation for forward if negative was backward)
                if (this.leftLegPivot) this.leftLegPivot.rotation.x = Math.PI / 2;
                if (this.rightLegPivot) this.rightLegPivot.rotation.x = Math.PI / 2;

                // Arms static holding handle
                if (this.rightArmPivot) this.rightArmPivot.rotation.x = Math.PI / 3;
                if (this.leftArmPivot) this.leftArmPivot.rotation.x = Math.PI / 3;

                return; // Skip walking animation
            }
            // If flying but NOT holding broom, fall through to standard walking animation (or add separate flight anim later)
            // For now, let's treat it like walking in air (creative flight style)
        }

        if (isMoving) {
            this.armSwingAngle += deltaTime * swingSpeed;
            const swingAmount = Math.sin(this.armSwingAngle) * maxSwingAngle;

            if (this.leftArmPivot) this.leftArmPivot.rotation.x = swingAmount;

            // Only swing right arm if NOT mining AND NOT holding bow
            if (this.rightArmPivot && !this.isMining && !isBowVisible) {
                this.rightArmPivot.rotation.x = basePitch - swingAmount;
            }

            if (this.leftLegPivot) this.leftLegPivot.rotation.x = -swingAmount;
            if (this.rightLegPivot) this.rightLegPivot.rotation.x = swingAmount;
        } else {
            // Return to neutral
            const returnSpeed = 5;
            if (this.leftArmPivot) this.leftArmPivot.rotation.x *= Math.max(0, 1 - deltaTime * returnSpeed);

            // Only return right arm if NOT mining AND NOT holding bow
            if (this.rightArmPivot && !this.isMining && !isBowVisible) {
                // Return to basePitch
                // Interpolate current rotation towards basePitch
                const currentDiff = this.rightArmPivot.rotation.x - basePitch;
                const newDiff = currentDiff * Math.max(0, 1 - deltaTime * returnSpeed);
                this.rightArmPivot.rotation.x = basePitch + newDiff;

                this.rightArmPivot.rotation.y *= Math.max(0, 1 - deltaTime * returnSpeed);
                this.rightArmPivot.rotation.z *= Math.max(0, 1 - deltaTime * returnSpeed);
            }

            if (this.leftLegPivot) this.leftLegPivot.rotation.x *= Math.max(0, 1 - deltaTime * returnSpeed);
            if (this.rightLegPivot) this.rightLegPivot.rotation.x *= Math.max(0, 1 - deltaTime * returnSpeed);

            this.armSwingAngle = 0;
        }

        // Head rotation (Pitch up/down) - Sync with camera pitch
        if (this.head) {
            if (this.cameraMode !== 0) {
                // In 3rd person, head looks where camera looks
                this.head.rotation.x = this.rotation.x;
            } else {
                // In 1st person, reset head rotation (though invisible)
                this.head.rotation.x = 0;
            }
        }
    }

    /**
     * Check if a position is on top of a cloud
     */
    isOnCloud(x, y, z) {
        if (!this.game.environment || !this.game.environment.clouds) return { isOnCloud: false, cloudTop: 0 };

        const clouds = this.game.environment.clouds;
        const blockSize = 4; // Cloud block size from Environment.js
        const cloudThickness = blockSize * 0.5; // Height of cloud blocks

        for (const cloudGroup of clouds.children) {
            // Get cloud world position
            const cloudWorldPos = new THREE.Vector3();
            cloudGroup.getWorldPosition(cloudWorldPos);

            // Check each block in the cloud
            for (const block of cloudGroup.children) {
                const blockWorldPos = new THREE.Vector3();
                block.getWorldPosition(blockWorldPos);

                // Cloud block bounds (centered at blockWorldPos)
                const minX = blockWorldPos.x - blockSize / 2;
                const maxX = blockWorldPos.x + blockSize / 2;
                const minZ = blockWorldPos.z - blockSize / 2;
                const maxZ = blockWorldPos.z + blockSize / 2;
                const cloudTop = blockWorldPos.y + cloudThickness / 2;
                const cloudBottom = blockWorldPos.y - cloudThickness / 2;

                // Check if position is within cloud block horizontally and at the top surface
                if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
                    // Check if we're at the top of the cloud (within a small tolerance)
                    if (y >= cloudBottom && y <= cloudTop + 0.5) {
                        return { isOnCloud: true, cloudTop: cloudTop };
                    }
                }
            }
        }
        return { isOnCloud: false, cloudTop: 0 };
    }

    moveWithCollision(velX, velY, velZ) {
        const pos = this.position;
        const hw = this.width / 2;
        const h = this.height;

        // Utility to check solid block
        const isSolid = (x, y, z) => {
            const block = this.game.getBlock(x, y, z);
            if (!block) return false;
            // Pass-through blocks
            if (block.type === 'water' || block.type === 'air' ||
                block.type === 'flower_red' || block.type === 'flower_yellow' ||
                block.type === 'mushroom_red' || block.type === 'mushroom_brown' ||
                block.type === 'long_grass' || block.type === 'fern' ||
                block.type === 'flower_blue' || block.type === 'dead_bush' ||
                block.type === 'door_open') {
                return false;
            }
            return true;
        };

        // Check Y movement
        const newY = pos.y + velY;
        let canMoveY = true;

        for (let dx = -hw; dx <= hw; dx += hw) {
            for (let dz = -hw; dz <= hw; dz += hw) {
                if (velY < 0) {
                    // Falling - check below feet
                    if (isSolid(pos.x + dx, newY, pos.z + dz)) {
                        // Check for trampoline
                        const block = this.game.getBlock(pos.x + dx, newY, pos.z + dz);
                        if (block && block.type === 'trampoline') {
                            // Bounce logic - Minimum threshold to avoid infinite jitter
                            // -0.2 * 60 = -12
                            if (this.velocity.y < -12.0) {
                                this.velocity.y = -this.velocity.y * 0.9; // 90% resilience
                                this.highestY = pos.y; // Reset fall damage calculation
                                canMoveY = false;
                                this.onGround = false; // Do not land
                                return;
                            }
                        }

                        canMoveY = false;

                        // Fall damage check - disabled in alien worlds (lower gravity)
                        // Crystal World: Y > 256, Lava World: Y > 512
                        const isInAlienWorld = pos.y > 256;
                        if (!this.onGround && !isInAlienWorld) {
                            const fallDistance = this.highestY - pos.y;
                            if (fallDistance > 6) {
                                this.takeDamage(Math.floor(fallDistance - 6), 'Fall Damage');
                            }
                        }

                        this.velocity.y = 0;
                        this.onGround = true;
                    } else {
                        // Check for cloud collision (walkable clouds!)
                        const cloudCheck = this.isOnCloud(pos.x + dx, newY, pos.z + dz);
                        if (cloudCheck.isOnCloud) {
                            canMoveY = false;
                            this.velocity.y = 0;
                            this.onGround = true;
                            // Soft landing on clouds - no fall damage, snap to cloud top
                            pos.y = cloudCheck.cloudTop;
                            this.highestY = pos.y; // Reset fall tracking
                        }
                    }
                } else {
                    // Jumping - check above head
                    if (isSolid(pos.x + dx, newY + h, pos.z + dz)) {
                        canMoveY = false;
                        this.velocity.y = 0;
                    }
                }
            }
        }

        if (canMoveY) {
            pos.y = newY;
            if (velY < 0) this.onGround = false;
        }

        // Check X movement
        const newX = pos.x + velX;
        let canMoveX = true;

        for (let dy = 0; dy < h; dy += 0.5) {
            for (let dz = -hw; dz <= hw; dz += hw) {
                const checkX = velX > 0 ? newX + hw : newX - hw;
                if (isSolid(checkX, pos.y + dy, pos.z + dz)) {
                    canMoveX = false;

                    // Auto-jump (Step Assist) check
                    // Only if we are on the ground (or was on ground recently?) 
                    // Let's allow it if we are on the ground.
                    if (this.onGround && dy < 1.0) { // Obstacle is low (foot level)
                        // Check if we can step up (y + 1)
                        // We need to check if the space at (newX, pos.y + 1) is free
                        // And also (newX, pos.y + 2) for head clearance

                        let canStepUp = true;

                        // Check clearance at new position, raised by 1.1 (to clear block)
                        const targetY = pos.y + 1.1;

                        // Check body height at new position
                        for (let checkDy = 0; checkDy < h; checkDy += 0.5) {
                            if (isSolid(checkX, targetY + checkDy, pos.z + dz)) {
                                canStepUp = false;
                                break;
                            }
                        }

                        if (canStepUp) {
                            // Also check if we hit our head at CURRENT X,Z but higher Y?
                            // No, assuming current X,Z is clear above.

                            // Perform step up
                            const stepHeight = 1.1; // Amount we are snapping up
                            pos.y += stepHeight;
                            this.stepSmoothingY -= stepHeight; // Counteract the snap visually
                            canMoveX = true; // Re-enable movement
                            // Don't set vertical velocity, just snap
                            this.onGround = true; // Still on "ground"
                            return; // Stop checking other collision points for this axis, we moved up
                        }
                    }
                }
            }
        }

        if (canMoveX) pos.x = newX;

        // Check Z movement
        const newZ = pos.z + velZ;
        let canMoveZ = true;

        for (let dy = 0; dy < h; dy += 0.5) {
            for (let dx = -hw; dx <= hw; dx += hw) {
                const checkZ = velZ > 0 ? newZ + hw : newZ - hw;
                if (isSolid(pos.x + dx, pos.y + dy, checkZ)) {
                    canMoveZ = false;

                    // Auto-jump (Step Assist) check Z
                    if (this.onGround && dy < 1.0) {
                        let canStepUp = true;
                        const targetY = pos.y + 1.1;

                        for (let checkDy = 0; checkDy < h; checkDy += 0.5) {
                            if (isSolid(pos.x + dx, targetY + checkDy, checkZ)) {
                                canStepUp = false;
                                break;
                            }
                        }

                        if (canStepUp) {
                            const stepHeight = 1.1;
                            pos.y += stepHeight;
                            this.stepSmoothingY -= stepHeight;
                            canMoveZ = true;
                            this.onGround = true;
                            return;
                        }
                    }
                }
            }
        }

        if (canMoveZ) pos.z = newZ;
    }

    rotate(dx, dy) {
        const sensitivity = 0.002;

        // Character rotation (same for both first and third person)
        this.rotation.y -= dx * sensitivity;
        this.rotation.x -= dy * sensitivity;
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
    }

    toggleCameraView() {
        this.cameraMode = (this.cameraMode + 1) % 2; // 2 modes: 0=First Person, 1=Third Person

        // Reset camera to scene
        this.game.scene.add(this.game.camera);

        const crosshair = document.getElementById('crosshair');

        if (this.cameraMode === 1) {
            // Switch to 3rd Person (Smooth Follow)
            this.game.scene.add(this.body);
            this.body.visible = true;
            if (this.head) this.head.visible = true;

            // Reset/initialize the third person camera
            this.thirdPersonCamera.reset(this);

            // Ensure body parts are visible in 3rd person
            if (this.torso) this.torso.visible = true;
            if (this.leftLegPivot) this.leftLegPivot.visible = true;
            if (this.rightLegPivot) this.rightLegPivot.visible = true;

            // Keep crosshair visible in 3rd person
            if (crosshair) crosshair.classList.remove('hidden');

        } else {
            // Switch to 1st Person
            this.game.camera.add(this.body);

            // Position relative to camera to see arms
            this.body.position.set(0, -0.3, -0.4);
            this.body.rotation.set(0, 0, 0);

            // Hide head and body parts in 1st person
            if (this.head) this.head.visible = false;
            if (this.torso) this.torso.visible = false;
            if (this.leftLegPivot) this.leftLegPivot.visible = false;
            if (this.rightLegPivot) this.rightLegPivot.visible = false;

            // Show crosshair
            if (crosshair) crosshair.classList.remove('hidden');
        }
    }

    collectBlock(blockType) {
        // We need to check if this block type is collectible
        // For example, 'air', 'water' shouldn't be collected.
        // Also, some blocks might drop a different item (e.g., ore blocks).
        // For now, a simple collectible list.
        const collectibleBlocks = [
            'grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'brick',
            'planks', 'crafting_table', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore',
            'flower_red', 'flower_yellow', 'flower_blue', 'mushroom_red', 'mushroom_brown',
            'long_grass', 'fern', 'dead_bush'
        ];

        if (collectibleBlocks.includes(blockType) && this.game.inventory) {
            // For ores, drop the resource, not the ore block
            let itemToCollect = blockType;
            if (blockType === 'coal_ore') itemToCollect = 'coal';
            if (blockType === 'iron_ore') itemToCollect = 'iron_ingot'; // Assuming it drops ingots for simplicity
            if (blockType === 'gold_ore') itemToCollect = 'gold_ingot';
            if (blockType === 'diamond_ore') itemToCollect = 'diamond';
            if (blockType === 'stone') itemToCollect = 'cobblestone';
            if (blockType.includes('leaves')) itemToCollect = 'stick'; // Leaves drop sticks sometimes

            // Random drop for leaves
            if (blockType.includes('leaves')) {
                if (Math.random() < 0.2) { // 20% chance to drop a stick
                    this.game.inventory.addItem({ item: 'stick', quantity: 1, type: 'resource' });
                }
                // Maybe a small chance for an apple?
                if (Math.random() < 0.05) { // 5% chance
                    this.game.inventory.addItem({ item: 'apple', quantity: 1, type: 'food' });
                }
            } else {
                this.game.inventory.addItem({ item: itemToCollect, quantity: 1, type: 'block' });
            }
        }
    }

    /**
     * Determine tool efficiency against a specific block type
     */
    getHeldItemEfficiency(blockType) {
        const selectedItem = this.game.inventory ? this.game.inventory.getSelectedItem() : null;
        if (!selectedItem || !selectedItem.item) return 1.0; // Base efficiency (fists)

        const item = selectedItem.item;

        // Pickaxe efficiency
        if (item === 'pickaxe') {
            if (blockType.includes('stone') || blockType.includes('ore') || blockType === 'brick' || blockType === 'gold_ore' || blockType === 'diamond_ore' || blockType === 'iron_ore' || blockType === 'coal_ore') {
                return 5.0; // 5x faster
            }
        }

        // Sword efficiency (slightly better for leaves/plants)
        if (item === 'sword') {
            if (blockType.includes('leaves') || blockType.includes('flower') || blockType === 'long_grass' || blockType === 'fern') {
                return 1.5;
            }
        }

        // Axe efficiency
        if (item === 'axe') {
            if (blockType.includes('wood') || blockType.includes('log') || blockType === 'planks' || blockType === 'crafting_table') {
                return 5.0;
            }
        }

        // Shovel efficiency
        if (item === 'shovel') {
            if (blockType === 'dirt' || blockType === 'sand' || blockType === 'grass' || blockType === 'snow') {
                return 5.0;
            }
        }

        return 1.0;
    }

    /**
     * Determine damage dealt by the currently held item
     */
    getHeldItemDamage() {
        const selectedItem = this.game.inventory ? this.game.inventory.getSelectedItem() : null;
        if (!selectedItem || !selectedItem.item) return 1.0; // Base damage (fists)

        const item = selectedItem.item;

        switch (item) {
            case 'sword':
                return 7.0; // 3.5 hearts
            case 'axe':
            case 'pickaxe':
                return 4.0; // 2 hearts
            case 'shovel':
                return 2.0; // 1 heart
            default:
                return 1.0; // 0.5 hearts
        }
    }
}
// Testing Gemini CLI Integration
// Task list in chat panel verified
// Refined tool calling verified
// Async flow verified