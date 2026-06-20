# Project Zenith: The Celestial Eye

A production-grade, real-time cosmic radar platform featuring live satellite tracking,
3D globe visualization, planetary ephemeris data, and ISS positioning.

## Architecture

```
project-zenith/
├── apps/
│   ├── web/                    # Next.js 16 Frontend (TypeScript, CesiumJS)
│   ├── satellite-service/      # Node.js 20 / Express / Prisma (SGP4 engine)
│   ├── planetary-service/      # Python 3.12 / FastAPI / SQLAlchemy
│   └── notification-service/   # Go 1.21 / Gin / GORM
├── packages/
│   ├── tsconfig/               # Shared TypeScript configurations
│   ├── eslint-config/          # Shared ESLint rules
│   └── shared-types/           # Shared TypeScript DTOs & interfaces
└── infra/
    ├── docker/                 # Dockerfiles per service
    ├── k8s/                    # Kubernetes manifests & Helm charts
    └── terraform/              # Infrastructure as Code
```

## Quick Start

### Prerequisites
- Node.js >= 20.0.0
- Docker & Docker Compose
- Python 3.12+
- Go 1.21+

### 1. Clone & Install
```bash
git clone https://github.com/your-org/project-zenith.git
cd project-zenith
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Fill in required values (see .env.example for guidance)
```

### 3. Start Infrastructure
```bash
docker-compose up -d
```

### 4. Start All Services
```bash
npm run dev
```

## Services

| Service | Port | Description |
|---|---|---|
| Web (Next.js) | 3000 | Frontend application |
| Satellite Service | 4001 | Node.js REST API + SGP4 engine |
| Planetary Service | 4002 | Python FastAPI + NASA Horizons |
| Notification Service | 4003 | Go WebSocket + Kafka consumer |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & session store |
| Kafka | 9092 | Event streaming |
| MongoDB | 27017 | Analytics database |

## Tech Stack

- **Frontend**: Next.js 16, TypeScript 5.3, CesiumJS, React-Leaflet, Zustand, TanStack Query, Tailwind CSS, Radix UI, Framer Motion
- **Satellite Service**: Node.js 20, Express, Prisma ORM, Zod, satellite.js (SGP4/SDP4)
- **Planetary Service**: Python 3.12, FastAPI, SQLAlchemy, Pydantic, httpx
- **Notification Service**: Go 1.21, Gin, GORM, gorilla/websocket
- **Infrastructure**: PostgreSQL 16, Redis 7, Kafka, MongoDB 7, Docker, Kubernetes

## External Data Sources

- [NASA Horizons API](https://ssd.jpl.nasa.gov/horizons/) — Planetary ephemeris data
- [CelesTrak API](https://celestrak.org/) — Satellite TLE data
- [OpenNotify API](http://api.open-notify.org/) — ISS real-time positioning
- [Cesium Ion](https://cesium.com/ion/) — 3D globe tiles & terrain

## Development

```bash
npm run dev          # Start all services in development mode
npm run build        # Build all packages/apps
npm run lint         # Run ESLint across all packages
npm run type-check   # Run TypeScript type checking
npm run test         # Run all tests
npm run format       # Format code with Prettier
```

## License
MIT
