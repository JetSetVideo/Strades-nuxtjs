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
- Centralize design tokens (colors, fonts, spacing) in `assets/css/values.css` for consistency.

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

## Data Simulation and Prototyping

### Mock Data Handling
- Simulate data exclusively in `data/` directory JSON files to mirror future database schema.
- Structure mock data hierarchically (e.g., `data/strategies/`, `data/wallet/`) for easy migration.
- Use TypeScript interfaces to type mock data, ensuring consistency with real data models.

### Development Workflow
- Load mock data via composables or stores during development (e.g., `useStrategies()` fetching from JSON).
- Implement conditional logic to switch between mock and real data sources in production.
- Validate mock data against schemas to prevent inconsistencies.

## Code Quality and Tools

### Linting and Formatting
- Configure ESLint with Vue and TypeScript rules for code quality.
- Use Prettier for consistent formatting, integrated with ESLint.

### Testing
- Write unit tests with Vitest for composables, stores, and utilities.
- Use Vue Test Utils for component testing, focusing on props, events, and DOM interactions.
- Implement integration tests for page-level functionality.

### Build and Deployment
- Utilize Vite for fast builds and hot module replacement (HMR).
- Optimize bundles with code splitting and tree shaking.
- Deploy via Vercel with static generation for public pages and SSR for dynamic content.