# Strades

## Development Mode
This project is in development mode. All data is simulated and the application is not officially deployed. The objective is to establish a robust data structure for future database integration. Simulated data resides in the `data/` directory, organized in subdirectories that mirror the anticipated database schema. JSON files contain mock data to facilitate visualization and interaction prototyping within the application.

## Project Description
Strades is an AI-augmented social trading platform enabling users to create, test, share, and deploy personalized investment strategies through community collaboration.

### Core Objectives
- Ingest and unify data from diverse sources into a cohesive user interface.
- Capture and analyze user interaction data for behavioral insights and AI training.
- Provide comprehensive visualization of financial assets, wallet portfolios, strategy performance, messaging, social interactions, and user profiles.

### Key Features
- **Data Visualization**: Unified view of financial assets, wallet data, and strategy evolution.
- **Wallet Management**: Portfolio tracking and capital allocation.
- **Strategy Simulation**: Creation, testing, and visualization of trading strategies.
- **Social Hub**: Community-driven content sharing, discussions, and collaborative strategy improvement.
- **AI Integration**: Personalized AI agents trained on user behavioral data to enhance decision-making and strategy optimization.

### AI and Community Aspects
- AI agents leverage aggregated user profiles to refine strategies and predictions.
- Community-centric design allows users to contribute data (posts, comments, news, events) into a competitive global database ecosystem.

## Development Guidelines
Adhere to industry best practices for all technologies. Utilize Nuxt 4 syntax, standardized naming conventions (e.g., PascalCase for components, camelCase for variables), and comprehensive TypeScript type definitions for enhanced type safety.

### Referenced Documentation
- **[Structure.md](./Structure.md)**: Detailed file organization, factorization principles, and architectural patterns.
- **[Design.md](./Design.md)**: UI/UX guidelines, coding standards, and technology-specific best practices.
- **[CodingAgent.md](./CodingAgent.md)**: Data tracking, ingestion, and AI integration specifications.

## Technical Stack
- **Framework**: Nuxt.js 4 (Server-Side Rendering, static generation capabilities).
- **Runtime**: Node.js 22.x.
- **Language**: TypeScript for type-safe development.
- **Frontend**: Vue.js with Composition API for reactive component logic.
- **State Management**: Pinia for centralized reactive state.
- **Data Visualization**: D3.js for interactive charts and graphs.
- **HTTP Client**: Axios or native Fetch API for server communication.
- **Real-Time Communication**: WebSocket (e.g., via Socket.io) for live data updates.
- **Build Tool**: Vite for fast development and optimized production builds.
- **Code Quality**: ESLint and Prettier for linting and formatting.
- **Testing**: Vitest for unit and integration tests.
- **Hosting**: Vercel for deployment and CDN.
- **Deployment URL**: [https://www.strades.app/](https://www.strades.app/)
