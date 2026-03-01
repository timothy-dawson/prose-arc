# =============================================================================
# Prose Arc Backend — Multi-stage Dockerfile
# Stage 1 (builder): install Python deps into a venv
# Stage 2 (development): full source mount for hot-reload
# Stage 3 (production): slim runtime image
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: builder — install dependencies
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build tools for packages with C extensions (bcrypt, asyncpg, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy only dependency files first (layer cache optimization)
COPY pyproject.toml ./

# Install production deps (no dev extras)
RUN pip install --upgrade pip && \
    pip install -e ".[dev]"


# ---------------------------------------------------------------------------
# Stage 2: development — mounts src for hot-reload, includes dev deps
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS development

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Source is volume-mounted at runtime — no COPY needed here
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ---------------------------------------------------------------------------
# Stage 3: production — slim, no dev tools, source baked in
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Bake source into image for production
COPY . .

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
