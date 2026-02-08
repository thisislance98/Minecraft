// SDK Full Test Suite
const results = [];
const category = {};

function test(cat, name, passed, details) {
    if (!category[cat]) category[cat] = { passed: 0, failed: 0 };
    if (passed) category[cat].passed++;
    else category[cat].failed++;
    results.push({ category: cat, name, passed, details });
}

// ============================================================
// 1. OBJECTS - Creation & Registration
// ============================================================

// Test: createObject
const obj1 = VoxelWorld.createObject('test_cube');
test('Objects', 'createObject returns object', obj1 !== null);

// Test: attach chaining
const chained = obj1.attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0xff0000 }] });
test('Objects', 'attach returns self (chaining)', chained === obj1);

// Test: register
const registered = obj1.register();
test('Objects', 'register adds to _objects', VoxelWorld._objects.has('test_cube'));

// Test: create item
const item = VoxelWorld.createObject('test_item');
item.attach('mesh', { parts: [{ type: 'sphere', size: [0.5], color: 0x00ff00 }] });
item.attach('item', { stackable: true, maxStack: 64 });
item.register();
test('Objects', 'item in _items', VoxelWorld._items.has('test_item'));

// Test: create entity
const entity = VoxelWorld.createObject('test_entity');
entity.attach('mesh', { parts: [{ type: 'box', size: [2,2,2], color: 0xffff00 }] });
entity.attach('entity', { category: 'creature' });
entity.register();
test('Objects', 'entity in _entities', VoxelWorld._entities.has('test_entity'));

// Test: create projectile
const proj = VoxelWorld.createObject('test_projectile');
proj.attach('mesh', { parts: [{ type: 'sphere', size: [0.2], color: 0xff00ff }] });
proj.attach('projectile', { speed: 20, damage: 10, lifetime: 5 });
proj.register();
test('Objects', 'projectile in _projectiles', VoxelWorld._projectiles.has('test_projectile'));

// Test: VoxelWorld.create() quick API
const quickObj = VoxelWorld.create({
    name: 'QuickCube',
    scripts: [
        { type: 'mesh', parts: [{ type: 'box', size: [1,1,1], color: 0x00ffff }] }
    ]
});
test('Objects', 'VoxelWorld.create() registers', VoxelWorld._objects.has('quickcube'));

// Test: defineScript
VoxelWorld.defineScript('SpinScript', {
    speed: 1,
    Update: function() { this.transform.rotation.y += this.speed * 0.01; }
});
const customScript = VoxelWorld.getCustomScript('SpinScript');
test('Objects', 'defineScript stores script', customScript !== null && customScript.speed === 1);

// ============================================================
// 2. SCRIPTS - Built-in script attachment
// ============================================================

// Test: mesh script
const meshObj = VoxelWorld.createObject('mesh_test');
meshObj.attach('mesh', { parts: [{ type: 'box', size: [1,2,1], color: 0x888888 }] });
meshObj.register();
const hasMesh = meshObj.hasScript('MeshScript');
test('Scripts', 'mesh script attached', hasMesh);

// Test: item script
const itemObj = VoxelWorld.createObject('item_test');
itemObj.attach('mesh', { parts: [{ type: 'sphere', size: [0.3], color: 0xffa500 }] });
itemObj.attach('item', { stackable: true, maxStack: 16, category: 'food' });
itemObj.register();
const hasItem = itemObj.hasScript('ItemScript');
test('Scripts', 'item script attached', hasItem);

// Test: health script
const healthObj = VoxelWorld.createObject('health_test');
healthObj.attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0xff0000 }] });
healthObj.attach('health', { maxHealth: 100, currentHealth: 100 });
healthObj.register();
const hasHealth = healthObj.hasScript('HealthScript');
test('Scripts', 'health script attached', hasHealth);

