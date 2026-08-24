---
name: naming-tokens
description: >
  Use when naming, structuring, refactoring, or reviewing design tokens —
  primitive, semantic, and component layers — in a design system or theme.
  Produces clear, stable, maintainable token names.
---
# Design Token Naming Convention

## Goal

Design tokens must be organized into 3 explicit layers:

1. `primitives`
2. `semantic`
3. `component`

Every token must belong to exactly one layer.

The token system must optimize for:
- long-term maintainability
- themeability
- alias clarity
- minimal duplication
- stable naming independent of implementation details

## Core rules

### 1) Primitive tokens

Primitive tokens are raw reusable values only.
They must not encode UI meaning, component meaning, or contextual meaning.

Allowed primitive categories:
- color palette
- spacing
- sizing
- radius
- typography foundations
- opacity
- shadows
- z-index
- motion/easing/duration

Primitive token names must describe value families, scales, or measurable characteristics.

Good examples:
- `primitives.color.neutral.0`
- `primitives.color.neutral.950`
- `primitives.color.olive.500`
- `primitives.color.blue.600`
- `primitives.space.4`
- `primitives.space.8`
- `primitives.radius.sm`
- `primitives.font.size.300`
- `primitives.opacity.50`

Bad examples:
- `primitives.color.card`
- `primitives.color.popover`
- `primitives.color.sidebar`
- `primitives.color.primary`
- `primitives.color.foreground`
- `primitives.color.border`
- `primitives.button.height`

Primitive tokens must never contain:
- component names
- state names
- semantic role names
- words like `default`, `primary`, `secondary`, `muted`, `foreground`, `background`, `card`, `popover`, `sidebar`, `button`, `input`, `dialog`

### 2) Semantic tokens

Semantic tokens express usage intent.
They map design meaning to primitives and are the default tokens consumed by product code.

Semantic tokens should describe:
- surface roles
- text roles
- border roles
- focus roles
- status roles
- action roles
- chart/data roles when needed

Good examples:
- `semantic.color.surface.canvas`
- `semantic.color.surface.raised`
- `semantic.color.surface.overlay`
- `semantic.color.text.default`
- `semantic.color.text.muted`
- `semantic.color.text.inverse`
- `semantic.color.border.subtle`
- `semantic.color.border.strong`
- `semantic.color.action.primary`
- `semantic.color.action.primary.text`
- `semantic.color.focus.ring`
- `semantic.color.status.success`
- `semantic.color.status.error`

Bad examples:
- `semantic.color.card` unless `card` is an explicitly accepted domain concept
- `semantic.color.glaucous`
- `semantic.color.sand-dune`
- `semantic.color.shadow-grey`

Semantic tokens should not be named after raw hue or palette values unless the token is intentionally data-viz specific.

### 3) Component tokens

Component tokens are allowed only when a component needs a value that differs from the semantic default or when documenting component anatomy is useful.

Component tokens must reference semantic tokens whenever possible.

Good examples:
- `component.button.primary.bg`
- `component.button.primary.text`
- `component.button.primary.border`
- `component.button.focus.ring`
- `component.input.border.default`
- `component.input.border.focus`
- `component.dialog.surface.bg`
- `component.card.padding.x`
- `component.tooltip.text.default`

Bad examples:
- duplicating semantic tokens as component tokens without need
- putting component tokens under `semantic`
- putting component names under `primitives`

## Alias rules

Token flow should normally be:

`primitive -> semantic -> component`

Preferred:
- semantic tokens alias primitives
- component tokens alias semantic tokens

Avoid:
- component tokens aliasing primitives directly unless there is a strong reason
- semantic tokens aliasing component tokens
- duplicate literal values across layers when an alias would work

## Theme rules

Themes should override semantic intent, not destroy the taxonomy.

Preferred patterns:
- one shared primitives file
- one shared semantic structure
- light and dark theme files override semantic mappings or theme-specific primitive values

Avoid:
- duplicating the entire token tree in every theme
- defining different taxonomies per theme
- mixing semantic and primitive naming just because the source CSS variables were named that way

## Naming rules

### General
- Use lowercase
- Use dot notation for hierarchy
- Use consistent nouns
- Use concise names
- Avoid abbreviations unless standardized
- Avoid implementation-specific names like `gray-200-border` or `button-bg-hover-final`

### Primitive naming
Use one of these patterns:
- `primitives.color.{family}.{step}`
- `primitives.space.{step}`
- `primitives.radius.{size}`
- `primitives.font.size.{step}`
- `primitives.font.weight.{name}`
- `primitives.shadow.{level}`

### Semantic naming
Use role-oriented patterns like:
- `semantic.color.surface.{role}`
- `semantic.color.text.{role}`
- `semantic.color.border.{role}`
- `semantic.color.action.{variant}`
- `semantic.color.action.{variant}.text`
- `semantic.color.focus.{role}`
- `semantic.color.status.{role}`

### Component naming
Use anatomy and state:
- `component.{component}.{slot}.{property}`
- `component.{component}.{variant}.{property}`
- `component.{component}.{variant}.{state}.{property}`

Examples:
- `component.button.primary.hover.bg`
- `component.input.default.border`
- `component.input.focus.ring`
- `component.dialog.header.text`

## Decision rules

When classifying a token, ask these questions in order:

1. Is this a raw measurable value or palette step with no UI meaning?
   - If yes, it is `primitive`.

2. Does this describe a design role used across multiple components?
   - If yes, it is `semantic`.

3. Does this describe a specific component slot, variant, or state?
   - If yes, it is `component`.

If a token name contains a component name, it is almost never primitive.
If a token name contains a usage role like background, foreground, border, muted, primary, accent, or ring, it is almost never primitive.

## Refactor rules

When refactoring an existing token file:
- do not preserve bad names for convenience
- rename tokens to match the taxonomy
- produce a mapping table: `old name -> new name`
- explain ambiguous cases
- preserve aliases wherever possible
- minimize literal duplication
- keep generated output stable if possible

## Output requirements for any agent refactor

The agent must produce:
1. a proposed taxonomy
2. a list of naming violations
3. a migration table from old names to new names
4. refactored token files
5. a short rationale for every non-obvious rename
6. any unresolved ambiguities as explicit questions

## Explicit bans

The following are banned inside `primitives`:
- component names like `button`, `card`, `popover`, `sidebar`, `dialog`, `input`, `tooltip`
- semantic roles like `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `border`, `ring`, `destructive`
- brand-context names unless they are true palette families
- copied CSS variable names without taxonomy review

## Preferred review mindset

Do not treat extracted CSS variables as a correct token architecture.
Extraction is only source discovery.
The agent must reorganize extracted values into a durable design-token system.