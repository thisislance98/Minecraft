/**
 * Creature Examples for Few-Shot AI
 * These are simplified, working examples that the AI can reference
 * Uses semantic search to find the most relevant examples for each request
 */

import { semanticSearchExamples } from '../../services/SemanticSearch';

export const creatureExamples = [
    {
        name: "VoxelDragon",
        description: "A majestic flying dragon with animated wings, fire breathing, articulated neck and tail segments. Flies through the air with circling, swooping, and direction-change behaviors.",
        keywords: ["dragon", "fly", "flying", "fire", "wings", "mythical", "creature", "monster", "beast", "large", "scary", "breathe"],
        code: `class VoxelDragon extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // CRITICAL: Disable gravity for flight
        this.gravity = 0;
        this.flying = true;

        // Flight & Animation State
        this.time = 0;
        this.speedMul = 1;
        this.breathing = false;
        this.fireTimer = 0;
        this.flightSpeed = 12.0;
        this.flightVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            0,
            (Math.random() - 0.5) * 12
        );
        this.targetDirection = new THREE.Vector3(1,0,0);
        this.homePosition = new THREE.Vector3(x, y, z);
        this.maxRoamDistance = 100;
        this.flyingHeight = 20;
        this.turnSpeed = 1.0;
        this.directionChangeTimer = 0;
        this.directionChangeInterval = 3 + Math.random() * 4;
        this.swoopTimer = Math.random() * Math.PI * 2;
        this.isCircling = false;
        this.circleCenter = null;
        this.circleRadius = 20;
        this.circleAngle = Math.random() * Math.PI * 2;

        // Colors
        this.C = {
            body1:0x5a1a3a, body2:0x7a2255, body3:0x44112e,
            belly:0xcc8844, bellyLt:0xddaa55,
            eye:0xffcc00, eyeGlow:0xffaa00,
            horn:0x332222, hornTip:0x665544,
            wingBone:0x661133, wingMem:0x881144, wingMemD:0x550a2a,
            claw:0x221111, tooth:0xeeddcc, accent:0xff4422
        };

        this.createBody();

        // Scale it up a bit to be imposing
        this.mesh.scale.set(1.5, 1.5, 1.5);

        // Initialize simple fire particles based on head glow
        this.fireLight = new THREE.PointLight(0xff4400, 0, 20);
        this.head.add(this.fireLight);
    }

    V(w, h, d, c, e, ei) {
        const mat = new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.65,
            metalness: 0.15,
            emissive: e || 0,
            emissiveIntensity: ei || 0
        });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.castShadow = true;
        m.receiveShadow = true;
        return m;
    }

    createBody() {
        // Main body with scales
        const body = new THREE.Group();
        body.add(this.V(4,3,7,this.C.body1));
        for(let s=-1;s<=1;s+=2){
            const sc = this.V(.5,2.5,6,this.C.body2);
            sc.position.set(s*2.2,0,0);
            body.add(sc);
        }
        const bl = this.V(3.2,.8,6.5,this.C.belly);
        bl.position.y=-1.4;
        body.add(bl);

        // Spines along back
        for(let i=-2;i<=2;i++){
            const r = this.V(.5,1+Math.abs(i)*.1,.5,this.C.accent,this.C.accent,.4);
            r.position.set(0,2,i*1.3);
            body.add(r);
        }
        this.mesh.add(body);

        // Articulated Neck with segments
        this.neckSegs = [];
        let prev = body;

        const neck = new THREE.Group();
        neck.position.set(0,1,-3.5);
        body.add(neck);
        prev = neck;

        for(let i=0;i<5;i++){
            const seg = new THREE.Group();
            const sz = 2.4-i*.25;
            seg.add(this.V(sz,sz,1.4,i%2===0?this.C.body1:this.C.body2));
            const nb = this.V(sz-.5,.4,1.2,this.C.bellyLt);
            nb.position.y=-sz/2;
            seg.add(nb);
            const r = this.V(.35,.6,.4,this.C.accent,this.C.accent,.3);
            r.position.y=sz/2+.25;
            seg.add(r);
            seg.position.set(0,.3,-1.5);
            prev.add(seg);
            this.neckSegs.push(seg);
            prev = seg;
        }

        // Head with horns, eyes, teeth
        this.head = new THREE.Group();
        this.head.add(this.V(2.8,2.2,3.2,this.C.body2));
        const brow = this.V(3,.5,1.5,this.C.body3);
        brow.position.set(0,1,-.5);
        this.head.add(brow);
        const sn = this.V(2.2,1.6,2.2,this.C.body1);
        sn.position.set(0,-.2,-2.2);
        this.head.add(sn);

        // Nostrils with glow
        for(let s=-1;s<=1;s+=2){
            const n = this.V(.35,.35,.35,0x111111);
            n.position.set(s*.55,.3,-3.4);
            this.head.add(n);
            const g = this.V(.2,.2,.2,this.C.accent,this.C.accent,1);
            g.position.set(s*.55,.15,-3.5);
            this.head.add(g);
        }

        // Glowing eyes
        this.eyes = [];
        for(let s=-1;s<=1;s+=2){
            const eye = this.V(.7,.55,.55,this.C.eye,this.C.eyeGlow,3);
            eye.position.set(s*1.25,.6,-.9);
            this.head.add(eye);
            this.eyes.push(eye);
        }

        // Horns
        for(let s=-1;s<=1;s+=2)for(let j=0;j<3;j++){
            const sz=.45-j*.08;
            const h = this.V(sz,.9,sz,j<2?this.C.horn:this.C.hornTip);
            h.position.set(s*(.8+j*.15),1.5+j*.8,.3-j*.15);
            h.rotation.z=s*(-.25-j*.1);
            this.head.add(h);
        }

        // Animated lower jaw
        this.lowerJaw = new THREE.Group();
        this.lowerJaw.add(this.V(2.1,.65,2.6,this.C.body3));
        this.lowerJaw.position.set(0,-1.3,-1);
        this.head.add(this.lowerJaw);

        this.head.position.set(0,0,-1.8);
        prev.add(this.head);

        // Wings with membrane and finger bones
        this.wings = [];
        for(let s=-1;s<=1;s+=2){
            const wing = new THREE.Group();
            wing.add(this.V(1.2,1,1.2,this.C.body2));

            const upperArm = new THREE.Group();
            const uaB = this.V(7,.7,.8,this.C.wingBone);
            uaB.position.x=s*3.5;
            upperArm.add(uaB);

            const forearm = new THREE.Group();
            const faB = this.V(6,.55,.65,this.C.wingBone);
            faB.position.x=s*3;
            forearm.add(faB);

            const fingers = [];
            for(let f=0;f<3;f++){
                const finger = new THREE.Group();
                const fLen = 8-f*1.8;
                const fB = this.V(.35,.3,fLen,this.C.wingBone);
                fB.position.z=fLen/2;
                finger.add(fB);
                finger.position.set(s*(1+f*2.2),0,0);
                forearm.add(finger);
                fingers.push(finger);
            }

            forearm.position.x=s*7;
            upperArm.add(forearm);
            wing.add(upperArm);
            wing.position.set(0,1.5,-.5);
            body.add(wing);
            this.wings.push({group:wing,upperArm,forearm,fingers,side:s});
        }

        // Tail segments
        const tail = new THREE.Group();
        this.tailSegs = [];
        prev = tail;
        for(let i=0;i<8;i++){
            const seg = new THREE.Group();
            const sz = 2.2-i*.2;
            seg.add(this.V(Math.max(sz,.5),Math.max(sz,.5),1.5,this.C.body1));
            seg.position.z=1.5;
            prev.add(seg);
            this.tailSegs.push(seg);
            prev = seg;
        }
        tail.position.set(0,0,3.5);
        body.add(tail);

        // Legs with claws
        this.legs = [];
        [{x:-1.8,z:-1.5},{x:1.8,z:-1.5},{x:-1.8,z:2},{x:1.8,z:2}].forEach(p=>{
            const leg = new THREE.Group();
            const up = this.V(1.1,2.5,1.3,this.C.body2);
            up.position.y=-1.5;
            leg.add(up);
            const lo = new THREE.Group();
            lo.add(this.V(.85,2,1,this.C.body1));
            lo.position.set(0,-3,0);
            leg.add(lo);
            leg.position.set(p.x,-1.5,p.z);
            body.add(leg);
            this.legs.push({group:leg,lower:lo});
        });
    }

    update(dt) {
        if (!this.mesh) return;

        this.time += dt * this.speedMul;

        // === FLIGHT MOVEMENT (CRITICAL for flying creatures) ===

        // Direction changes every 3-7 seconds
        this.directionChangeTimer += dt;
        if (this.directionChangeTimer >= this.directionChangeInterval) {
            this.directionChangeTimer = 0;
            this.directionChangeInterval = 3 + Math.random() * 5;
            const behavior = Math.random();
            if (behavior < 0.3) {
                this.isCircling = true;
                this.circleCenter = this.position.clone();
                this.circleRadius = 15 + Math.random() * 20;
            } else {
                this.isCircling = false;
                const angle = Math.random() * Math.PI * 2;
                this.targetDirection.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
            }
        }

        // Update flight velocity
        if (this.isCircling && this.circleCenter) {
            this.circleAngle += dt * 0.5;
            const tx = this.circleCenter.x + Math.cos(this.circleAngle) * this.circleRadius;
            const tz = this.circleCenter.z + Math.sin(this.circleAngle) * this.circleRadius;
            const toTarget = new THREE.Vector3(tx - this.position.x, 0, tz - this.position.z);
            toTarget.normalize().multiplyScalar(this.flightSpeed);
            this.flightVelocity.lerp(toTarget, dt * 2);
        } else {
            const tv = this.targetDirection.clone().multiplyScalar(this.flightSpeed);
            this.flightVelocity.lerp(tv, dt * this.turnSpeed);
        }

        // Bounds checking - stay near home
        const dx = this.position.x - this.homePosition.x;
        const dz = this.position.z - this.homePosition.z;
        if (Math.sqrt(dx*dx + dz*dz) > this.maxRoamDistance) {
            const toHome = new THREE.Vector3(this.homePosition.x - this.position.x, 0, this.homePosition.z - this.position.z).normalize();
            this.targetDirection.copy(toHome);
            this.isCircling = false;
        }

        // Height control with swooping
        this.swoopTimer += dt * 0.8;
        const swoopOffset = Math.sin(this.swoopTimer) * 5;
        const groundY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(this.position.x, this.position.z) : 0;
        const targetY = groundY + this.flyingHeight + swoopOffset;
        this.flightVelocity.y = Math.max(-5, Math.min(5, (targetY - this.position.y) * 1.5));

        // Apply velocity to position
        this.position.x += this.flightVelocity.x * dt;
        this.position.y += this.flightVelocity.y * dt;
        this.position.z += this.flightVelocity.z * dt;

        // Minimum height safety
        if (this.position.y < groundY + 3) {
            this.position.y = groundY + 3;
            this.flightVelocity.y = Math.abs(this.flightVelocity.y);
        }

        // Orient to face flight direction
        if (this.flightVelocity.lengthSq() > 0.1) {
            const heading = Math.atan2(this.flightVelocity.x, this.flightVelocity.z);
            const hSpd = Math.sqrt(this.flightVelocity.x*this.flightVelocity.x + this.flightVelocity.z*this.flightVelocity.z);
            this.mesh.rotation.y = heading;
            this.mesh.rotation.x = Math.atan2(-this.flightVelocity.y, hSpd) * 0.3;
        }

        // Sync mesh position
        this.mesh.position.copy(this.position);

        // === ANIMATIONS ===

        // Wing flapping animation
        const fs = 2.8 * this.speedMul;
        const fa = 0.55;

        if (this.wings) {
            this.wings.forEach(w=>{
                const fl = Math.sin(this.time*fs);
                w.upperArm.rotation.z=fl*fa*w.side;
                w.forearm.rotation.z=Math.sin(this.time*fs+.6)*fa*.5*w.side;
                w.fingers.forEach((f,fi)=>f.rotation.x=Math.sin(this.time*fs+fi*.3)*.08);
            });
        }

        // Neck undulation
        if (this.neckSegs) {
            this.neckSegs.forEach((s,i)=>{
                s.rotation.x=Math.sin(this.time*1.4+i*.4)*.09;
                s.rotation.y=Math.sin(this.time*.7+i*.35)*.07;
            });
        }

        // Tail wave
        if (this.tailSegs) {
            this.tailSegs.forEach((s,i)=>{
                s.rotation.y=Math.sin(this.time*1.1+i*.55)*.14;
            });
        }

        // Leg tucking animation (tucked up during flight)
        if (this.legs) {
            this.legs.forEach((l,i)=>{
                const o=i*Math.PI*.5;
                l.group.rotation.x=Math.sin(this.time*1.4+o)*.12 + 0.3;
            });
        }

        // Fire breathing
        if (Math.random() < 0.01) this.breathing = true;
        if (this.fireTimer > 1) this.breathing = false;

        if (this.breathing) this.fireTimer = Math.min(this.fireTimer+dt*4, 1);
        else this.fireTimer = Math.max(this.fireTimer-dt*2, 0);

        if (this.lowerJaw) {
            this.lowerJaw.rotation.x = this.fireTimer * 0.55;
        }

        if (this.fireLight) {
            this.fireLight.intensity = this.fireTimer * 10 + Math.random() * 5;
        }
    }

    updatePhysics(dt) {
        // Override: flying creatures skip gravity and ground collision
        // Position is already updated in update()
    }
}`
    },
    {
        name: "FlyingEagle",
        description: "A simple flying eagle that soars through the air with flapping wings. Demonstrates the minimal flying creature pattern with waypoint-based 3D flight.",
        keywords: ["eagle", "bird", "fly", "flying", "soar", "wings", "hawk", "falcon", "owl", "parrot", "airborne", "sky", "simple", "small"],
        code: `class FlyingEagle extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.4;
        this.depth = 0.8;
        this.gravity = 0;
        this.flying = true;
        this.flySpeed = 5;
        this.flyingHeight = 15;
        this.roamRadius = 25;
        this.targetX = x;
        this.targetZ = z;
        this.targetAltitude = 15;
        this.wingTimer = 0;
        this.createBody();
    }

    createBody() {
        const brown = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const white = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const yellow = new THREE.MeshLambertMaterial({ color: 0xFFFF00 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.8), brown);
        body.position.set(0, 0.2, 0);
        body.castShadow = true;
        this.mesh.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), white);
        head.position.set(0, 0.4, 0.4);
        this.mesh.add(head);

        const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.2), yellow);
        beak.position.set(0, 0.35, 0.55);
        this.mesh.add(beak);

        this.leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), brown);
        this.leftWing.position.set(-0.5, 0.25, 0);
        this.leftWing.castShadow = true;
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), brown);
        this.rightWing.position.set(0.5, 0.25, 0);
        this.rightWing.castShadow = true;
        this.mesh.add(this.rightWing);
    }

    updateAI(dt) {
        // Pick new 3D waypoint every 5-10 seconds
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.stateTimer = 5 + Math.random() * 5;
            this.targetAltitude = 10 + Math.random() * 10;
            const angle = Math.random() * Math.PI * 2;
            this.targetX = this.position.x + Math.cos(angle) * this.roamRadius;
            this.targetZ = this.position.z + Math.sin(angle) * this.roamRadius;
        }

        // Move toward 3D target
        const dx = this.targetX - this.position.x;
        const dz = this.targetZ - this.position.z;
        const dy = this.targetAltitude - this.position.y;
        const dir = new THREE.Vector3(dx, dy, dz);
        const len = dir.length();
        if (len > 0.1) {
            dir.divideScalar(len);
            this.position.addScaledVector(dir, this.flySpeed * dt);
            this.rotation = Math.atan2(dir.x, dir.z);
        }

        // Wing flap animation
        this.wingTimer += dt * 6;
        const flap = Math.sin(this.wingTimer) * 0.4;
        this.leftWing.rotation.z = flap;
        this.rightWing.rotation.z = -flap;
    }

    updatePhysics(dt) {
        // Override: skip gravity and ground collision for flight
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }
}`
    }
];

/**
 * Find the best matching creature examples using semantic search
 * @param userRequest - The user's creature creation request
 * @param count - Number of examples to return (default 2)
 * @returns Promise resolving to array of best matching examples
 */
export async function findBestCreatureExamples(userRequest: string, count: number = 2): Promise<typeof creatureExamples> {
    if (creatureExamples.length === 0) {
        return [];
    }

    // If we only have one example, just return it
    if (creatureExamples.length === 1) {
        console.log(`[CreatureExamples] Only 1 example available, returning it`);
        return creatureExamples;
    }

    try {
        const results = await semanticSearchExamples(userRequest, creatureExamples, count);
        return results.map(r => r.example);
    } catch (error) {
        console.error('[CreatureExamples] Semantic search failed, returning first examples:', error);
        return creatureExamples.slice(0, count);
    }
}
