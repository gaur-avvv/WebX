# Project Zenith: The Celestial Eye

A production-grade, real-time cosmic radar platform featuring live satellite
tracking, 3D globe visualization, planetary ephemeris data, and ISS positioning.

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [External Data Sources](#external-data-sources)
- [Development](#development)
- [Infrastructure](#infrastructure)
- [License](#license)

## Architecture

```
project-zenith/
├── apps/
│   ├── web/                    # Next.js 16 Frontend (TypeScript, CesiumJS)
│   ├── satellite-service/      # Node.js 20 / Express / Prisma (SGP4 engine)
│   ├── planetary-service/      # Python 3.12 / FastAPI / SQLAlchemy
│   └── notification-service/   # Go 1.21 / Gin / Kafka consumer
├── packages/
│   ├── tsconfig/               # Shared TypeScript configurations
│   ├── eslint-config/          # Shared ESLint rules
│   └── shared-types/           # Shared TypeScript DTOs & interfaces
├── infra/
│   ├── docker/                 # Dockerfiles per service + DB init scripts
│   └── observability/          # Prometheus & Grafana configs
├── docker-compose.yml          # Full local dev stack
├── turbo.json                  # Turborepo pipeline config
└── package.json                # Root workspace config (npm workspaces)
```

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose >= 21.0
- Python 3.12+ (for planetary-service, if running locally)
- Go 1.21+ (for notification-service, if running locally)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/project-zenith.git
cd project-zenith
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Fill in required values — see .env.example for guidance on each variable
```

### 3. Start Infrastructure

```bash
# Start just the infrastructure (Postgres, Redis, Kafka, MongoDB, RabbitMQ)
docker-compose up -d postgres redis zookeeper kafka mongodb rabbitmq

# Or start everything including the observability stack
docker-compose --profile observability up -d
```

### 4. Start All Application Services

```bash
npm run dev
```

This uses Turborepo to start all four application services in parallel.

## Services

### Application Services

| Service              | Port | Description                                                       |
| -------------------- | ---- | ----------------------------------------------------------------- |
| Web (Next.js)        | 3000 | Frontend with CesiumJS 3D globe & Leaflet 2D map                  |
| Satellite Service    | 4001 | Node.js REST API, SGP4 propagation, TLE caching, pass predictions |
| Planetary Service    | 4002 | Python FastAPI, NASA Horizons ephemeris data                      |
| Notification Service | 4003 | Go WebSocket API, Kafka consumer for real-time alerts             |

### Infrastructure Services

| Service              | Port  | Description                                                         |
| -------------------- | ----- | ------------------------------------------------------------------- |
| PostgreSQL (primary) | 5432  | Primary relational database                                         |
| PostgreSQL (replica) | 5433  | Read replica for heavy analytical queries                           |
| Redis                | 6379  | Cache, session store, rate limiting                                 |
| Apache Kafka         | 29092 | Event streaming (satellite positions, ISS telemetry, notifications) |
| ZooKeeper            | 2181  | Kafka coordination                                                  |
| MongoDB              | 27017 | Analytics & observation logs                                        |
| RabbitMQ             | 5672  | Task queues (management UI on 15672)                                |

### Observability & Debugging Tools

| Service         | Port | Description                       |
| --------------- | ---- | --------------------------------- |
| Prometheus      | 9090 | Metrics collection                |
| Grafana         | 3001 | Dashboards & visualization        |
| Kafka UI        | 8080 | Topic & consumer group management |
| Redis Commander | 8081 | Redis web UI                      |

> **Note:** Observability and debugging tools start with their respective
> profiles: `docker-compose --profile observability up -d` or
> `docker-compose --profile tools up -d`

## Tech Stack

### Frontend

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5.3
- **React**: 19.0
- **3D Globe**: CesiumJS 1.115
- **2D Map**: Leaflet 1.9 + React-Leaflet 4.2
- **State**: Zustand 4.5
- **Data Fetching**: TanStack Query 5.0
- **Styling**: Tailwind CSS 3.4 + Radix UI primitives
- **Animations**: Framer Motion 11.0
- **Icons**: Lucide React

### Satellite Service (Node.js)

- **Runtime**: Node.js 20
- **Framework**: Express 4.18
- **ORM**: Prisma 5.9 (PostgreSQL)
- **Validation**: Zod 3.25
- **Satellite Propagation**: satellite.js 5.0 (SGP4/SDP4)
- **Messaging**: kafkajs 2.2
- **Cache**: ioredis 5.3 + node-cache 5.1
- **Logging**: pino 8.19
- **Security**: helmet, cors, express-rate-limit

### Planetary Service (Python)

- **Runtime**: Python 3.12
- **Framework**: FastAPI 0.111 + Uvicorn
- **Validation**: Pydantic 2.7
- **ORM**: SQLAlchemy 2.0 (async) + Alembic
- **Database Driver**: asyncpg 0.29
- **Messaging**: aiokafka 0.10
- **Cache**: redis[hiredis] 5.0
- **HTTP Client**: httpx[http2] 0.27
- **Logging**: structlog 24.1
- **Resilience**: tenacity 8.2

### Notification Service (Go)

- **Runtime**: Go 1.21
- **Framework**: Gin 1.9
- **WebSocket**: gorilla/websocket 1.5
- **Kafka**: segmentio/kafka-go 0.4
- **Logging**: uber/zap 1.26
- **Utilities**: google/uuid 1.6

### Infrastructure

- **Containerization**: Docker, Docker Compose
- **Orchestration**: Docker Compose profiles (apps, observability, tools)
- **Package Management**: npm workspaces + Turborepo 2.0
- **CI**: GitHub Actions (`.github/`)
- **Code Quality**: ESLint, Prettier, Commitlint, Husky, lint-staged

## External Data Sources

- [NASA Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) — Planetary
  ephemeris data
- [CelesTrak API](https://celestrak.org/) — Satellite TLE data
- [OpenNotify API](http://api.open-notify.org/) — ISS real-time positioning
- [Cesium Ion](https://cesium.com/ion/) — 3D globe tiles & terrain

## Development

### Common Commands

```bash
# Start all application services in development mode (Turborepo)
npm run dev

# Build all packages & apps
npm run build

# Run linters across the monorepo
npm run lint
npm run lint:fix

# Run TypeScript type checking
npm run type-check

# Run all tests
npm run test
npm run test:ci

# Format code with Prettier
npm run format
npm run format:check

# Clean build artifacts & node_modules
npm run clean

# Database operations (via satellite-service)
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Apply migrations
npm run db:seed         # Seed database
```

### Running a Single Service

```bash
cd apps/web && npm run dev          # Frontend only
cd apps/satellite-service && npm run dev   # Satellite API only
cd apps/planetary-service && poetry run uvicorn src.main:app --reload
cd apps/notification-service && go run cmd/main.go
```

### Docker Profiles

The `docker-compose.yml` uses profiles to group services:

```bash
# Infrastructure only (default)
docker-compose up -d

# Include application services
docker-compose --profile apps up -d

# Include observability (Prometheus, Grafana)
docker-compose --profile observability up -d

# Include debugging tools (Kafka UI, Redis Commander)
docker-compose --profile tools up -d

# Everything at once
docker-compose --profile apps --profile observability --profile tools up -d
```

## Project Structure Details

### Satellite Service Data Model

The satellite service uses Prisma with PostgreSQL. Key models include:

- **User** — accounts with roles (GUEST, OBSERVER, ADMIN)
- **ObserverLocation** — geographic coordinates for ground stations
- **Satellite** — metadata (NORAD ID, name, category)
- **TLE** — two-line element sets with epoch tracking
- **PredictedPass** — upcoming satellite passes for an observer
- **ObservationLog** — recorded observations

Supports read replicas for heavy analytical queries and full-text search.

### Kafka Topics

| Topic                        | Partitions | Purpose                         |
| ---------------------------- | ---------- | ------------------------------- |
| `zenith.iss.position`        | 3          | Real-time ISS telemetry         |
| `zenith.satellite.positions` | 6          | Bulk satellite position updates |
| `zenith.satellite.passes`    | 3          | Predicted pass notifications    |
| `zenith.planetary.ephemeris` | 3          | Ephemeris data refresh events   |
| `zenith.tle.refresh`         | 1          | TLE data refresh triggers       |
| `zenith.notifications`       | 3          | User-facing alert dispatch      |

## License

MIT
