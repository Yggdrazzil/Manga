---
name: fix-issue
description: Fix a GitHub issue end-to-end with tests and PR
disable-model-invocation: true
---

Fix GitHub issue: $ARGUMENTS

1. Read the issue: `gh issue view $ARGUMENTS`
2. Explore relevant files in plan mode
3. Write a failing test that reproduces the issue
4. Implement the fix — follow existing patterns
5. Verify: tests pass, lint clean, typecheck clean
6. Commit with message referencing the issue: `fix: ... (closes #$ARGUMENTS)`
7. Push and open a PR
