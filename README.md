# AgroFlow — Smart Irrigation System Dashboard

AgroFlow is a comprehensive full-stack web application designed for monitoring and controlling an ESP32-based smart irrigation system. It supports 4 soil moisture sensors, a DHT22 sensor, 2 water level sensors, and 4 pumps via 2 L298N motor drivers.

## Tech Stack

- **Monorepo Management**: [pnpm workspaces](https://pnpm.io/workspaces)
- **Runtime**: [Node.js](https://nodejs.org/) (v24 recommended)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/), [TanStack Query](https://tanstack.com/query/latest), [Wouter](https://github.com/molefrog/wouter), [Recharts](https://recharts.org/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **API Server**: [Express 5](https://expressjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/)
- **Validation**: [Zod](https://zod.dev/)
- **API Codegen**: [Orval](https://orval.dev/) (from OpenAPI spec)
- **Build Tool**: [esbuild](https://esbuild.github.io/)

## Project Structure

- `artifacts/api-server/`: Express API server source and build configuration.
- `artifacts/irrigation-dashboard/`: React frontend dashboard.
- `lib/api-client-react/`: Auto-generated TanStack Query hooks.
- `lib/api-spec/`: OpenAPI specification and codegen configuration.
- `lib/api-zod/`: Auto-generated Zod schemas.
- `lib/db/`: Database schema definitions and Drizzle configuration.
- `scripts/`: Workspace-level scripts.

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io/installation) installed globally.
- [Node.js](https://nodejs.org/) (v24 recommended).
- A running [PostgreSQL](https://www.postgresql.org/) instance.

### Environment Setup

Create a `.env` file in the root directory (or ensure these variables are set in your environment):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SESSION_SECRET=your_secret_here
```

### Installation

```bash
pnpm install
```

### Running the Application

To run the project in development mode:

1. **Push Database Schema**:
   ```bash
   pnpm --filter @workspace/db run push
   ```

2. **Start API Server**:
   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

3. **Start Dashboard**:
   ```bash
   pnpm --filter @workspace/irrigation-dashboard run dev
   ```

## Development Commands

- `pnpm run build`: Typecheck and build all packages.
- `pnpm run typecheck`: Run type checking across the entire workspace.
- `pnpm --filter @workspace/api-spec run codegen`: Regenerate API hooks and Zod schemas from the OpenAPI spec.
- `pnpm --filter @workspace/db run push`: Push database schema changes (development only).

## Architecture & Decisions

- **Contract-first API**: The `lib/api-spec/openapi.yaml` is the single source of truth for API contracts. Orval generates typed hooks and validators.
- **AI Irrigation Logic**: Irrigation decisions are based on weather forecasts (rain probability) and per-zone soil water retention capacity.
- **ESP32 Ingestion**: A dedicated endpoint `POST /api/esp32/ingest` handles sensor data from the hardware.
- **Simulator**: An ESP32 simulator is included in the API server to provide realistic data for development without physical hardware.

## License

MIT
