# Manga Project — Claude Instructions

## Context
Manga reader/manager application. Always explore before coding. Use plan mode for multi-file changes.

## Workflow Rules
- EXPLORE → PLAN → IMPLEMENT → VERIFY (never skip steps)
- Run tests after every implementation; never ship unverified code
- Use subagents for codebase investigation to keep main context clean
- `/clear` between unrelated tasks
- Max 2 correction attempts before `/clear` + better prompt

## Context Management
- Keep sessions focused: one workstream per session
- Use `/compact` with explicit instructions when context grows large
- Delegate file-heavy research via subagents
- @.claude/skills/ for domain knowledge — load on demand, not in every session

## Code Style
- TypeScript strict mode; no `any` unless absolutely unavoidable
- ES modules (import/export), never CommonJS require
- Destructure imports: `import { foo } from 'bar'`
- No comments unless the WHY is non-obvious; never explain WHAT

## UI / Frontend
- See @.claude/skills/ui-ux-master/SKILL.md for design system and component patterns
- See @.claude/skills/frontend-aesthetics/SKILL.md for typography, color, animation rules
- Never use Inter, Roboto, Arial, or system-ui as primary typeface
- Animations: CSS-only for HTML; Motion library for React
- Always verify UI changes visually before marking done

## Git
- Branch: feature/* or fix/*
- Commit messages: imperative, ≤72 chars, focus on WHY
- Never force-push main; never --no-verify
