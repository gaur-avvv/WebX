###############################################################################
# Project Zenith — Planetary Service Dockerfile (Python 3.12 / FastAPI)
# Multi-stage: base → development → production
###############################################################################

FROM python:3.12-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Poetry for dependency management
ENV POETRY_VERSION=1.8.2
ENV POETRY_HOME=/opt/poetry
ENV POETRY_VENV=/opt/poetry-venv
ENV POETRY_CACHE_DIR=/opt/.cache

RUN python3 -m venv $POETRY_VENV \
    && $POETRY_VENV/bin/pip install -U pip setuptools \
    && $POETRY_VENV/bin/pip install poetry==${POETRY_VERSION}

ENV PATH="${POETRY_VENV}/bin:${PATH}"

# ─────────────────────────────────────────────
# Development — hot reload with uvicorn
# ─────────────────────────────────────────────
FROM base AS development
ENV APP_ENV=development

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install all deps (including dev)
RUN poetry config virtualenvs.in-project true \
    && poetry install --no-interaction

# Copy application source
COPY . .

EXPOSE 4002
CMD ["poetry", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "4002", "--reload", "--log-level", "info"]

# ─────────────────────────────────────────────
# Builder — install only production deps
# ─────────────────────────────────────────────
FROM base AS builder

COPY pyproject.toml poetry.lock* ./
RUN poetry config virtualenvs.in-project true \
    && poetry install --without dev --no-interaction

COPY . .

# ─────────────────────────────────────────────
# Production runner (minimal image)
# ─────────────────────────────────────────────
FROM python:3.12-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV APP_ENV=production
ENV PATH="/app/.venv/bin:$PATH"

# Non-root user
RUN groupadd --gid 1001 planetary && useradd --uid 1001 --gid 1001 -m planetary

COPY --from=builder --chown=planetary:planetary /app/.venv ./.venv
COPY --from=builder --chown=planetary:planetary /app/src ./src

USER planetary

EXPOSE 4002
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4002/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "4002", "--workers", "2"]
