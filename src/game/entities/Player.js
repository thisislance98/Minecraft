import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * Player class handles player state, physics, body model, and animation
 */
export class Player {
    constructor(game) {
        this.game = game;

        // Player state
        this.position = new THREE.Vector3(32, 80, 32);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = { x: 0, y: 0 };
        this.orbitRotation = { x: 0, y: 0 }; // Camera orbit angles
        this.height = Config.PLAYER.HEIGHT;
        this.width = Config.PLAYER.WIDTH;
        this.onGround = false;
        this.speed = Config.PLAYER.SPEED;
        this.sprintMultiplier = Config.PLAYER.SPRINT_MULTIPLIER;
        this.jumpForce = Config.PLAYER.JUMP_FORCE;
        this.isDead = false;

        // Health and Hunger
        this.health = Config.PLAYER.MAX_HEALTH;       // Max 20 (displayed as 10 hearts)
        this.maxHealth = Config.PLAYER.MAX_HEALTH;
        this.hunger = Config.PLAYER.MAX_HUNGER / 2;       // Start half hunger for testing? Or keep logic. 
        // Original was: this.hunger = 10;
        this.maxHunger = Config.PLAYER.MAX_HUNGER;
        this.hungerTimer = 0;
        this.regenTimer = 0;
        this.starvationTimer = 0;
        this.distanceTraveled = 0;
        this.lastPosition = null;
        this.highestY = 0; // Track highest point for fall damage

        // Animation
        this.armSwingAngle = 0;
        this.isMoving = false;
        this.isMining = false;
        this.miningTimer = 0;
        this.wasSpacePressed = false;
        this.cameraMode = 0; // 0: First Person, 1: Third Person Back, 2: Third Person Front
        this.wasCPressed = false;
        this.isFlying = false;
        this.flightTime = 0;

        // Eating State
        this.isEating = false;
        this.eatingTimer = 0;
        this.swingCompleted = false; // Init flag
        this.eatingDuration = 1.5; // Seconds to consume food
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

        this.createBody();
    }

    createBody() {
        // Colors matching Minecraft Steve skin
        const skinColor = 0xB58D6E; // Steve's tan
        const shirtColor = 0x00AAAA; // Cyan
        const pantsColor = 0x3333AA; // Indigo/Blue

        const skinMaterial = new THREE.MeshLambertMaterial({ color: skinColor });
        const shirtMaterial = new THREE.MeshLambertMaterial({ color: shirtColor });
        const pantsMaterial = new THREE.MeshLambertMaterial({ color: pantsColor });

        this.body = new THREE.Group();

        // Torso
        const torsoWidth = 0.5;
        const torsoHeight = 0.75;
        const torsoDepth = 0.25;

        const torsoGeom = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
        const torso = new THREE.Mesh(torsoGeom, shirtMaterial);
        torso.position.set(0, -0.5, 0);
        this.body.add(torso);

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
        this.createOmniWand();
        this.createRideWand();
        this.createBroom();
        this.createFoodModels();
        this.updateHeldItemVisibility();
    }

    createWand() {
        const wandGroup = new THREE.Group();

        // Handle (Stick)
        const handleGeo = new THREE.BoxGeometry(0.04, 0.4, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x5C4033, depthTest: false }); // Wood
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.2; // Extend down from grip
        wandGroup.add(handle);