// Test: physics script
const physicsObj = VoxelWorld.createObject('physics_test');
physicsObj.attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0x00ff00 }] });
physicsObj.attach('physics', { mode: 'walking', gravity: true });
physicsObj.register();
const hasPhysics = physicsObj.hasScript('PhysicsScript');
test('Scripts', 'physics script attached', hasPhysics);

// Test: collider script
const colliderObj = VoxelWorld.createObject('collider_test');
colliderObj.attach('mesh', { parts: [{ type: 'sphere', size: [1], color: 0x0000ff }] });
colliderObj.attach('collider', { type: 'sphere', radius: 1 });
colliderObj.register();
const hasCollider = colliderObj.hasScript('ColliderScript');
test('Scripts', 'collider script attached', hasCollider);

// ============================================================
// 3. LIFECYCLE - Awake/Start/Update/OnDestroy
// ============================================================

const lifecycleObj = VoxelWorld.createObject('lifecycle_obj');
lifecycleObj.attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0x0000ff }] });
lifecycleObj.attach({
    type: 'LifecycleTest',
    awakeCalled: false,
    startCalled: false,
    updateCalled: false,
    Awake: function() { this.awakeCalled = true; },
    Start: function() { this.startCalled = true; },
    Update: function() { this.updateCalled = true; }
});
lifecycleObj.register();

const lifecycleInst = VoxelWorld.spawn('lifecycle_obj', 0, 70, 0);
const lcScript = lifecycleInst.GetComponent('LifecycleTest');

test('Lifecycle', 'Awake() called on spawn', lcScript && lcScript.awakeCalled);
test('Lifecycle', 'Start() called on spawn', lcScript && lcScript.startCalled);

// Trigger update
lifecycleInst.Update(0.016);
test('Lifecycle', 'Update() called', lcScript && lcScript.updateCalled);

// OnDestroy test
const destroyObj = VoxelWorld.createObject('destroy_obj');
destroyObj.attach('mesh', { parts: [{ type: 'sphere', size: [0.5], color: 0xff0000 }] });
destroyObj.attach({
    type: 'DestroyTest',
    OnDestroy: function() { window.__onDestroyTest = true; }
});
destroyObj.register();
const destroyInst = VoxelWorld.spawn('destroy_obj', 5, 70, 5);
destroyInst.Destroy();
test('Lifecycle', 'OnDestroy() called', window.__onDestroyTest === true);

// ============================================================
// 4. WORLD API - spawn, giveItem, blocks, trees
// ============================================================

// Test: spawn()
const spawnedObj = VoxelWorld.spawn('test_cube', 10, 65, 10);
test('World API', 'spawn() returns instance', spawnedObj !== null);

// Test: spawn position
test('World API', 'spawn at position', spawnedObj && Math.abs(spawnedObj.position.x - 10) < 1);

// Test: instance tracking
test('World API', 'instance in _instances', VoxelWorld._instances.has(spawnedObj));

// Test: giveItem
const gaveItem = VoxelWorld.giveItem('test_item', 5);
test('World API', 'giveItem() returns true', gaveItem === true);

// Test: setBlock (may fail if chunk not loaded)
VoxelWorld.setBlock(0, 80, 0, 'stone');
const block = VoxelWorld.getBlock(0, 80, 0);
test('World API', 'setBlock/getBlock', block !== null);

// Test: fill
const fillResult = VoxelWorld.fill(20, 65, 20, 22, 67, 22, 'glass');
test('World API', 'fill() success', fillResult.success && fillResult.count === 27);

// Test: setBlocks batch
const batchResult = VoxelWorld.setBlocks([
    { x: 30, y: 65, z: 30, type: 'brick' },
    { x: 31, y: 65, z: 30, type: 'brick' },
    { x: 32, y: 65, z: 30, type: 'brick' }
]);
test('World API', 'setBlocks() batch', batchResult.success && batchResult.count === 3);

// Test: spawnTree
const treeResult = VoxelWorld.spawnTree('oak', 50, 64, 50);
test('World API', 'spawnTree() success', treeResult.success);

