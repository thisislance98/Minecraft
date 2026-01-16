
import { GameState } from './schema/GameState';
import { Schema } from '@colyseus/schema';

console.log('Testing GameState instantiation...');

try {
    const state = new GameState();
    console.log('GameState created successfully');
    console.log('blockChanges type:', state.blockChanges.constructor.name);

    // Test adding a change
    state.addBlockChange(1, 2, 3, 'dirt');
    console.log('Block change added. Count:', state.blockChanges.length);
} catch (error) {
    console.error('Error creating GameState:', error);
}
