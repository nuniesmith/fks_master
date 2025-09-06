# FKS Master 🚀

A comprehensive Rust-based service monitoring and control system for the FKS  microservices architecture.

## Features

### 🔍 **Real-time Health Monitoring**
 
- Continuous health checks for all FKS services
- Configurable check intervals and timeout settings
- Multi-tier health status (Healthy, Degraded, Unhealthy, Unknown)
- Response time tracking and latency alerts

### 📊 **Live Dashboard**
 
- Web-based real-time dashboard at `http://localhost:9090`
- WebSocket-powered live updates
- Service status visualization
- System-wide metrics and statistics
- One-click service restart functionality

### 🛠️ **Service & Compose Control**

- Restart & full Docker Compose lifecycle (build, pull, up, start, stop, restart, push, ps, logs)
- RESTful API (`/api/compose`) for lifecycle actions
- WebSocket for real-time feedback
- Docker socket integration

### ⚡ **High Performance**

- Built in Rust for maximum performance and reliability
- Asynchronous architecture with Tokio
- Efficient batch processing of health checks
- Low resource footprint

### 📈 **Prometheus Metrics**

Exposed at `/metrics` (Prometheus text format). Key metrics:

- `fks_service_health_status{service_id,service_name,service_type,critical}` – 0=unknown,1=healthy,2=degraded,3=unhealthy
- `fks_service_response_time_seconds_bucket` / `_sum` / `_count` – Health check latency histogram
- `fks_health_checks_total{service_id,service_name,status}` – Health check attempts (status=success|failure)
- `fks_service_restarts_total{service_id,service_name,success}` – Restart attempts
- `fks_monitor_uptime_seconds_total` – Monitor uptime counter
- `fks_websocket_connections_active` – Active WebSocket sessions
- `fks_service_error_rate{service_id,service_name,service_type}` – Sliding 5‑min error rate (errors/min)
- `fks_compose_actions_total{action,success}` – Docker compose lifecycle invocations
- `fks_compose_unauthorized_total` – Unauthorized compose attempts
- `fks_restart_unauthorized_total` – Unauthorized restart attempts
- `fks_http_requests_total{method,path,status}` – HTTP request counts (note: path label can be high‑cardinality; prefer regex relabeling)
- `fks_http_request_duration_seconds_bucket{method,path}` / `_sum` / `_count` – Request latency histogram
- `fks_compose_action_duration_seconds_bucket{action}` / `_sum` / `_count` – Compose action latency histogram
- `fks_service_restart_duration_seconds_bucket{service_id}` / `_sum` / `_count` – Service restart latency histogram
- `fks_service_cpu_usage_percent{service_id,service_name}` – Service CPU usage (%)
- `fks_service_memory_usage_megabytes{service_id,service_name}` – Service memory usage (MB)
- `fks_service_network_in_bytes{service_id,service_name}` / `fks_service_network_out_bytes{service_id,service_name}` – Cumulative network IO
- `fks_service_block_read_bytes{service_id,service_name}` / `fks_service_block_write_bytes{service_id,service_name}` – Block IO bytes (if available)

Use relabel_configs to drop or aggregate path labels if cardinality becomes high.

## Quick Start

### 1. **Using Docker Compose** (Recommended)

```bash
# Start the monitor service
docker-compose up -d

# View logs
docker-compose logs -f fks_master

# Access dashboard
open http://localhost:9090
```

### 2. **Local Development**

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build and run
cargo build --release
./target/release/fks_master --host 0.0.0.0 --port 9090

# Or run in development mode
cargo run -- --host 127.0.0.1 --port 9090
```

## Configuration

Edit `config/monitor.toml` to customize monitoring settings:

```toml
[monitoring]
check_interval_seconds = 30    # How often to check services
timeout_seconds = 10           # Request timeout
retry_attempts = 3             # Retries before marking unhealthy
batch_size = 5                # Services to check in parallel
enable_docker_stats = true    # Collect per-container CPU/Mem/Net (set false to disable)

