###############################################################################
# Project Zenith — Notification Service Dockerfile (Go 1.21 / Gin)
# Multi-stage: builder → development → runner
###############################################################################

# ─────────────────────────────────────────────
# Builder — compile Go binary
# ─────────────────────────────────────────────
FROM golang:1.21-alpine AS builder

RUN apk add --no-cache gcc musl-dev curl git

WORKDIR /app

# Download modules first (layer caching)
# go.sum may not exist in fresh repos — go mod tidy will generate it
COPY go.mod go.su[m] ./
RUN go mod download && go mod verify

# Copy source and build
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=$(git describe --tags 2>/dev/null || echo 'dev')" \
    -o bin/notification-service \
    ./cmd/server

# ─────────────────────────────────────────────
# Development — live reload with Air
# ─────────────────────────────────────────────
FROM golang:1.21-alpine AS development
RUN apk add --no-cache gcc musl-dev curl git

WORKDIR /app

# Install Air for hot reloading
RUN go install github.com/air-verse/air@latest

COPY go.mod go.su[m] ./
RUN go mod download || true

COPY . .
RUN go mod tidy

EXPOSE 4003
CMD ["air", "-c", ".air.toml"]

# ─────────────────────────────────────────────
# Production runner — distroless / scratch image
# ─────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12 AS runner

WORKDIR /app

# Copy only the compiled binary
COPY --from=builder /app/bin/notification-service .

# Non-root UID
USER 65532:65532

EXPOSE 4003
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/app/notification-service", "-health-check"]

ENTRYPOINT ["/app/notification-service"]
