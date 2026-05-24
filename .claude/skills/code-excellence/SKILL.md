---
name: code-excellence
description: >
  Coding standards, architecture patterns, and implementation workflow.
  Auto-invoked for any implementation task. Covers TypeScript, React,
  API design, testing, and security.
---

# Code Excellence

## Implementation Workflow
1. **Explore** (plan mode): read relevant files, understand existing patterns
2. **Plan**: list files to change, identify edge cases, confirm approach
3. **Implement**: follow existing conventions, reference similar code
4. **Verify**: run tests, lint, typecheck — never skip
5. **Commit**: imperative message, explain WHY not WHAT

## TypeScript
- Strict mode always; `noImplicitAny: true`
- Prefer `type` over `interface` for unions/intersections
- Never use `any`; use `unknown` + type guards
- Explicit return types on public functions
- Use `satisfies` operator for type-safe object literals

## React Patterns
- Functional components only; no class components
- `children` over render props (more readable, composable)
- Explicit variant components over boolean prop explosions
- `use()` over `useContext()` (React 19)
- `ref` as plain prop (React 19, no forwardRef needed)
- Colocate state as close to usage as possible

## API Design
- kebab-case URL paths: `/manga-chapters/{id}`
- camelCase JSON properties
- Paginate all list endpoints; include `cursor` or `page`+`total`
- Version in URL path: `/v1/`, `/v2/`
- Return consistent error shape: `{ error: { code, message, details } }`

## Security (OWASP Top 10 — always apply)
- Validate ALL external input at system boundaries
- Parameterized queries only; never string-concat SQL
- Sanitize before rendering user content (XSS)
- Never log secrets, tokens, or PII
- Use `crypto.randomUUID()` not `Math.random()` for IDs
- Auth checks server-side; never trust client claims

## Testing
- Write the failing test first when fixing a bug
- Test behavior, not implementation
- Avoid mocks for internal logic; mock only at system boundaries
- One assertion concept per test
- Name: `it('returns 404 when manga not found', ...)`

## What NOT to do
- No comments explaining WHAT (code does that)
- No backwards-compat shims for dead code — delete it
- No error handling for impossible scenarios
- No feature flags for simple changes
- No abstraction for < 3 repetitions
- No half-finished implementations

## Verification Commands
Always run before marking done:
```bash
npm run typecheck   # or tsc --noEmit
npm run lint
npm run test -- --run   # vitest or jest
```