[alerts]
enable_notifications = true
high_latency_threshold_ms = 2000
consecutive_failures_threshold = 3
```

### Adding Services
 
### Optional Features

- Detailed health checks (enable cargo feature `detailed_health`):
  cargo build --features detailed_health


Add new services to monitor by extending the `[[services]]` sections:

```toml
[[services]]
id = "your_service"
name = "Your Service Name"
health_endpoint = "http://your_service:8080/health"
service_type = "Api"  # Api, Worker, Database, Auth, etc.
docker_container = "your_service_container"
expected_response_time_ms = 500
critical = true  # Critical services trigger alerts
```

## API Endpoints

### REST API

- `GET /` - Web dashboard
- `GET /health` - Monitor service health
- `GET /health/aggregate` - Aggregated JSON suited for React UI (camelCase fields) returning overallStatus, counts & mapped service statuses
- `GET /api/services` - List all services and their status
- `GET /api/services/:id/health` - Get detailed health for a service
- `POST /api/services/:id/restart` - Restart a service
- `POST /api/compose` - Run a compose action
- `GET /api/metrics` - Get system-wide metrics

### Compose Endpoint

POST `/api/compose`

Body:

```json
{"action":"build","services":["fks_api"],"file":"docker-compose.yml","project":"fks","detach":true}
```

Response:

```json
{"ok":true,"result":{"action":"build","services":["fks_api"],"success":true,"status_code":0,"stdout":"...","stderr":""}}
```

Actions: build, pull, up, start, stop, restart, push, ps, logs (logs supports tail & detach follow)

### Webhook Alerts

Configure `alerts.webhook_url` in `monitor.toml` to receive JSON events: ServiceDown, ServiceUp, HighLatency.

### Optional TLS

Provide `FKS_TLS_CERT` and `FKS_TLS_KEY` (PEM) to enable HTTPS (rustls); falls back to HTTP if load fails.

### API Security (Optional)

Set `FKS_MONITOR_API_KEY` to require `x-api-key` header for mutating endpoints.

Alternatively (or additionally) enable JWT bearer auth:

1. Set `FKS_WS_JWT_SECRET` (shared HMAC secret).
2. (Optional) Set `FKS_WS_JWT_ALLOWED_ROLES` (default: `admin,orchestrate`).
3. Include `Authorization: Bearer <token>` on HTTP requests or `token` field in WebSocket command objects.

Both API key and JWT can coexist: a valid API key OR a valid JWT role token authorizes the request. If neither secret nor API key is configured the system runs in open development mode.

- `POST /api/compose`
- `POST /api/services/:id/restart`

If unset, all endpoints are open (development mode). For production, always set an API key.

### WebSocket JWT Authorization (Optional)

To restrict privileged WebSocket commands (e.g. `restart_service`):

1. Set `FKS_WS_JWT_SECRET` to an HMAC SHA-256 secret.
2. (Optional) Set `FKS_WS_JWT_ALLOWED_ROLES` (comma separated, default: `admin,orchestrate`).
3. Issue JWTs with a `roles` claim (array of role strings). Example payload:

```json
{
  "sub": "user123",
  "exp": 1999999999,
  "roles": ["admin"]
}
```

Clients send the token inside the WebSocket command object (or via HTTP Authorization header for REST actions):

```json
{
  "command_type": "restart_service",
  "service_id": "fks_api",
  "token": "<JWT>"
}
```

If the secret is set and token is missing/invalid or lacks an allowed role, the command is rejected and `fks_restart_unauthorized_total` increments. When no secret is configured, all commands are permitted (development fallback).

Additional commands:

- `subscribe_events` – Apply event filters.
- `clear_subscription` – Remove filters (receive all events again).

### Request Tracing

Include an `X-Request-Id` header on mutating requests (or one will be generated) to correlate logs and metrics. Unauthorized attempts are counted via `fks_compose_unauthorized_total` and `fks_restart_unauthorized_total`.

### Distributed Tracing

Set `FKS_OTEL_ENDPOINT` (OTLP HTTP) to export spans (compose actions, restarts, health checks). Incoming `traceparent` headers are honored to continue traces; spans flush on graceful shutdown (Ctrl+C). Example collector endpoint: `http://otel-collector:4318/v1/traces`.

