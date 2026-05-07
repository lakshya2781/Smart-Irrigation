# AgroFlow — Smart Irrigation System Dashboard

Full-stack web app for monitoring and controlling an ESP32-based smart irrigation system with 4 soil moisture sensors, DHT22, 2 water level sensors, and 4 pumps via 2 L298N motor drivers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/irrigation-dashboard run dev` — run the dashboard (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, Wouter router, Recharts, Tailwind CSS v4, shadcn/ui
- API: Express 5, served at `/api`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → `@workspace/api-client-react` + `@workspace/api-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema files (crops, zones, pumps, sensorReadings, alerts, cropHealth, locationSettings)
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/api-server/src/lib/simulator.ts` — ESP32 simulator (30s sensor ingestion + contextual alerts)
- `artifacts/irrigation-dashboard/src/pages/` — React pages (Overview=Dashboard, Zones, Control, Sensors, AiPanel=WeatherData, Alerts, History, CropsConfig, CropHealth)
- `artifacts/irrigation-dashboard/src/components/layout/` — Sidebar + Layout
- `lib/api-client-react/src/generated/` — auto-generated TanStack Query hooks
- `lib/api-zod/src/generated/` — auto-generated Zod schemas

## Architecture decisions

- **Contract-first API**: All routes defined in OpenAPI spec first; Orval generates typed React Query hooks and Zod validators. After codegen, manually overwrite `lib/api-zod/src/index.ts` to `export * from "./generated/api"` only.
- **Boolean query params**: `zod.coerce.boolean()` treats string `"false"` as `true`. All boolean filters are handled manually in routes (`req.query.x === "true"`).
- **AI irrigation logic**: rain ≥90% → skip all, 50–90% → partial (critical zones only), <50% → full. Per-zone duration calculated from soil water retention capacity.
- **ESP32 ingest endpoint**: `POST /api/esp32/ingest` accepts all 4 moisture readings + DHT22 + tank levels, updates zone moisture, auto-triggers pump decisions unless manual override is set.
- **Dark agricultural theme**: CSS custom properties in `src/index.css` — forest green primary (`142 60% 42%`), dark surfaces (`220 16% 10%`), amber accent (`35 80% 48%`).
- **Simulator**: `startSimulator()` called in `index.ts` after server boot; runs every 30s, uses realistic diurnal temperature drift and natural evapotranspiration moisture decay.

## Product

- **Dashboard** (renamed from Overview) — summary-only: 4 metric cards, zone status, weather snapshot, pump summary, recent alerts feed
- Real-time zone status with per-zone AI recommendations (irrigate/skip/monitor + reasoning + suggested duration)
- **Weather Data** (renamed from AI Engine) — location display with GPS coordinates + Relocate dialog, current conditions, 5-day forecast, rain-based irrigation guide
- **Crop Health** (new page) — NDVI, Soil Health Index, Water Stress, Growth Rate per zone, Radar chart, 30-day trend lines, Predictive Insights, Risk Analysis
- **Sensor Data** — all charts have expand/collapse toggles; added Waterlogging sensor chart (step area chart)
- **Crop & Soil Intelligence** — dropdown-first UX (no data shown before selection), grouped by category (135 crops / 59 soils)
- **Pump Control** — manual override per pump, no System Summary section
- Soil moisture trend chart, temperature & humidity, tank level with critical threshold band
- Alert system: 9 types (tank_empty, low/high_moisture, water_logging, sensor_anomaly, pump_failure, weather_update, crop_health, irrigation_complete)
- Historical irrigation logs, water usage analytics

## User preferences

- Dark agricultural theme throughout (no light mode needed)
- ESP32 hardware: 4 zones, 4 pumps, 2 L298N drivers (CH-A and CH-B per driver)

## Gotchas

- After running codegen, `lib/api-zod/src/index.ts` gets extra exports — overwrite it to just `export * from "./generated/api"`.
- Sensor readings table has two roles: global (zoneId=NULL, has temp/humidity/tank) and per-zone (zoneId set, has moisture). Filter accordingly.
- `zod.coerce.boolean()` issue: always handle boolean query params manually in route handlers.
- The dashboard refreshes data every 15 seconds via `queryClient.invalidateQueries` (plus instant WebSocket invalidation).
- Alert type enum in `lib/db/src/schema/alerts.ts` must include ALL 9 alert types (including weather_update, crop_health, irrigation_complete).
- New DB tables: `cropHealthTable`, `locationSettingsTable` — both pushed to DB.

## Pointers

- See `.local/skills/pnpm-workspace` for workspace structure and TypeScript setup
- See `.local/skills/react-vite` for Vite + React conventions