// Test: getTreeTypes
const treeTypes = VoxelWorld.getTreeTypes();
test('World API', 'getTreeTypes()', Array.isArray(treeTypes) && treeTypes.includes('oak'));

// Test: localPlayer
test('World API', 'localPlayer exists', VoxelWorld.localPlayer !== null);

// Test: findInRadius
const nearby = VoxelWorld.findInRadius({ x: 0, y: 65, z: 0 }, 100);
test('World API', 'findInRadius()', Array.isArray(nearby));

// ============================================================
// 5. GAMEOBJECT - GetComponent, destroy, SetActive
// ============================================================

const goTestObj = VoxelWorld.spawn('test_cube', 15, 65, 15);

// Test: GetComponent
const meshScript = goTestObj.GetComponent('MeshScript');
test('GameObject', 'GetComponent() finds script', meshScript !== null);

// Test: hasScript
test('GameObject', 'hasScript() returns true', goTestObj.hasScript('MeshScript'));

// Test: SetActive
goTestObj.SetActive(false);
const hidden = goTestObj.mesh && !goTestObj.mesh.visible;
goTestObj.SetActive(true);
test('GameObject', 'SetActive() toggles visibility', hidden);

// Test: destroy
const toDestroy = VoxelWorld.spawn('test_cube', 20, 65, 20);
toDestroy.Destroy();
test('GameObject', 'Destroy() marks _destroyed', toDestroy._destroyed === true);

// ============================================================
// 6. TRANSFORM - position, rotation, Translate
// ============================================================

const tfObj = VoxelWorld.spawn('test_cube', 0, 65, 0);

// Test: position property
test('Transform', 'position accessible', tfObj.position !== undefined && typeof tfObj.position.x === 'number');

// Test: transform.position
test('Transform', 'transform.position', tfObj.transform.position.equals(tfObj.position));

// Test: Translate
const oldX = tfObj.position.x;
tfObj.transform.Translate(10, 0, 0);
test('Transform', 'Translate() moves object', Math.abs(tfObj.position.x - (oldX + 10)) < 0.1);

// Test: rotation
test('Transform', 'rotation accessible', tfObj.transform.rotation !== undefined);

// Test: Rotate
const oldRotY = tfObj.transform.rotation.y;
tfObj.transform.Rotate(0, 0.5, 0);
test('Transform', 'Rotate() changes rotation', Math.abs(tfObj.transform.rotation.y - (oldRotY + 0.5)) < 0.01);

// Test: scale
test('Transform', 'scale accessible', tfObj.transform.scale !== undefined && tfObj.transform.scale.x === 1);

// ============================================================
// 7. EVENTS - on/off/emit
// ============================================================

let eventData = null;
const unsubscribe = VoxelWorld.on('test:custom', function(data) { eventData = data; });
test('Events', 'on() returns unsubscribe', typeof unsubscribe === 'function');

VoxelWorld.emit('test:custom', { value: 42 });
test('Events', 'emit() triggers listener', eventData && eventData.value === 42);

unsubscribe();
eventData = null;
VoxelWorld.emit('test:custom', { value: 99 });
test('Events', 'off() removes listener', eventData === null);

// Built-in events
let spawnEventFired = false;
VoxelWorld.on('object:spawn', function() { spawnEventFired = true; });
VoxelWorld.spawn('test_cube', 25, 65, 25);
test('Events', 'object:spawn event fires', spawnEventFired);

// ============================================================
// SUMMARY
// ============================================================

const summary = {};
for (const cat in category) {
    summary[cat] = category[cat].passed + '/' + (category[cat].passed + category[cat].failed);
}

const totalPassed = results.filter(r => r.passed).length;
const totalFailed = results.filter(r => !r.passed).length;

return {
    summary,
    total: results.length,
    passed: totalPassed,
    failed: totalFailed,
    failedTests: results.filter(r => !r.passed).map(r => r.category + ': ' + r.name)
};