        // Tip (Gem)
        const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08); // Cube gem
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xFF00FF, depthTest: false }); // Glowing Magenta
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 999;
        tip.position.y = -0.42; // Bottom of handle
        wandGroup.add(tip);

        // Position handled by toolAttachment
        wandGroup.position.set(0, 0, 0);
        wandGroup.rotation.set(0, 0, 0);

        this.toolAttachment.add(wandGroup);
        this.wand = wandGroup;
        this.wand.visible = false;
    }

    createLevitationWand() {
        const wandGroup = new THREE.Group();

        // Handle (Stick)
        const handleGeo = new THREE.BoxGeometry(0.04, 0.4, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x5C4033, depthTest: false }); // Wood
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.2;
        wandGroup.add(handle);

        // Tip (Gem) - Yellow
        const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00, depthTest: false }); // Yellow
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 999;
        tip.position.y = -0.42;
        wandGroup.add(tip);

        // Position handled by toolAttachment
        wandGroup.position.set(0, 0, 0);
        wandGroup.rotation.set(0, 0, 0);

        this.toolAttachment.add(wandGroup);
        this.levitationWand = wandGroup;
        this.levitationWand.visible = false;
    }

    createShrinkWand() {
        const wandGroup = new THREE.Group();

        // Handle (Stick) - Maybe darker wood?
        const handleGeo = new THREE.BoxGeometry(0.04, 0.4, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x3d2b1f, depthTest: false });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.2;
        wandGroup.add(handle);

        // Tip (Gem) - Cyan
        const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, depthTest: false }); // Glowing Cyan
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 999;
        tip.position.y = -0.42;
        wandGroup.add(tip);

        // Position handled by toolAttachment
        wandGroup.position.set(0, 0, 0);
        wandGroup.rotation.set(0, 0, 0);

        this.toolAttachment.add(wandGroup);
        this.shrinkWand = wandGroup;
        this.shrinkWand = wandGroup;
        this.shrinkWand.visible = false;
    }

    createGrowthWand() {
        const wandGroup = new THREE.Group();

        // Handle (Stick)
        const handleGeo = new THREE.BoxGeometry(0.04, 0.4, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x3d2b1f, depthTest: false });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.2;
        wandGroup.add(handle);

        // Tip (Gem) - Green
        const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0x00FF00, depthTest: false }); // Glowing Green
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 999;
        tip.position.y = -0.42;
        wandGroup.add(tip);

        this.toolAttachment.add(wandGroup);
        this.growthWand = wandGroup;
        this.growthWand.visible = false;
    }

    createOmniWand() {
        const wandGroup = new THREE.Group();

        // Handle (Dark Metal)
        const handleGeo = new THREE.BoxGeometry(0.05, 0.45, 0.05);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x222222, depthTest: false });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.2;
        wandGroup.add(handle);

        // Tip (Rainbow Gem)
        const tipGeo = new THREE.DodecahedronGeometry(0.09); // Complex shape
        // Using NormalMaterial for rainbow-ish effect easily, or just white with lights
        const tipMat = new THREE.MeshNormalMaterial({ depthTest: false });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 999;
        tip.position.y = -0.45;
        wandGroup.add(tip);

        this.toolAttachment.add(wandGroup);
        this.omniWand = wandGroup;
        this.omniWand.visible = false;
    }

    createRideWand() {
        const wandGroup = new THREE.Group();

        // Handle (Stick)
        const handleGeo = new THREE.BoxGeometry(0.04, 0.4, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x5C4033, depthTest: false }); // Wood
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.renderOrder = 999;
        handle.position.y = -0.2;
        wandGroup.add(handle);

        // Tip (Leather/Saddle style)
        const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0x8B4513, depthTest: false }); // Saddle Brown
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 999;
        tip.position.y = -0.42;
        wandGroup.add(tip);

        // Position handled by toolAttachment
        wandGroup.position.set(0, 0, 0);
        wandGroup.rotation.set(0, 0, 0);

        this.toolAttachment.add(wandGroup);
        this.rideWand = wandGroup;
        this.rideWand.visible = false;
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
    }

    createBow() {
        const bowGroup = new THREE.Group();

        // Bow Body (Simple Arc approximated by 3 segments for "curved" look)
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513, depthTest: false });

        // Center handle
        const handleGeo = new THREE.BoxGeometry(0.04, 0.2, 0.05);
        const handle = new THREE.Mesh(handleGeo, woodMat);
        handle.renderOrder = 999;
        bowGroup.add(handle);

        // Upper Limb
        const upperGeo = new THREE.BoxGeometry(0.03, 0.3, 0.04);
        const upper = new THREE.Mesh(upperGeo, woodMat);
        upper.renderOrder = 999;
        upper.position.set(0, 0.22, -0.05);
        upper.rotation.x = -0.4;
        bowGroup.add(upper);

        // Lower Limb
        const lowerGeo = new THREE.BoxGeometry(0.03, 0.3, 0.04);
        const lower = new THREE.Mesh(lowerGeo, woodMat);
        lower.renderOrder = 999;
        lower.position.set(0, -0.22, -0.05);
        lower.rotation.x = 0.4;
        bowGroup.add(lower);

        // Single String
        const stringMat = new THREE.LineBasicMaterial({ color: 0xDDDDDD });
        const stringGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.35, -0.12), // Top tip approx
            new THREE.Vector3(0, -0.35, -0.12) // Bottom tip approx
        ]);
        const string = new THREE.Line(stringGeo, stringMat);
        bowGroup.add(string);

        // Position attached to hand
        // Move it forward (Z) and rotate to face forward 
        // Arm is vertical, so we need to rotate bow
        bowGroup.position.set(0, -0.2, 0.2); // Stick out front
        bowGroup.rotation.y = -Math.PI / 2; // Face forward relative to camera/body
        bowGroup.rotation.z = Math.PI / 2;  // Vertical orientation

        // Adjust for "holding in front"
        // Actually, let's just place it nicely in the hand.
        // If we want the player to "hold it out", we need to raise the arm in animation.
        // For now, let's just orient the bow so it projects forward from the hand.
        bowGroup.position.set(0, -0.6, 0.4); // Hand is at -0.35 approx? Let's guess. Arm height is 0.7. Hand is bottom.
        bowGroup.rotation.set(0, -Math.PI / 2, Math.PI / 2);

        this.rightArm.add(bowGroup);
        this.bow = bowGroup;
        this.bow.visible = false;
    }

    updateHeldItemVisibility() {
        const selectedItem = this.game.inventory ? this.game.inventory.getSelectedItem() : null;
        const itemType = selectedItem ? selectedItem.item : null;

        if (this.pickaxe) this.pickaxe.visible = itemType === 'pickaxe';
        if (this.sword) this.sword.visible = itemType === 'sword';
        if (this.bow) this.bow.visible = itemType === 'bow';
        if (this.apple) this.apple.visible = itemType === 'apple';
        if (this.bread) this.bread.visible = itemType === 'bread';
        if (this.wand) this.wand.visible = itemType === 'wand';
        if (this.levitationWand) this.levitationWand.visible = itemType === 'levitation_wand';
        if (this.shrinkWand) this.shrinkWand.visible = itemType === 'shrink_wand';
        if (this.growthWand) this.growthWand.visible = itemType === 'growth_wand';
        if (this.omniWand) this.omniWand.visible = itemType === 'omni_wand';
        if (this.rideWand) this.rideWand.visible = itemType === 'ride_wand';
        if (this.broom) {
            // Only show held broom if we are NOT flying
            this.broom.visible = (itemType === 'flying_broom' && !this.isFlying);
        }
    }

    swingArm() {
        this.isMining = true;
        this.miningTimer = 0;
    }

    update(deltaTime) {
        // Skip update if player is dead
        if (this.isDead) return;

        const input = this.game.inputManager;
        const speed = this.speed * (input.isActionActive('SPRINT') ? this.sprintMultiplier : 1);

        // Calculate movement input
        const moveForward = (input.isActionActive('FORWARD') ? 1 : 0) - (input.isActionActive('BACKWARD') ? 1 : 0);
        const moveRight = (input.isActionActive('RIGHT') ? 1 : 0) - (input.isActionActive('LEFT') ? 1 : 0);

        // Apply rotation to movement (local to character facing direction)
        const sin = Math.sin(this.rotation.y);
        const cos = Math.cos(this.rotation.y);

        // Forward/back moves along camera facing direction, left/right strafes perpendicular
        const velX = (-moveForward * sin + moveRight * cos) * speed;
        const velZ = (-moveForward * cos - moveRight * sin) * speed;

        // Studio mode - disable physics and allow free movement
        if (this.game.studio && this.game.studio.isActive) {
            // Free movement in studio - no gravity, no collision
            this.position.x += velX;
            this.position.z += velZ;

            // Allow vertical movement with space/shift
            if (input.isActionActive('JUMP')) this.position.y += speed * 0.5;
            if (input.isActionActive('SPRINT')) this.position.y -= speed * 0.5;

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

            if ((input.isActionActive('INTERACT') || input.isActionActive('SPRINT')) && canDismount) {
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
        } else {
            // NORMAL PHYSICS OR FLYING
            if (this.isFlying) {
                // Flying Physics
                // Base flight speed is 3x walk speed
                // Shift (Sprint) boosts it to 5x
                let currentFlightSpeed = speed * (input.isActionActive('SPRINT') ? 6.0 : 3.0);

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
                const bobbing = Math.cos(this.flightTime * 2.0) * 0.005;
                this.velocity.y += bobbing;

                if (moveRight !== 0) {
                    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
                    this.velocity.x += right.x * currentFlightSpeed * moveRight;
                    this.velocity.z += right.z * currentFlightSpeed * moveRight;
                }

                // Vertical controls (Space to go straight up)
                if (input.isActionActive('JUMP')) this.velocity.y += currentFlightSpeed;
                // Shift no longer goes down, it boosts speed above.
                // Descent is handled by looking down and moving forward.

                // Move (using collision or just position?)
                // Use collision to prevent going through walls
                this.moveWithCollision(this.velocity.x, this.velocity.y, this.velocity.z);

                // Reset falling state
                this.onGround = false;
                this.highestY = this.position.y; // Fix fall damage accumulation

            } else {
                // Check if in water
                const blockAtFeet = this.game.getBlock(this.position.x, this.position.y, this.position.z);
                const inWater = blockAtFeet && blockAtFeet.type === 'water';

                // Track highest Y for fall damage
                if (this.onGround || inWater) {
                    this.highestY = this.position.y;
                } else {
                    this.highestY = Math.max(this.highestY, this.position.y);
                }

                // Apply gravity
                if (inWater) {
                    this.velocity.y -= this.game.gravity * 0.2; // Reduced gravity
                    if (input.isActionActive('JUMP')) {
                        this.velocity.y = 0.1; // Swim up
                    }
                    this.velocity.x *= 0.5; // Drag
                    this.velocity.z *= 0.5;
                } else {
                    this.velocity.y -= this.game.gravity;
                    // Jump
                    if (input.isActionActive('JUMP') && !this.wasSpacePressed && this.onGround) {
                        this.velocity.y = this.jumpForce;
                        this.onGround = false;
                    }
                }

                this.wasSpacePressed = input.isActionActive('JUMP');

                // Move with collision detection
                this.moveWithCollision(velX, this.velocity.y, velZ);

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

        // 3rd Person Back
        if (this.cameraMode === 1) {
            this.body.position.copy(this.position);
            this.body.position.y += 1.25;
            this.body.rotation.set(0, this.rotation.y, 0);

            // Camera is now child of head, so no manual update needed here
            // It will follow head position and rotation automatically

        } else if (this.cameraMode === 2) {
            // 3rd Person Front (Selfie)
            this.body.position.copy(this.position);
            this.body.position.y += 1.25;
            this.body.rotation.set(0, this.rotation.y, 0);

            const camDist = 4;
            const camHeight = 2;
            // Negative sin/cos to put camera IN FRONT like original bug
            const cx = this.position.x - Math.sin(this.rotation.y) * camDist;
            const cz = this.position.z - Math.cos(this.rotation.y) * camDist;
            const cy = this.position.y + camHeight;

            camera.position.set(cx, cy, cz);
            camera.lookAt(this.position.x, this.position.y + 1.2, this.position.z);

        } else if (this.cameraMode === 3) {
            // Orbit Mode
            this.body.position.copy(this.position);
            this.body.position.y += 1.25;
            this.body.rotation.set(0, this.rotation.y, 0);

            const radius = 5;
            // Calculate camera position from orbitRotation
            // y is yaw (around Y axis), x is pitch (up/down)
            // Three.js convention: Y is up.
            // Z is forward for 0 rotation? Let's check math.
            // We want camera to orbit.

            const theta = this.orbitRotation.y; // Horizontal
            const phi = this.orbitRotation.x;   // Vertical

            // Standard spherical conversion (adjusted for Y-up)
            const cy = this.position.y + 1.5 + Math.sin(phi) * radius;
            const rH = Math.cos(phi) * radius; // Horizontal radius
            const cx = this.position.x + Math.sin(theta) * rH;
            const cz = this.position.z + Math.cos(theta) * rH;

            camera.position.set(cx, cy, cz);
            camera.lookAt(this.position.x, this.position.y + 1.2, this.position.z);

        } else {
            // 1st Person Logic (Default)
            camera.position.copy(this.position);
            camera.position.y += 1.6;
            camera.rotation.order = 'YXZ';
            camera.rotation.y = this.rotation.y;
            camera.rotation.x = this.rotation.x;
        }

        // Animate arms and legs
        this.updateBodyAnimation(moveForward, moveRight, input, deltaTime);

        // Update hunger and health
        this.updateHungerAndHealth(deltaTime, input);
    }


    // ...

    // Duplicate toggleCameraView removed

    updateHungerAndHealth(deltaTime, input) {
        // Eating Logic
        if (this.isEating) {
            this.eatingTimer += deltaTime;

            // "Bob" animation or particles could go here

            if (this.eatingTimer >= this.eatingDuration) {
                // Consume food
                const consumed = this.game.inventory.useSelectedItem();
                if (consumed) {
                    // Success sound?
                    // Reset
                    this.stopEating();
                } else {
                    // Failed (maybe ran out?)
                    this.stopEating();
                }
            }
        }

        // Track distance traveled for hunger depletion
        if (this.lastPosition) {
            const dx = this.position.x - this.lastPosition.x;
            const dz = this.position.z - this.lastPosition.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            this.distanceTraveled += distance;

            // Deplete hunger based on movement
            // Deplete hunger based on movement
            if (this.distanceTraveled >= 10) {
                const hungerLoss = input.isActionActive('SPRINT') ? 0.3 : 0.1;
                this.hunger = Math.max(0, this.hunger - hungerLoss);
                this.distanceTraveled = 0;
            }
        }
        this.lastPosition = this.position.clone();

        // Health regeneration when hunger is high
        if (this.hunger > 16 && this.health < this.maxHealth) {
            this.regenTimer += deltaTime;
            if (this.regenTimer >= 4) {
                this.heal(1);
                this.regenTimer = 0;
            }
        } else {
            this.regenTimer = 0;
        }

        // Starvation damage when hunger is empty
        if (this.hunger <= 0) {
            this.starvationTimer += deltaTime;
            if (this.starvationTimer >= 4) {
                this.takeDamage(1);
                this.starvationTimer = 0;
            }
        } else {
            this.starvationTimer = 0;
        }

        // Update HUD
        this.updateStatusBars();
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);

        // Visual feedback - flash screen red
        const damageOverlay = document.getElementById('damage-overlay');
        if (damageOverlay) {
            damageOverlay.classList.add('active');
            setTimeout(() => damageOverlay.classList.remove('active'), 200);
        }

        // Check for death
        if (this.health <= 0) {
            this.onDeath();
        }
    }

    knockback(direction, force) {
        // direction is a normalized Vector3
        // force is scalar
        // Add to velocity (simple impulse)
        this.velocity.x += direction.x * force;
        this.velocity.z += direction.z * force;
        this.velocity.y = 0.2; // Small hop
        this.onGround = false;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    eat(amount) {
        this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    }

    mountEntity(entity) {
        if (this.mount) return;

        this.mount = entity;
        entity.rider = this;

        // Snap to it
        this.position.copy(entity.position);
        this.position.y += 0.8; // Initial snap lower
        this.velocity.set(0, 0, 0);

        // Notify
        console.log("Mounted horse!");
    }

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
            this.velocity.y = 0.5; // Hop
            this.game.addMessage && this.game.addMessage("You are now flying!");

            // Switch to Riding Model
            if (this.ridingBroom) this.ridingBroom.visible = true;
            if (this.broom) this.broom.visible = false;

            // Sitting Pose
            // Lift legs up forward (90 degrees / PI/2)
            if (this.leftLeg) this.leftLeg.rotation.x = Math.PI / 2;
            if (this.rightLeg) this.rightLeg.rotation.x = Math.PI / 2;

            // Arm position? Maybe holding the handle in front?
            this.rightArm.rotation.x = Math.PI / 3;

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

    startEating() {
        if (this.isEating) return;
        if (this.hunger >= this.maxHunger) return;

        // Check if holding food
        const item = this.game.inventory.getSelectedItem();
        if (item && item.type === 'food') {
            this.isEating = true;
            this.eatingTimer = 0;
        }
    }

    stopEating() {
        this.isEating = false;
        this.eatingTimer = 0;
    }

    onDeath() {
        // Set player as dead (prevents movement/input)
        this.isDead = true;

        // Show death screen via UIManager
        if (this.game.uiManager) {
            this.game.uiManager.showDeathScreen();
        }
    }

    respawn() {
        // Reset player state
        this.isDead = false;
        this.health = this.maxHealth;
        this.hunger = this.maxHunger;

        // Respawn at a safe location
        if (this.game.spawnPlayer) {
            this.game.spawnPlayer();
        } else {
            // Fallback if mechanism fails
            this.position.set(32, 80, 32);
            this.velocity.set(0, 0, 0);
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

        // Update hunger bar
        const hungerFill = document.getElementById('hunger-fill');
        if (hungerFill) {
            const hungerPercent = (this.hunger / this.maxHunger) * 100;
            hungerFill.style.width = hungerPercent + '%';
        }

        // Update heart icons
        this.updateHearts();
        this.updateDrumsticks();
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

    updateDrumsticks() {
        const container = document.getElementById('hunger-drumsticks');
        if (!container) return;

        const fullDrumsticks = Math.floor(this.hunger / 2);
        const halfDrumstick = this.hunger % 2 >= 1;

        let html = '';
        for (let i = 0; i < 10; i++) {
            if (i < fullDrumsticks) {
                html += '<span class="drumstick full">🍖</span>';
            } else if (i === fullDrumsticks && halfDrumstick) {
                html += '<span class="drumstick half">🦴</span>';
            } else {
                html += '<span class="drumstick empty">🦴</span>';
            }
        }
        container.innerHTML = html;
    }

    updateBodyAnimation(moveX, moveZ, input, deltaTime) {
        const isBowVisible = this.bow && this.bow.visible;

        // Mining animation (also used for eating)
        if (this.isMining && !isBowVisible) {
            this.miningTimer += deltaTime * 15;
            if (this.miningTimer > Math.PI) {
                this.isMining = false;
                this.miningTimer = 0;
                this.swingCompleted = true; // Signal that swing is done
            } else {
                if (this.rightArmPivot) {
                    // Mining swing override
                    const swing = Math.sin(this.miningTimer) * 1.5;
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

        // Eating Animation Logic
        if (this.isEating && this.rightArmPivot) {
            // Raise arm to center/mouth (adjusted for visibility)
            const eatBob = Math.sin(this.eatingTimer * 20) * 0.1;
            const targetX = -1.1 + eatBob; // Less upward rotation so we see the item
            const targetY = 0.4; // Angle inwards
            const targetZ = -0.5; // Rotate arm to bring hand to center

            // Smoothly interpolate
            const dt = deltaTime * 10;
            this.rightArmPivot.rotation.x += (targetX - this.rightArmPivot.rotation.x) * dt;
            this.rightArmPivot.rotation.y += (targetY - this.rightArmPivot.rotation.y) * dt;
            this.rightArmPivot.rotation.z += (targetZ - this.rightArmPivot.rotation.z) * dt;
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
            if (this.rightArmPivot && !this.isMining && !isBowVisible && !this.isEating) {
                this.rightArmPivot.rotation.x = -Math.PI / 6;
            }
            if (this.leftArmPivot) {
                this.leftArmPivot.rotation.x = -Math.PI / 6;
            }
            return; // Skip walking animation
        }

        if (this.isFlying) {
            // Flying Pose - Static arms and legs
            // Legs sitting forward (Positive rotation for forward if negative was backward)
            if (this.leftLegPivot) this.leftLegPivot.rotation.x = Math.PI / 2;
            if (this.rightLegPivot) this.rightLegPivot.rotation.x = Math.PI / 2;

            // Arms static holding handle
            if (this.rightArmPivot) this.rightArmPivot.rotation.x = Math.PI / 3;
            if (this.leftArmPivot) this.leftArmPivot.rotation.x = Math.PI / 3;

            return; // Skip walking animation
        }

        if (isMoving) {
            this.armSwingAngle += deltaTime * swingSpeed;
            const swingAmount = Math.sin(this.armSwingAngle) * maxSwingAngle;

            if (this.leftArmPivot) this.leftArmPivot.rotation.x = swingAmount;

            // Only swing right arm if NOT mining AND NOT holding bow AND NOT eating
            if (this.rightArmPivot && !this.isMining && !isBowVisible && !this.isEating) {
                this.rightArmPivot.rotation.x = basePitch - swingAmount;
            }

            if (this.leftLegPivot) this.leftLegPivot.rotation.x = -swingAmount;
            if (this.rightLegPivot) this.rightLegPivot.rotation.x = swingAmount;
        } else {
            // Return to neutral
            const returnSpeed = 5;
            if (this.leftArmPivot) this.leftArmPivot.rotation.x *= Math.max(0, 1 - deltaTime * returnSpeed);

            // Only return right arm if NOT mining AND NOT holding bow AND NOT eating
            if (this.rightArmPivot && !this.isMining && !isBowVisible && !this.isEating) {
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
                            if (this.velocity.y < -0.2) {
                                this.velocity.y = -this.velocity.y * 0.9; // 90% resilience
                                this.highestY = pos.y; // Reset fall damage calculation
                                canMoveY = false;
                                this.onGround = false; // Do not land
                                return;
                            }
                        }

                        canMoveY = false;

                        // Fall damage check
                        if (!this.onGround) {
                            const fallDistance = this.highestY - pos.y;
                            if (fallDistance > 6) {
                                this.takeDamage(Math.floor(fallDistance - 6));
                            }
                        }

                        this.velocity.y = 0;
                        this.onGround = true;
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
                            pos.y += 1.1; // Snap up
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
                            pos.y += 1.1;
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

        if (this.cameraMode === 3) {
            // Orbit rotation
            this.orbitRotation.y -= dx * sensitivity;
            this.orbitRotation.x += dy * sensitivity; // Invert pitch control for orbit feels natural usually, or match? Key is "move mouse"
            // Let's stick to standard: mouse up (negative dy) -> look up (camera goes down? or camera looks up?) 
            // In orbit: Mouse up usually moves camera UP (so you look down).
            // dy is positive when moving down? Depends on event.
            // Assuming standard fly controls:
            // InputManager passes deltaX/Y.

            // Limit vertical orbit
            this.orbitRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.orbitRotation.x));

        } else {
            // Character rotation
            this.rotation.y -= dx * sensitivity;
            this.rotation.x -= dy * sensitivity;
            this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
        }
    }

    toggleCameraView() {
        this.cameraMode = (this.cameraMode + 1) % 4; // Now 4 modes

        // Reset camera to scene by default (handling switching from Mode 1)
        this.game.scene.add(this.game.camera);

        const crosshair = document.getElementById('crosshair');

        if (this.cameraMode !== 0) {
            // Switch to 3rd Person (Back, Front, or Orbit)
            // Detach body from camera, attach to scene
            this.game.scene.add(this.body);
            this.body.visible = true;
            if (this.head) this.head.visible = true;

            // Hide crosshair
            if (crosshair) crosshair.classList.add('hidden');

            if (this.cameraMode === 1) {
                // 3rd Person Back
                // Parent camera to head for orbiting behavior
                if (this.head) {
                    this.head.add(this.game.camera);
                    this.game.camera.position.set(0, 0, 4); // Behind head
                    this.game.camera.rotation.set(0, 0, 0); // Look forward (Z- matches Head Z-)
                }
            } else if (this.cameraMode === 3) {
                // Init orbit rotation to current player facing to avoid snap?
                // Or just start from back?
                // Let's start from back:
                this.orbitRotation.y = this.rotation.y + Math.PI; // Face player (camera is 'behind' so +PI in front? wait)
                // If player is RotY = 0 (looking -Z), we want camera at +Z looking at -Z.
                // Camera at Z=Radius.
                // Theta = 0 -> Z = R*cos(0) = R. Correct.
                // But if RotY=0, player looks -Z.
                // So OrbitY=0 puts camera at +Z.
                // Yes.
                this.orbitRotation.y = this.rotation.y;
                this.orbitRotation.x = 0;
            }

        } else {
            // Switch to 1st Person
            // Attach body to camera
            this.game.camera.add(this.body);

            // Position relative to camera to see arms
            this.body.position.set(0, -0.3, -0.4);
            this.body.rotation.set(0, 0, 0);

            // Hide head in 1st person to prevent clipping
            if (this.head) this.head.visible = false;

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