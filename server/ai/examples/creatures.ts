/**
 * Creature Examples for Few-Shot AI
 * These are simplified, working examples that the AI can reference
 * Uses semantic search to find the most relevant examples for each request
 */

import { semanticSearchExamples } from '../../services/SemanticSearch';

export const creatureExamples = [
    {
        name: "VoxelDragon",
        description: "A majestic flying dragon with animated wings, fire breathing, articulated neck and tail segments",
        keywords: ["dragon", "fly", "flying", "fire", "wings", "mythical", "creature", "monster", "beast", "large", "scary", "breathe"],
        code: `class VoxelDragon extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // Flight & Animation State
        this.time = 0;
        this.speedMul = 1;
        this.breathing = false;
        this.fireTimer = 0;
        this.flightSpeed = 12.0;
        this.flightVelocity = new THREE.Vector3();
        this.targetDirection = new THREE.Vector3(1,0,0);
        this.homePosition = new THREE.Vector3(x, y, z);
        this.maxRoamDistance = 100;
        this.flyingHeight = 20;
        this.turnSpeed = 1.0;

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
        super.update(dt);

        this.time += dt * this.speedMul;

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

        // Leg walking animation
        if (this.legs) {
            this.legs.forEach((l,i)=>{
                const o=i*Math.PI*.5;
                l.group.rotation.x=Math.sin(this.time*1.4+o)*.22;
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
