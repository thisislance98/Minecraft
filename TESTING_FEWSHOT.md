# Testing the Few-Shot AI System

This guide explains how to test the few-shot AI system with **visual confirmation**.

## Prerequisites

1. **Start the server:**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the client:**
   ```bash
   npm run dev
   ```

3. **Set your API key:**
   ```bash
   export OPENROUTER_API_KEY=your_key_here
   ```

## Quick Test (Manual)

1. Open the game at http://localhost:5173
2. Press `M` to open Merlin AI panel
3. Type: `create a flying pig`
4. Watch as the AI:
   - Generates the code
   - Validates it
   - Spawns the creature in front of you
5. You should see a pink pig floating!

## Automated Visual Tests

Run the full test suite:

```bash
./ai-test-cli/tests/run_fewshot_tests.sh
```

This will:
- ✅ Create 4 creatures (pig, butterfly, fish, robot)
- ✅ Create 4 items (wands, potions, tools)
- ✅ Build 4 structures (house, tower, bridge, pyramid)
- ✅ Keep browser open so you can SEE everything
- ✅ Take screenshots for documentation
- ✅ Leave entities in the world for manual testing

### Individual Tests

**Test creatures only:**
```bash
node ai-test-cli/tests/test_fewshot_creatures.cjs
```

**Test items only:**
```bash
node ai-test-cli/tests/test_fewshot_items.cjs
```

**Test structures only:**
```bash
node ai-test-cli/tests/test_fewshot_structures.cjs
```

## What to Check

### For Creatures
- ✅ Creature appears in the world
- ✅ Has correct color/size
- ✅ Animates (walks, flies, swims)
- ✅ AI behavior works (passive/hostile)

### For Items
- ✅ Item appears in inventory (press E)
- ✅ Has custom icon
- ✅ Can be selected and used
- ✅ Visual effects work (particles, projectiles)

### For Structures
- ✅ Blocks are placed correctly
- ✅ At correct ground level
- ✅ Uses appropriate materials
- ✅ Has correct shape/dimensions

## Screenshots

All test runs save screenshots to:
```
ai-test-cli/screenshots/
```

Screenshots include:
- `fewshot_creatures_*.png` - Creature tests
- `fewshot_items_*.png` - Item tests (including inventory)
- `fewshot_structures_*.png` - Structure tests (with aerial views)
- `fewshot_*_error.png` - Error screenshots if tests fail

## Test Scenarios

### Creature Tests
1. **Flying Pig** - Tests floating behavior and custom mesh
2. **Glowing Butterfly** - Tests color changing and particle effects
3. **Swimming Fish** - Tests movement patterns
4. **Hostile Robot** - Tests AI behavior and projectiles

### Item Tests
1. **Fire Wand** - Tests projectile spawning
2. **Healing Potion** - Tests player stat modification
3. **Teleport Wand** - Tests position manipulation
4. **Build Wand** - Tests block placement

### Structure Tests
1. **Simple House** - Tests basic rectangular structures
2. **Tall Tower** - Tests vertical building
3. **Wooden Bridge** - Tests horizontal structures
4. **Pyramid** - Tests complex shapes

## Debugging

If a test fails:

1. **Check the screenshots** - They show what went wrong visually
2. **Check server logs** - Look for AI generation errors
3. **Check browser console** - Look for client-side errors
4. **Check the database** - Verify creature/item was saved:
   ```bash
   # In server directory
   sqlite3 voxel-world.db "SELECT name FROM creatures;"
   sqlite3 voxel-world.db "SELECT name FROM items;"
   ```

## Manual Testing Tips

After running automated tests:

1. **Fly around** (F key) to see all structures
2. **Open inventory** (E key) to test items
3. **Approach creatures** to see their behaviors
4. **Use the wands** by clicking in the world
5. **Check Merlin panel** for any error messages

## Expected Results

After a successful test run, you should see:
- ✅ 4+ new creatures in the world
- ✅ 4+ new items in your inventory
- ✅ 4+ new structures built
- ✅ 12+ screenshots in the screenshots folder
- ✅ No error messages in console
- ✅ Database entries for all generated content

## Troubleshooting

### "Could not confirm creation"
- Check if OpenRouter API key is set
- Check if server is running
- Look at server logs for API errors

### "Test failed with timeout"
- AI might be taking longer than expected
- Increase timeout in test files
- Check OpenRouter service status

### "Creatures/items not visible"
- They may have spawned outside view
- Use fly mode (F) to look around
- Check console for spawning errors

### "Structures not at ground level"
- Check `targetPosition` calculation
- Verify `getGroundLevel()` is working
- Look at structure generation code

## Performance Notes

- Each creature test takes ~8-10 seconds
- Each item test takes ~8-10 seconds
- Each structure test takes ~10-12 seconds
- Full test suite takes ~5-7 minutes
- Browser stays open for visual inspection (adds 1-2 minutes per test)

## Next Steps

After testing:
1. Review screenshots for quality
2. Test edge cases manually
3. Document any issues found
4. Improve prompts for better results
5. Add more example creatures/items/structures
6. Tune validation rules
7. Optimize generation speed
