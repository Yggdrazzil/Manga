---
name: memory-optimizer
description: >
  Strategies for managing Claude Code context window efficiently.
  Invoke when sessions grow long, when debugging loops, or when
  starting complex multi-file tasks.
---

# Memory & Context Optimization

## Core Constraint
Claude's context window fills fast. Performance degrades as it fills.
~150 usable instruction slots after the system prompt occupies ~50.
CLAUDE.md effectively gets 100–120 slots — prune ruthlessly.

## Session Hygiene Rules

### When to `/clear`
- Between unrelated tasks (always)
- After 2+ failed correction attempts
- When Claude asks questions already answered in CLAUDE.md
- Before starting a new feature from scratch

### When to `/compact`
- Long debugging session still in scope
- `/compact Focus on the auth flow changes and failing tests`
- Preserve critical context explicitly: file paths, test commands, decisions

### Subagent Pattern for Research
Instead of reading dozens of files in main context:
```
Use a subagent to investigate [X]. Report back a summary of:
- Relevant files and their purpose
- Key patterns and conventions
- Any gotchas or non-obvious behaviors
```
The subagent consumes its own context; yours stays clean.

## CLAUDE.md Maintenance
- Prune any line Claude already follows without it
- Convert repetitive reminders → hooks (deterministic, zero cost)
- Test: remove a line, observe if Claude's behavior changes
- Target: 80–120 lines maximum
- Use `@path/to/file` imports for domain docs (loaded on demand)

## Project Memory (~/.claude/projects/)
Claude auto-records observed conventions here. Do NOT duplicate in CLAUDE.md:
- File naming patterns it discovers
- Dependencies it maps
- Conventions inferred from the codebase

## Compaction Customization
Add to CLAUDE.md to persist across compaction:
```
When compacting, always preserve:
- Full list of modified files
- Active test commands
- Current branch and PR link
- Any unresolved decisions
```

## Anti-Patterns
- "Kitchen sink" sessions: mixing unrelated tasks → polluted context
- Infinite exploration: `"investigate everything"` → scope it or use subagents
- Over-specified CLAUDE.md: long files cause Claude to drop rules silently
- Trust-then-verify gap: always provide runnable verification criteria