### WebSocket API

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:9090/ws');

// Receive real-time service updates
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Service update:', data);
};

// Send commands
ws.send(JSON.stringify({
    command_type: 'restart_service',
    service_id: 'fks_api'
}));

// Clear filters (after subscribe_events set them)
ws.send(JSON.stringify({ command_type: 'clear_subscription' }));
```

## Dashboard Features

### 📈 **System Overview**

- Total services count
- Healthy/unhealthy service counts
- Average response times
- Critical services status

### 🎛️ **Service Management**

- Real-time status for each service
- Response time monitoring
- Error message display
- One-click restart buttons
- Service type classification

### 🔄 **Live Updates**

- WebSocket-powered real-time data
- Auto-reconnection on disconnect
- Live timestamp updates
- Connection status indicator

## Integration with FKS Services

The monitor automatically discovers and tracks these FKS services:

- **fks_api** - Main API service (Port 8000)
- **fks_auth** - Authentication service (Port 8001)  
- **fks_data** - Data service (Port 8002)
- **fks_engine** - Trading engine (Port 8003)
- **fks_transformer** - Data transformer (Port 8004)
- **fks_training** - ML training service (Port 8005)
- **fks_worker** - Background worker (Port 8006)
- **fks_web** - Web interface (Port 3000)
- **fks_config** - Configuration service (Port 8007)
- **fks_execution** - Execution service (Port 8008)
- **fks_nginx** - Load balancer (Port 80)

## Docker Integration

The monitor service can control Docker containers when:

1. `/var/run/docker.sock` is mounted to the container
2. Services have `docker_container` configured
3. Docker CLI is available in the container

Example docker-compose integration:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

## Development

### Helper Scripts

Located in `scripts/`:

- `e2e_smoke.sh` – E2E core chain (api→data→engine→execution) health verification via compose API.
- `webhook_receiver.py` – Local test server to observe webhook payloads.
- `generate_self_signed_tls.sh` – Generate self-signed cert/key for TLS.

### Building

```bash
cargo build --release
```

### Testing

```bash
cargo test
cargo clippy --all-targets --all-features
cargo fmt --all -- --check
```

### Adding Features

The codebase is modular:

- `src/main.rs` - HTTP server and routing
- `src/monitor.rs` - Core monitoring logic
- `src/health.rs` - Health checking functionality
- `src/models.rs` - Data structures
- `src/config.rs` - Configuration management
- `src/websocket.rs` - WebSocket handling

## Production Deployment

### Environment Variables

- `RUST_LOG` - Log level (info, debug, warn, error)
- `FKS_MONITOR_CONFIG` - Config file path (default: config/monitor.toml)

### Docker Production

#### Multi-Arch Build (amd64 + arm64)

Build and load locally (uses buildx):

```bash
./scripts/buildx-multiarch.sh fks_master:dev
```

Push to registry:

```bash
./scripts/buildx-multiarch.sh your-registry/fks_master:1.0.0 --push
```

Ensure buildx is enabled (script will create a builder named `fks_builder` if missing). Platforms: linux/amd64, linux/arm64.


```bash
# Build production image
docker build -t fks_master:latest .

# Run with custom config
docker run -d \
  -p 9090:9090 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v ./config:/app/config:ro \
  --name fks_master \
  fks_master:latest
```

### Health Checks

The service includes built-in health checks:

```bash
curl http://localhost:9090/health
```

Returns:
 
```json
{
  "status": "healthy",
  "service": "fks_master", 
  "timestamp": "2025-08-27T..."
}
```

## Monitoring Integration

### Web Interface Integration

The React web interface (`fks_web`) can integrate with the monitor API:

```javascript
// Fetch service status
const response = await fetch('http://fks_master:9090/api/services');
const services = await response.json();

// Restart a service
await fetch('http://fks_master:9090/api/services/fks_api/restart', {
    method: 'POST'
});
```

### Alert Webhooks

Configure webhook notifications for critical alerts:

```toml
[alerts]
webhook_url = "https://hooks.slack.com/your-webhook-url"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ in Rust for the FKS ecosystem
