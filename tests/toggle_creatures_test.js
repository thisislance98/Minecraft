
const GameTest = require('../src/test/GameTest.js');
const assert = require('assert');

class ToggleCreaturesTest extends GameTest {
    async run() {
        await this.start();

        // Wait for game initialization
        await this.waitFor(() => this.game && this.game.player, 5000);

        const game = this.game;

        // Verify initial state
        assert.ok(game.creaturesVisible, "Creatures should be globally visible by default");

        // Spawn specific creatures for testing
        // We'll use Cow and Pig (assuming they exist)
        // We need to use valid Animal classes.

        // Wait for AnimalClasses to be available
        await this.waitFor(() => game.AnimalClasses, 2000);

        const CowClass = game.AnimalClasses['Cow'];
        const PigClass = game.AnimalClasses['Pig'];

        if (!CowClass || !PigClass) {
            console.warn("Cow or Pig class not found, skipping specific class test or choosing alternatives.");
            // Fallback to whatever is available
            const keys = Object.keys(game.AnimalClasses);
            if (keys.length < 2) throw new Error("Not enough animal classes to test toggling");

            var TypeA = keys[0];
            var TypeB = keys[1];
        } else {
            var TypeA = 'Cow';
            var TypeB = 'Pig';
        }

        console.log(`Testing with ${TypeA} and ${TypeB}`);

        // Spawn one of each
        game.spawnManager.spawnEntitiesInFrontOfPlayer(game.AnimalClasses[TypeA], 1);
        game.spawnManager.spawnEntitiesInFrontOfPlayer(game.AnimalClasses[TypeB], 1);

        // Wait for spawn
        await this.waitFor(() => game.animals.some(a => a.constructor.name === TypeA), 2000);
        await this.waitFor(() => game.animals.some(a => a.constructor.name === TypeB), 2000);

        const entityA = game.animals.find(a => a.constructor.name === TypeA);
        const entityB = game.animals.find(a => a.constructor.name === TypeB);

        assert.ok(entityA.mesh.visible, `${TypeA} should be visible initially`);
        assert.ok(entityB.mesh.visible, `${TypeB} should be visible initially`);

        // Toggle TypeA OFF
        // Note: game.toggleAnimalVisibility might not exist yet, this test will fail until implemented
        if (typeof game.toggleAnimalVisibility !== 'function') {
            throw new Error("game.toggleAnimalVisibility is not implemented yet");
        }

        game.toggleAnimalVisibility(TypeA, false);

        assert.strictEqual(entityA.mesh.visible, false, `${TypeA} should be hidden after toggling off`);
        assert.strictEqual(entityB.mesh.visible, true, `${TypeB} should remain visible`);

        // Toggle TypeA ON
        game.toggleAnimalVisibility(TypeA, true);
        assert.strictEqual(entityA.mesh.visible, true, `${TypeA} should be visible after toggling on`);

        // Toggle Global Creatures OFF (should override granular?)
        // Usually global off hides all.
        game.toggleCreatures(false);
        // Note: if TypeA is a Villager, it might be controlled by toggleVillagers.
        // We chose Cow/Pig which likely fall under "creatures".
        // Let's verify category fallback.

        // If TypeA is a generic creature...
        if (TypeA !== 'Villager' && TypeA !== 'Spaceship') {
            assert.strictEqual(entityA.mesh.visible, false, `${TypeA} should be hidden when global creatures are off`);
        }

        // Toggle Global ON
        game.toggleCreatures(true);
        assert.strictEqual(entityA.mesh.visible, true, `${TypeA} should be visible again`);

        console.log("Toggle Creatures Test Passed!");
    }
}

module.exports = ToggleCreaturesTest;
