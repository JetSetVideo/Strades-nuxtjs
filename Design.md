# Design and Coding Standards

Refer to [README.md](./README.md) and [Structure.md](./Structure.md) for architectural overview and organization principles. This document outlines UI/UX design guidelines, coding standards, and best practices for development.

## Base Design Principles

### UI/UX Foundations
- **Responsive Design**: Ensure adaptability across devices (mobile, tablet, desktop) using CSS Grid, Flexbox, and media queries.
- **Accessibility (a11y)**: Implement WCAG guidelines with semantic HTML5, ARIA attributes, keyboard navigation, and sufficient color contrast.
- **Theme Customization**: Support light/dark modes and internationalization (i18n) via CSS custom properties and Vue i18n.
- **Performance**: Optimize for fast rendering, lazy loading images, and minimal CSS/JS bundles.

### Semantic HTML5 and CSS
- Utilize semantic elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`) for structure.
- Employ modern CSS techniques: CSS Grid for layouts, Flexbox for alignment, CSS custom properties for theming.
- Avoid CSS frameworks; maintain pure CSS for full control and optimization.
- Centralize design tokens (colors, fonts, shadows, spacing) in `assets/css/values.css` for consistency.

## Vue.js Development Guidelines

### Component Composition
- Leverage Vue 3 Composition API for reactive logic in `<script setup>`.
- Use single-file components (SFCs) with scoped styles to prevent style leakage.
- Implement props with TypeScript interfaces for type safety (e.g., `defineProps<{ title: string; }>()`).
- Emit events descriptively (e.g., `emit('update:modelValue', value)`).

### Reactive Programming
- Utilize `ref()`, `reactive()`, and `computed()` for state management within components.
- Prefer composables for shared logic to maintain reactivity and reusability.

### Lifecycle and Performance
- Optimize with `onMounted()`, `onUnmounted()` for side effects.
- Use `v-memo` for conditional rendering and `keep-alive` for component caching.
- Implement virtual scrolling for large lists using libraries like vue-virtual-scroller.

## TypeScript Integration

### Type Safety
- Define interfaces and types for all data structures, props, and API responses.
- Use generics for reusable types (e.g., `ApiResponse<T>`).
- Enable strict mode in `tsconfig.json` for comprehensive type checking.
- Avoid `any`; prefer union types or optional properties.

### Advanced Features
- Implement utility types like `Pick<>` and `Omit<>` for selective interfaces.
- Use mapped types for dynamic object transformations.
- Leverage decorators if using experimental features, but prefer composition over inheritance.


# Colors and fonts management:
The colors and fonts are setted in the settings page, in the "Colors" and "Fonts" sections.
2 types of fonts are used in the application. The Main one is used for all the hardcoded texts in the application. The second font for all the data coming from the data/ directory.
The text color depends on the theme of the application.
The text size depends on the size of the screen used by the user (mobile, tablet, desktop).
The font is bold for the titles and regular for the text.
The colors code by default is green for the positive values and red for the negative values.
The 3rd font Ethnocentric is only used for the name of the application: "Strades".

Create a sense of depth by using shades of background values that increases by a value of 0.1 (oklch) for each layer.
The button inner and outer shadows colors and placement are depending on the state of the button and its position. By default, a button has a lighter color inner shadow and a black outer shadow.
The dark inner shadow is used to give the button a pressed effect after the user clicks on it. While the outer shadow is used to give a raised effect.
The filter buttons have 3 states: off, neutral, on. The off state has a darker inner shadow and a lighter outer shadow. The neutral state has a lighter inner shadow and a lighter outer shadow. The on state has a darker inner shadow and a darker outer shadow.

Glassmorphism is used for the background of the components. A blur effect is used to give the components a transparent effect.
The shadow is used to give the components a raised effect.

The border radius is used to give the components a rounded effect.
The border is used to give the components a border effect.
The border color,width,style,radius is used to give the components a border color,width,style,radius effect.
A ligth source is used to give all the components in a page a light effect.