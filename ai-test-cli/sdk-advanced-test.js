// SDK Advanced Test Suite - Additional coverage
const results = [];
const category = {};

function test(cat, name, passed, details) {
    if (!category[cat]) category[cat] = { passed: 0, failed: 0 };
    if (passed) category[cat].passed++;
    else category[cat].failed++;
    results.push({ category: cat, name, passed, details });
}

// ============================================================
// COLLISION EVENTS
// ============================================================

const collisionObj = VoxelWorld.createObject('collision_test');
collisionObj.attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0xff0000 }] });
collisionObj.attach({
    type: 'CollisionTracker',
    collided: false,
    OnCollisionEnter: function(other) { this.collided = true; }
});
collisionObj.register();
const collisionInst = VoxelWorld.spawn('collision_test', 0, 65, 0);

// Manually trigger collision
collisionInst.OnCollisionEnter({ name: 'test' });
const collTracker = collisionInst.GetComponent('CollisionTracker');
test('Collision', 'OnCollisionEnter triggered', collTracker && collTracker.collided);

// ============================================================
// OnUse / OnDamage / OnDeath CALLBACKS
// ============================================================

const callbackObj = VoxelWorld.createObject('callback_test');
callbackObj.attach('mesh', { parts: [{ type: 'sphere', size: [1], color: 0x00ff00 }] });
callbackObj.attach({
    type: 'CallbackTracker',
    useCalled: false,
    damageCalled: false,
    deathCalled: false,
    OnUse: function(player) { this.useCalled = true; return true; },
    OnDamage: function(amount, attacker) { this.damageCalled = true; },
    OnDeath: function() { this.deathCalled = true; }
});
callbackObj.register();
const cbInst = VoxelWorld.spawn('callback_test', 5, 65, 5);
const cbTracker = cbInst.GetComponent('CallbackTracker');

cbInst.OnUse(VoxelWorld.localPlayer);
test('Callbacks', 'OnUse called', cbTracker && cbTracker.useCalled);

cbInst.OnDamage(10, null);
test('Callbacks', 'OnDamage called', cbTracker && cbTracker.damageCalled);

cbInst.OnDeath();
test('Callbacks', 'OnDeath called', cbTracker && cbTracker.deathCalled);

// ============================================================
// .on() FLUENT API
// ============================================================

let onUseFluent = false;
const fluentObj = VoxelWorld.createObject('fluent_test')
    .attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0x0000ff }] })
    .on('use', function(obj, player) { onUseFluent = true; })
    .register();
test('Fluent API', '.on() chains properly', VoxelWorld._objects.has('fluent_test'));

const fluentInst = VoxelWorld.spawn('fluent_test', 10, 65, 10);
fluentInst.OnUse(VoxelWorld.localPlayer);
test('Fluent API', '.on("use") callback works', onUseFluent);

// ============================================================
// MULTIPLE SCRIPTS ON SAME OBJECT
// ============================================================

const multiObj = VoxelWorld.createObject('multi_script');
multiObj.attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0xffffff }] });
multiObj.attach('health', { maxHealth: 50 });
multiObj.attach('physics', { mode: 'hopping' });
multiObj.attach({ type: 'Custom1', value: 1 });
multiObj.attach({ type: 'Custom2', value: 2 });
multiObj.register();

const multiInst = VoxelWorld.spawn('multi_script', 15, 65, 15);
test('Multi-Script', 'has MeshScript', multiInst.hasScript('MeshScript'));
test('Multi-Script', 'has HealthScript', multiInst.hasScript('HealthScript'));
test('Multi-Script', 'has PhysicsScript', multiInst.hasScript('PhysicsScript'));
test('Multi-Script', 'has Custom1', multiInst.hasScript('Custom1'));
test('Multi-Script', 'has Custom2', multiInst.hasScript('Custom2'));
test('Multi-Script', 'total script count', multiInst._scripts.length === 5);

// ============================================================
// TRANSFORM LOOKSAT
// ============================================================

// Create a cube for these tests
const simpleCube = VoxelWorld.createObject('simple_cube');
simpleCube.attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0x888888 }] });
simpleCube.register();

const lookObj = VoxelWorld.spawn('simple_cube', 0, 65, 0);
lookObj.transform.LookAt({ x: 100, y: 65, z: 100 });
test('Transform', 'LookAt() works', true); // Just check it doesn't throw

// ============================================================
// GAMEOBJECT.DESTROY STATIC METHOD
// ============================================================

const staticDestroyObj = VoxelWorld.spawn('simple_cube', 20, 65, 20);
// Use instance method since static isn't exposed globally
staticDestroyObj.Destroy();
test('GameObject', 'Destroy() method works', staticDestroyObj._destroyed);

// ============================================================
// REMOVEBLOCK
// ============================================================

const px = Math.floor(VoxelWorld.localPlayer.position.x);
const py = Math.floor(VoxelWorld.localPlayer.position.y) + 5;
const pz = Math.floor(VoxelWorld.localPlayer.position.z);
VoxelWorld.setBlock(px, py, pz, 'stone');
VoxelWorld.removeBlock(px, py, pz);
const removedBlock = VoxelWorld.getBlock(px, py, pz);
test('World API', 'removeBlock() sets to air', !removedBlock || removedBlock.type === 'air' || removedBlock === 0);

// ============================================================
// REGISTRIES GETTERS
// ============================================================

test('Registries', 'objects getter', VoxelWorld.objects instanceof Map);
test('Registries', 'items getter', VoxelWorld.items instanceof Map);
test('Registries', 'entities getter', VoxelWorld.entities instanceof Map);
test('Registries', 'projectiles getter', VoxelWorld.projectiles instanceof Map);

// ============================================================
// BLOCK TYPES
// ============================================================

const blockTypes = VoxelWorld.getBlockTypes();
test('World API', 'getBlockTypes() returns array', Array.isArray(blockTypes) && blockTypes.length > 0);

// ============================================================
// SUMMARY
// ============================================================

const summary = {};
for (const cat in category) {
    summary[cat] = category[cat].passed + '/' + (category[cat].passed + category[cat].failed);
}

const totalPassed = results.filter(function(r) { return r.passed; }).length;
const totalFailed = results.filter(function(r) { return !r.passed; }).length;

return {
    summary: summary,
    total: results.length,
    passed: totalPassed,
    failed: totalFailed,
    failedTests: results.filter(function(r) { return !r.passed; }).map(function(r) { return r.category + ': ' + r.name; })
};
