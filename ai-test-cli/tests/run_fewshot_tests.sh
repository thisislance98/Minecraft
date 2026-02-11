#!/bin/bash
# Run all few-shot system tests with visual confirmation

echo "🧪 Few-Shot AI System Test Suite"
echo "================================"
echo ""
echo "These tests will:"
echo "  ✅ Generate creatures, items, and structures using AI"
echo "  ✅ Keep the browser open so you can SEE the results"
echo "  ✅ Take screenshots for documentation"
echo "  ✅ Leave entities in the world for manual testing"
echo ""
echo "Make sure:"
echo "  - Server is running (npm run dev in server/ directory)"
echo "  - Client is running (npm run dev in root directory)"
echo "  - You have OPENROUTER_API_KEY set"
echo ""
read -p "Press Enter to start tests (or Ctrl+C to cancel)..."
echo ""

# Create screenshots directory
mkdir -p ai-test-cli/screenshots

# Test 1: Creatures
echo "================================================"
echo "TEST 1: CREATURE GENERATION"
echo "================================================"
echo "This test will create 4 different creatures:"
echo "  🐷 Flying Pig"
echo "  🦋 Glowing Butterfly"
echo "  🐟 Swimming Fish"
echo "  🤖 Hostile Robot"
echo ""
echo "Browser will stay open for 30 seconds to view them."
echo ""
read -p "Press Enter to run creature test..."
node ai-test-cli/tests/test_fewshot_creatures.cjs
echo ""

# Test 2: Items
echo "================================================"
echo "TEST 2: ITEM GENERATION"
echo "================================================"
echo "This test will create 4 different items:"
echo "  🪄 Fire Wand"
echo "  🧪 Healing Potion"
echo "  ✨ Teleport Wand"
echo "  🔨 Build Wand"
echo ""
echo "Browser will stay open for 30 seconds to test them."
echo ""
read -p "Press Enter to run item test..."
node ai-test-cli/tests/test_fewshot_items.cjs
echo ""

# Test 3: Structures
echo "================================================"
echo "TEST 3: STRUCTURE GENERATION"
echo "================================================"
echo "This test will build 4 different structures:"
echo "  🏠 Small House"
echo "  🗼 Tall Tower"
echo "  🌉 Wooden Bridge"
echo "  🔺 Sandstone Pyramid"
echo ""
echo "Browser will stay open for 45 seconds to explore."
echo ""
read -p "Press Enter to run structure test..."
node ai-test-cli/tests/test_fewshot_structures.cjs
echo ""

# Summary
echo "================================================"
echo "✅ ALL TESTS COMPLETED!"
echo "================================================"
echo ""
echo "📁 Screenshots saved to: ai-test-cli/screenshots/"
echo ""
echo "Generated files:"
ls -lh ai-test-cli/screenshots/ | grep fewshot
echo ""
echo "🎮 You can now:"
echo "  - Review the screenshots"
echo "  - Load the game and see the generated content"
echo "  - Test the items and creatures manually"
echo "  - Share screenshots for documentation"
echo ""
