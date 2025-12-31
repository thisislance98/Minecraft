# AI Instructions for Minecraft Dev

This project has specific workflows for common tasks. ALWAYS check `.agent/workflows/` for detailed guides.

## Common Task Mappings

| User Request | Guide to Read | Action |
| :--- | :--- | :--- |
| "Add a new creature/animal" | `.agent/workflows/create-creature.md` | Follow steps to create `Entity.js` and register it. |
| "Make a new wand/item" | `.agent/workflows/add-item.md` | Create `Item.js` class and register it. |
| "Add a new block" | `.agent/workflows/add-block.md` | Update `Blocks.js`, `AssetManager.js`, `TextureGenerator.js`. |
| "Change physics/gravity" | `.agent/workflows/modify-physics.md` | Edit `Animal.js` (entities) or `PhysicsManager.js`. |

## Key Architecture Notes

-   **Entities**: Logic in `src/game/entities/Animal.js`. Visuals in `createBody()`.
-   **Registration**: Entities in `AnimalRegistry.js`. Items in `ItemRegistry.js`. Blocks in `Blocks.js`.
-   **Textures**: Procedural! Check `src/textures/TextureGenerator.js`. Use `AssetManager.js` to wire them up.
-   **Spawning**: `SpawnManager.js` handles biome logic.

## Do's and Don'ts

-   **DO** register new classes (Animals, Items) or they won't work.
-   **DO** use the `Animal` base class for mobs.
-   **DON'T** hardcode textures; use the procedural generator if possible.
-   **DON'T** modify core physics (`updatePhysics`) unless asked; use subclass overrides if possible.
