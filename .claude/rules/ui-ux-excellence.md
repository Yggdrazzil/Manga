# UI/UX Auto-Routing Rule

**Decision rule:** If ANY part of the task touches how something looks, moves,
or is interacted with — load ui-ux-master and frontend-aesthetics skills
before writing any code.

## NL Routing Table

| User says | Skills to load |
|-----------|---------------|
| "build a page", "create a component" | ui-ux-master + frontend-aesthetics |
| "make it look better", "improve design" | frontend-aesthetics |
| "add animation", "add transition" | frontend-aesthetics |
| "review my UI", "audit design" | ui-ux-master |
| "fix layout", "responsive", "mobile" | ui-ux-master |
| "accessibility", "a11y", "aria" | ui-ux-master |

## Quality Gate
Before marking any UI task done, verify:
- [ ] Passes WCAG 2.1 AA contrast ratios
- [ ] All interactive elements keyboard-accessible
- [ ] Loading, empty, error, and success states handled
- [ ] `prefers-reduced-motion` respected for all animations
- [ ] Tested at 375px and 1440px viewport widths
- [ ] No generic font families used (Inter, Roboto, Arial)
