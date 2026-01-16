#!/bin/bash
node ai-test-cli/bin/cli.js test "spawn a villager" --verify-file verification.js > test_result.log 2>&1
