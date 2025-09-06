ARG RUST_VERSION=1.82
ARG TARGETPLATFORM
ARG BUILDPLATFORM
FROM --platform=$BUILDPLATFORM rust:${RUST_VERSION}-slim AS builder

WORKDIR /app
ENV CARGO_TERM_COLOR=always

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better layer caching
COPY Cargo.toml ./
COPY Cargo.lock ./

# Pre-fetch dependencies (empty src to maximize cache)
RUN mkdir src && echo "fn main(){}" > src/main.rs && cargo build --release || true

# Now copy real sources
RUN rm -rf src
COPY src/ src/
COPY templates/ templates/

# Build the application (honor target platform for multi-arch)
RUN echo "Building for TARGETPLATFORM=$TARGETPLATFORM" && \
    cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libssl3 \
 && rm -rf /var/lib/apt/lists/* && update-ca-certificates

# Copy the binary and assets
COPY --from=builder /app/target/release/fks_master /usr/local/bin/fks_master
COPY --from=builder /app/templates /app/templates
COPY config/ /app/config/

# Create logs directory
RUN mkdir -p /app/logs && \
    useradd -r -s /bin/false -u 1000 fks_master && \
    chown -R fks_master:fks_master /app/logs

USER fks_master

EXPOSE 3030 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -fsS http://localhost:3030/health || exit 1

CMD ["fks_master", "--host", "0.0.0.0", "--port", "3030"]
