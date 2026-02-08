# AI Test CLI - Comprehensive Testing Guide

A command-line testing framework for the voxel game engine with Merlin AI integration. Provides browser automation, AI testing, multiplayer simulation, SDK testing, and game interaction capabilities.

## Table of Contents
- [Installation & Setup](#installation--setup)
- [Testing the Merlin AI System](#testing-the-merlin-ai-system)
- [Testing Multiplayer Functionality](#testing-multiplayer-functionality)
- [Entity Spawning & Interaction](#entity-spawning--interaction)
- [SDK Testing](#sdk-testing)
- [World Management](#world-management)
- [Interactive Game Console](#interactive-game-console)
- [Browser Automation](#browser-automation)
- [RAG & Knowledge Testing](#rag--knowledge-testing)
- [Performance & Debugging](#performance--debugging)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

---

## Installation & Setup

```bash
cd ai-test-cli
npm install
npm link  # Makes 'ai-test' available globally
```

**Environment Variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `CLI_SECRET` | `asdf123` | Authentication secret for API |
| `API_URL` | `http://127.0.0.1:2567` | Server URL |

**Prerequisites:**
- Server must be running: `./start.sh`
- Port 2567 (main server) and 3000 (frontend) must be available

---

## Testing the Merlin AI System

### Quick Verification Test
Run a full end-to-end test that validates the intro sequence, wolf spawning, and pyramid building:

```bash
ai-test merlin verify [--headless]
```

### Interactive Chat with Merlin
For real-time testing and experimentation:

```bash
# Browser-based chat (opens game with Merlin panel)
ai-test merlin chat [--headless]

# Terminal-based chat via WebSocket
ai-test merlin-chat [--provider gemini|openrouter|claude] [--world <id>]

# Send a single prompt and get response
ai-test merlin-prompt "spawn a dragon" [--json] [--timeout 60000]
```

### Send AI Prompts
Test specific AI capabilities:

```bash
# Basic prompt
ai-test "spawn a wolf near me"

# With position and options
ai-test "create a glass pyramid" \
  --wait-for spawn_creature \
  --timeout 30000 \
  --pos 0,64,0

# Interactive terminal session
ai-test interactive
```

### Testing Specific AI Tools
Test individual AI tools directly:

```bash
ai-test tool spawn_creature '{"creature":"Wolf","count":2}' --timeout 10000
ai-test tool build_structure '{"shape":"pyramid","material":"glass","size":5}'
```

---

## Testing Multiplayer Functionality

### Launch Multiple Browsers
Simulate multiple players:

```bash
# Launch 2 browser instances
ai-test multi --count 2 [--headless]
```

### Test Creature Synchronization
Verify that spawned creatures appear correctly across all clients:

```bash
ai-test test-creature-sync \
  --description "a small hopping blue cube" \
  --name HoppingCube \
  [--headless]
```

### Test Chat Synchronization
Verify chat messages sync between players:

```bash
ai-test test-chat-sync [--headless]
```

### Workflow Example
```bash
# Terminal 1: Start server
./start.sh

# Terminal 2: Launch player 1
ai-test browser

# Terminal 3: Launch player 2
ai-test browser

# Terminal 4: Run sync test
ai-test test-creature-sync --description "red cube" --name RedCube
```

---

## Entity Spawning & Interaction

### Method 1: Via AI Prompt
```bash
# Simple spawn
ai-test "spawn 5 wolves near me" --headless

# With verification
ai-test test "spawn 3 elephants" \
  --tool spawn_creature \
  --creature Elephant \
  --verify-count Elephant:3 \
  --timeout 60000
```

### Method 2: Via Console
```bash
ai-test console
# Then use these commands:
> spawn Wolf              # Spawn creature
> entities                # List all entities
> diagnose Wolf           # Check for physics issues
> watch Wolf 5000         # Monitor entity for 5 seconds
```

### Method 3: Direct Browser Execution
```bash
# Start persistent browser
ai-test browser

# In another terminal, execute code
ai-test exec "VoxelWorld.spawn('Wolf', 0, 70, 0)"
ai-test exec "game.animals.length"  # Check count
```

### Verification Options
```bash
ai-test test "spawn flying creature" \
  --verify-count Dragon:1 \
  --verify-flying \
  --scale 2.0 \
  --property color:#ff0000 \
  --verify-types Wolf,Dog,Cat \
  --verify-item sword \
  --timeout 60000
```

---

## SDK Testing

### Run SDK Code in Browser
```bash
# Single command
ai-test drive "VoxelWorld.spawn('sphere')" [--headless]

# From file
ai-test drive -f sdk-full-test.js

# Interactive REPL
ai-test drive -i

# Connect to existing browser
ai-test drive -c "VoxelWorld.getEntities()"
```

### Available SDK Objects
In `drive` and `exec` contexts:
- `VoxelWorld` - Main SDK API
- `game` - `__VOXEL_GAME__` instance
- `player` - Local player
- `THREE` - Three.js library
- `detect()` - Raycast detection
- `detectAround(radius)` - Find nearby objects

### Test Files Available
```bash
# Full SDK test suite
ai-test drive -f sdk-full-test.js

# Advanced features
ai-test drive -f sdk-advanced-test.js

# Simple spawn tests
ai-test drive -f spawn-pig.js
ai-test drive -f test-dog-spawn.js
```

---

## World Management

### Create Worlds
```bash
ai-test world create \
  --name "Test World" \
  --description "For testing" \
  --visibility public \
  --seed 12345 \
  --sky-color #87CEEB \
  --gravity 1.5
```

### List & Explore
```bash
ai-test world list [--mine] [--limit 20]
ai-test world info <worldId>
```

### Load World in Browser
```bash
ai-test world load <worldId> [--headless] [--console]
```

### Update & Delete
```bash
ai-test world update <worldId> --name "New Name" --visibility private
ai-test world delete <worldId> [--force]
```

---

## Interactive Game Console

Launch a full interactive console for debugging:

```bash
ai-test console [--headless] [-q]
```

### Console Commands

| Category | Command | Description |
|----------|---------|-------------|
| **Info** | `help` | Show all commands |
| | `state` | Game state summary |
| | `pos` | Player position |
| **Player** | `tp <x> <y> <z>` | Teleport player |
| | `health` | Show player health |
| | `damage <amount>` | Deal damage to player |
| **Inventory** | `inventory` | Show inventory |
| | `give <item>` | Give item to player |
| | `select <0-8>` | Select hotbar slot |
| | `use` | Use selected item |
| | `held` | Show held item |
| **Entities** | `entities` | Entity counts |
| | `spawn <type>` | Spawn creature |
| | `creatures` | List available creatures |
| | `diagnose [type]` | Check entity issues |
| | `watch <name> [ms]` | Monitor entity |
| **World** | `setblock <x y z type>` | Place block |
| | `break [x y z]` | Break block |
| **Multiplayer** | `players` | Show remote players |
| **Items** | `items` | List registered items |
| | `iteminfo <id>` | Get item info |
| | `testitem <id>` | Test item |
| **AI** | `prompt <text>` | Send AI prompt |
| **Utility** | `screenshot [file]` | Take screenshot |
| | `click <params>` | Simulate click |
| | `key <key>` | Press key |
| | `exit` | Close and exit |

---

## Browser Automation

### Persistent Browser Session
Keep a browser running for rapid testing:

```bash
# Start persistent browser (stays open)
ai-test browser [--headless]

# Execute code in running browser
ai-test exec "VoxelWorld.spawn('slime')"
ai-test exec --file my-script.js
ai-test exec --interactive  # Start REPL
```

### Available Game Commands (via code)
```javascript
// Player
getPlayerPosition()
teleportPlayer(x, y, z)
getPlayerHealth()
takeDamage(amount)

// Inventory
getInventory()
giveItem(itemId, count)
selectSlot(index)
useSelectedItem()
getHeldItem()

// Entities
getEntities()
spawnCreature(type, x, y, z)
countCreatures()
diagnoseEntities(type)
watchEntity(name, duration)

// World
setBlock(x, y, z, type)
breakBlock(x, y, z)
getDrops()
getGameState()

// Interaction
leftClick()
rightClick()
pressKey(key)
sendChatMessage(msg)

// Waiting
waitFor(condition, timeout)
```

---

## RAG & Knowledge Testing

Test the AI's retrieval-augmented generation system:

```bash
# Test template lookup
ai-test rag "how do I spawn creatures?" [--json] [--no-semantic]

# Test task classification
ai-test rag-classify "create a red cube" [--json]

# Batch classification
ai-test rag-classify "prompt1,prompt2,prompt3" --batch

# Full RAG lookup
ai-test rag-lookup "build a house" [--json]

# E2E knowledge verification
ai-test verify-knowledge "spawn a flying dragon" \
  [--timeout 60000] \
  [--headless]
```

---

## Performance & Debugging

### Performance Profiling
```bash
ai-test profile \
  --duration 15 \
  --samples 60 \
  [--headless]
```

### Material Audit
```bash
ai-test audit [--headless]
```

### Game State Snapshot
```bash
ai-test game-state
```

### Utility Commands
```bash
# Restart server
ai-test restart

# Clean up test artifacts
ai-test cleanup [--dry-run] [--keep-golden] [--all]
```

---

## Advanced Usage

### Custom Verification Code
```bash
# From file
ai-test test "build pyramid" --verify-file verify.js

# Inline verification
ai-test test "spawn wolf" --verify-code "() => {
  const game = window.__VOXEL_GAME__;
  const wolves = game.animals.filter(a => a.constructor.name === 'Wolf');
  return { success: wolves.length > 0, message: wolves.length + ' wolves' };
}"
```

### Test File Format (JSON)
Create reusable test definitions:

```json
{
  "name": "Wolf Spawn Test",
  "prompt": "spawn a wolf",
  "expectedTool": "spawn_creature",
  "expectedArgs": { "creature": "Wolf" },
  "headless": true,
  "timeout": 60000,
  "toolWait": 15000,
  "verify": [
    {
      "type": "entityExists",
      "creature": "Wolf",
      "minCount": 1
    },
    {
      "type": "entityHasProperty",
      "creature": "Wolf",
      "property": "scale",
      "value": 2.0
    },
    {
      "type": "customCode",
      "code": "() => { /* verification logic */ }"
    }
  ]
}
```

### AI Event Streaming
Listen to real-time AI events:

```javascript
const client = new AntigravityClient();
client.on('thought', (data) => console.log('Thinking:', data));
client.on('tool_start', (data) => console.log('Tool:', data.tool));
client.on('tool_end', (data) => console.log('Result:', data.result));
client.on('token_usage', (data) => console.log('Tokens:', data));
client.on('rag_lookup', (data) => console.log('RAG:', data));
```

---

## Troubleshooting

### "Server not available"
```bash
# Ensure server is running
./start.sh

# Check if port is in use
lsof -i :2567
```

### "Game not ready"
- Increase timeout: `--timeout 60000`
- Check browser console for errors
- Try headed mode to see what's happening

### "Creature not found"
```bash
# List available creatures
ai-test console
> creatures
```
- Check case sensitivity (e.g., `Wolf` not `wolf`)

### Test timeouts
- AI operations can be slow; use `--timeout 60000` or higher
- Check server logs for errors

### Browser won't connect
```bash
# Clear browser state
rm /tmp/ai-test-browser.json

# Restart browser session
ai-test browser
```

### Entity physics issues
```bash
ai-test console
> diagnose Wolf    # Check for physics problems
> watch Wolf 5000  # Monitor entity movement
```

---

## Quick Reference

### Common Test Workflows

| Task | Command |
|------|---------|
| Quick AI test | `ai-test "spawn a wolf"` |
| Full Merlin verification | `ai-test merlin verify` |
| Interactive debugging | `ai-test console` |
| Multiplayer test | `ai-test multi --count 2` |
| SDK testing | `ai-test drive -i` |
| Chat with AI | `ai-test merlin-chat` |
| Performance check | `ai-test profile` |

### Flags Quick Reference

| Flag | Description |
|------|-------------|
| `--headless` | Run without visible browser |
| `--timeout <ms>` | Set operation timeout |
| `--json` | Output as JSON |
| `--persist` | Keep browser open after test |
| `-q` | Quiet mode |
| `-f <file>` | Run from file |
| `-i` | Interactive mode |

---

## Tips & Best Practices

1. **Use headed mode for debugging** - Remove `--headless` to see what's happening
2. **Increase timeouts for AI tasks** - Use `--timeout 60000` or more for complex prompts
3. **Use `diagnose` for entity issues** - Helps identify physics and rendering problems
4. **Clean up regularly** - `ai-test cleanup` removes test artifacts
5. **Use persistent browser** - `ai-test browser` + `ai-test exec` for rapid iteration
6. **Check server logs** - AI tool calls and errors appear in the server console
7. **Use `--json` for automation** - Many commands support JSON output for scripting
