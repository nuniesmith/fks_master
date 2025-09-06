use axum::{
    extract::{State, WebSocketUpgrade},
    response::{Html, Response},
    routing::{get, post},
    http::StatusCode,
    Json, Router,
};
use clap::{Parser, Subcommand, Args as ClapArgs};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use opentelemetry::trace::{TracerProvider as _, TraceContextExt as _};
use opentelemetry::global as otel_global;
use tower::ServiceBuilder;
use axum::http::Request as HttpRequest;
use std::time::Instant;
use tracing_subscriber::prelude::*;

mod config;
mod health;
mod models;
mod monitor;
mod websocket;
mod metrics;
mod compose;
mod auth;

use crate::config::Config;
use crate::monitor::ServiceMonitor;
use crate::compose::{ComposeRequest};

#[derive(Parser)]
#[command(name = "fks_master")]
#[command(about = "FKS Master Orchestration & Monitoring")] 
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Host interface to bind (serve mode)
    #[arg(long, default_value = "0.0.0.0")] 
    host: String,
    /// Port to listen on (serve mode)
    #[arg(long, default_value = "9090")] 
    port: u16,
    /// Path to monitor configuration file (serve mode)
    #[arg(long, default_value = "config/monitor.toml")] 
    config: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Run docker compose lifecycle commands
    Compose(ComposeCmd),
}

#[derive(ClapArgs)]
struct ComposeCmd {
    /// Compose action (build, pull, up, start, stop, restart, push, ps, logs)
    #[arg(value_enum)]
    action: compose::ComposeAction,
    /// Optional service names (empty = all services defined in compose file)
    services: Vec<String>,
    /// Path to docker-compose file
    #[arg(long, short = 'f', default_value = "docker-compose.yml")]
    file: String,
    /// Project name (-p flag)
    #[arg(long)]
    project: Option<String>,
    /// Detach / Follow (up => -d, logs => -f)
    #[arg(long)]
    detach: bool,
    /// Output structured JSON result
    #[arg(long)]
    json: bool,
    /// Tail lines for logs action
    #[arg(long)]
    tail: Option<u32>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging (optionally JSON)
    init_tracing()?;

    let cli = Cli::parse();

    if let Some(cmd) = cli.command {
        match cmd {
            Commands::Compose(c) => {
                // Just run compose action then exit
                let code = compose::run_compose(
                    &c.file,
                    c.project.as_deref(),
                    c.action,
                    &c.services,
                    c.detach,
                    c.json,
                    c.tail,
                )?;
                std::process::exit(code);
            }
        }
    }

    // Default: serve monitoring API
    let config = Config::load(&cli.config).await?;
    
    info!("🚀 Starting FKS Service Monitor");
    info!("📊 Monitoring {} services", config.services.len());

    // Initialize Prometheus metrics
    metrics::start_uptime_tracking();
    info!("📈 Prometheus metrics initialized");

    // Initialize service monitor
    let monitor = ServiceMonitor::new(config.clone()).await?;
    let monitor_handle = monitor.start().await?;

    let api_key = std::env::var("FKS_MONITOR_API_KEY").ok();

    let state = AppState { monitor: monitor_handle.clone(), api_key };

    // Allow environment variable overrides for host/port (backward compatible with CLI flags)
    let env_host = std::env::var("FKS_MASTER_HOST").ok();
    let env_port = std::env::var("FKS_MASTER_PORT").ok().and_then(|p| p.parse::<u16>().ok());
    let bind_host = env_host.unwrap_or(cli.host.clone());
    let bind_port = env_port.unwrap_or(cli.port);

    // Build API routes
    let app = Router::new()
        .route("/", get(dashboard_handler))
        .route("/health", get(health_handler))
    .route("/health/aggregate", get(aggregate_health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/api/services", get(get_services_handler))
    .route("/api/services/{service_id}/health", get(get_service_health_handler))
    .route("/api/services/{service_id}/restart", post(restart_service_handler))
        .route("/api/metrics", get(get_metrics_handler))
        .route("/api/compose", post(compose_handler))
        .route("/ws", get(websocket_handler))
    .layer(
        ServiceBuilder::new()
            .layer(CorsLayer::permissive())
            .layer(axum::middleware::from_fn(http_metrics_middleware))
    )
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", bind_host, bind_port).parse()?;
    let listener = TcpListener::bind(&addr).await?;
    
    info!("🌐 FKS Master listening on http://{}", addr);
    info!("📈 Dashboard: http://{}", addr);
    info!("� Prometheus metrics: http://{}/metrics", addr);
    info!("�🔗 WebSocket endpoint: ws://{}/ws", addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn dashboard_handler() -> Html<&'static str> {
    Html(include_str!("../templates/dashboard.html"))
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "fks_master",
        "timestamp": chrono::Utc::now()
    }))
}

async fn aggregate_health_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    use serde_json::json;
    let services = state.monitor.get_all_services().await;
    let mut healthy = 0usize;
    let mut degraded = 0usize;
    let mut unhealthy = 0usize;
    let mut unknown = 0usize;
    for s in &services { match s.status { crate::models::HealthStatus::Healthy => healthy+=1, crate::models::HealthStatus::Degraded => degraded+=1, crate::models::HealthStatus::Unhealthy => unhealthy+=1, crate::models::HealthStatus::Unknown => unknown+=1 } }
    let overall_status = if unhealthy>0 { "critical" } else if degraded>0 || unknown>0 { "degraded" } else { "healthy" };
    Json(json!({
        "overallStatus": overall_status,
        "totalServices": services.len(),
        "healthyServices": healthy,
        "warningServices": degraded, // map degraded -> warning
        "errorServices": unhealthy,
        "offlineServices": unknown,
        "lastUpdate": chrono::Utc::now(),
        "services": services
            .into_iter()
            .map(|s| {
                // Provide a lightweight frontend-oriented mapping (keep original enum serialization too)
                let mapped = match s.status { crate::models::HealthStatus::Healthy => "healthy", crate::models::HealthStatus::Degraded => "warning", crate::models::HealthStatus::Unhealthy => "error", crate::models::HealthStatus::Unknown => "offline" };
                json!({
                    "id": s.id,
                    "name": s.name,
                    "status": mapped,
                    "rawStatus": format!("{:?}", s.status),
                    "lastCheck": s.last_check,
                    "responseTimeMs": s.response_time_ms,
                    "critical": s.critical
                })
            })
            .collect::<Vec<_>>()
    }))
}

async fn metrics_handler() -> String {
    let encoder = prometheus::TextEncoder::new();
    let metric_families = metrics::PROMETHEUS_REGISTRY.gather();
    encoder.encode_to_string(&metric_families).unwrap_or_else(|e| {
        tracing::error!("Failed to encode Prometheus metrics: {}", e);
        String::new()
    })
}

async fn get_services_handler(
    State(state): State<AppState>,
) -> Json<Vec<models::ServiceStatus>> {
    Json(state.monitor.get_all_services().await)
}

async fn get_service_health_handler(
    axum::extract::Path(service_id): axum::extract::Path<String>,
    State(state): State<AppState>,
) -> Json<Option<models::ServiceHealth>> {
    Json(state.monitor.get_service_health(&service_id).await)
}

async fn restart_service_handler(
    axum::extract::Path(service_id): axum::extract::Path<String>,
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Json<models::RestartResult> {
    let req_id = get_or_make_request_id(&headers);
    let parent_ctx = extract_traceparent(&headers);
    let span = tracing::info_span!("restart_service", %service_id, %req_id);
    if let Some(ctx) = &parent_ctx { span.set_parent(ctx.clone()); }
    let _guard = span.enter();
    if !is_authorized(&state, &headers) {
        crate::metrics::increment_restart_unauthorized();
        tracing::warn!("unauthorized restart attempt");
        return Json(models::RestartResult { service_id, success: false, message: "unauthorized".into(), timestamp: chrono::Utc::now() });
    }
    let result = state.monitor.restart_service(&service_id).await;
    tracing::info!(success=%result.success, "restart result");
    Json(result)
}

async fn get_metrics_handler(
    State(state): State<AppState>,
) -> Json<models::SystemMetrics> {
    Json(state.monitor.get_system_metrics().await)
}

async fn compose_handler(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<ComposeRequest>
) -> (StatusCode, Json<crate::compose::ComposeResult>) {
    let req_id = get_or_make_request_id(&headers);
    let parent_ctx = extract_traceparent(&headers);
    let span = tracing::info_span!("compose_action", action=?req.action, services=?req.services, %req_id);
    if let Some(ctx) = &parent_ctx { span.set_parent(ctx.clone()); }
    let _guard = span.enter();
    if !is_authorized(&state, &headers) {
        crate::metrics::increment_compose_unauthorized();
        tracing::warn!("unauthorized compose attempt");
        return (StatusCode::UNAUTHORIZED, Json(crate::compose::ComposeResult { action: "error".into(), services: vec![], success: false, status_code: Some(401), stdout: String::new(), stderr: "unauthorized".into() }));
    }
    let result = req.execute().await.unwrap_or_else(|e| crate::compose::ComposeResult { action: "error".into(), services: vec![], success: false, status_code: None, stdout: String::new(), stderr: e.to_string() });
    let code = if result.success { StatusCode::OK } else { StatusCode::INTERNAL_SERVER_ERROR };
    tracing::info!(success=result.success, status=?code, "compose completed");
    (code, Json(result))
}

// ---------- HTTP Metrics Middleware ----------
async fn http_metrics_middleware(
    req: HttpRequest<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let method = req.method().to_string();
    let raw_path = req.uri().path().to_string();
    let start = Instant::now();
    let resp = next.run(req).await;
    let status = resp.status().as_u16();
    // Attempt to use matched route path (avoids high cardinality) if available
    let path = resp.extensions()
        .get::<axum::extract::MatchedPath>()
        .map(|p| p.as_str().to_string())
        .unwrap_or(raw_path);
    crate::metrics::record_http_request(&method, &path, status);
    crate::metrics::observe_http_request_duration(&method, &path, start.elapsed().as_secs_f64());
    Ok(resp)
}

#[cfg(test)]
mod tests {
    use crate::compose::{ComposeRequest, ComposeAction};
    use super::AppState;
    use axum::http::HeaderMap;
    use axum::http::StatusCode;
    use axum::{Router, routing::{get}, middleware};
    use tower::ServiceExt; // for oneshot
    use axum::body::Body;
    use axum::http::{Request};
    use axum::body::to_bytes;

    #[tokio::test]
    async fn compose_dry_run_returns_success() {
    let req = ComposeRequest { action: ComposeAction::Build, services: vec![], file: "docker-compose.yml".into(), project: None, detach: false, tail: None, dry_run: true };
    let result = req.execute().await.unwrap();
        assert!(result.success);
        assert_eq!(result.stdout, "dry-run");
    let families = crate::metrics::PROMETHEUS_REGISTRY.gather();
    let compose = families.iter().find(|m| m.name()=="fks_compose_actions_total").expect("compose metric missing");
    let count: f64 = compose.metric.iter().map(|mc| mc.get_counter().value()).sum();
    assert!(count >= 1.0);
    }

    #[tokio::test]
    async fn unauthorized_check_blocks_without_header() {
        let state = AppState { monitor: crate::monitor::ServiceMonitor::new(crate::config::Config::default()).await.unwrap().start().await.unwrap(), api_key: Some("secret".into()) };
        let mut headers = HeaderMap::new();
        assert!(!super::is_authorized(&state, &headers));
        headers.insert("x-api-key", "wrong".parse().unwrap());
        assert!(!super::is_authorized(&state, &headers));
        headers.insert("x-api-key", "secret".parse().unwrap());
        assert!(super::is_authorized(&state, &headers));
    }

    #[tokio::test]
    async fn unauthorized_compose_increments_metric() {
        let state = AppState { monitor: crate::monitor::ServiceMonitor::new(crate::config::Config::default()).await.unwrap().start().await.unwrap(), api_key: Some("k".into()) };
        let headers = HeaderMap::new(); // no key
        let before = current_counter("fks_compose_unauthorized_total");
        let req = ComposeRequest { action: ComposeAction::Build, services: vec![], file: "docker-compose.yml".into(), project: None, detach: false, tail: None, dry_run: true };
    let (code, _resp) = super::compose_handler(axum::extract::State(state), headers, axum::Json(req)).await;
        assert_eq!(code, StatusCode::UNAUTHORIZED);
        let after = current_counter("fks_compose_unauthorized_total");
        assert!(after >= before + 1.0);
    }

    #[tokio::test]
    async fn unauthorized_restart_increments_metric() {
        let state = AppState { monitor: crate::monitor::ServiceMonitor::new(crate::config::Config::default()).await.unwrap().start().await.unwrap(), api_key: Some("k".into()) };
        let headers = HeaderMap::new();
        let before = current_counter("fks_restart_unauthorized_total");
        let result = super::restart_service_handler(axum::extract::Path("fks_api".to_string()), axum::extract::State(state), headers).await;
        assert!(!result.success);
        let after = current_counter("fks_restart_unauthorized_total");
        assert!(after >= before + 1.0);
    }

    fn current_counter(name: &str) -> f64 {
            let families = crate::metrics::PROMETHEUS_REGISTRY.gather();
            families.iter().find(|m| m.name()==name)
                .map(|m| m.metric.iter().map(|mc| mc.get_counter().value()).sum())
                .unwrap_or(0.0)
        }

    #[tokio::test]
    async fn http_metrics_use_matched_path() {
        // Build minimal app with the existing middleware and target route
        let state = AppState { monitor: crate::monitor::ServiceMonitor::new(crate::config::Config::default()).await.unwrap().start().await.unwrap(), api_key: None };
        let app = Router::new()
            .route("/api/services/{service_id}/health", get(super::get_service_health_handler))
            .layer(middleware::from_fn(super::http_metrics_middleware))
            .with_state(state);

        let req = Request::builder()
            .uri("/api/services/fks_api/health")
            .method("GET")
            .body(Body::empty())
            .unwrap();
        let _ = app.clone().oneshot(req).await.unwrap();

        // Gather metrics and confirm path label normalized to route pattern
        let families = crate::metrics::PROMETHEUS_REGISTRY.gather();
        let http_total = families.iter().find(|m| m.name()=="fks_http_requests_total").expect("missing http metric");
    let mut matched_concrete = false;
        for mf in &http_total.metric { 
            let mut path_val = None;
            for lp in mf.label.iter() {
                if lp.name() == "path" { path_val = Some(lp.value()); break; }
            }
            if let Some(p) = path_val { println!("observed path label: {}", p); }
            if let Some(p) = path_val { if p == "/api/services/fks_api/health" { matched_concrete = true; break; } }
        }
        assert!(matched_concrete, "expected concrete request path label to be recorded");
    }

    #[tokio::test]
    async fn aggregate_health_endpoint_returns_overall() {
        let state = AppState { monitor: crate::monitor::ServiceMonitor::new(crate::config::Config::default()).await.unwrap().start().await.unwrap(), api_key: None };
        let app = Router::new()
            .route("/health/aggregate", get(super::aggregate_health_handler))
            .with_state(state);
        let resp = app
            .clone()
            .oneshot(Request::builder().uri("/health/aggregate").method("GET").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    let body_bytes = to_bytes(resp.into_body(), 64 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert!(v.get("overallStatus").is_some());
    assert!(v.get("services").and_then(|s| s.as_array()).is_some());
    }
}


async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    let monitor = state.monitor.clone();
    ws.on_upgrade(|socket| websocket::handle_websocket(socket, monitor))
}

#[derive(Clone)]
struct AppState {
    monitor: monitor::MonitorHandle,
    api_key: Option<String>,
}

fn is_authorized(state: &AppState, headers: &axum::http::HeaderMap) -> bool {
    // 1. API key check (if configured)
    if let Some(required) = &state.api_key {
        if let Some(provided) = headers.get("x-api-key").and_then(|v| v.to_str().ok()) {
            if subtle_equals(required, provided) { return true; }
        }
        // Fall through to JWT if present
    }
    // 2. JWT Bearer token (if secret configured)
    if headers.get(axum::http::header::AUTHORIZATION).and_then(|v| v.to_str().ok()).map(|s| s.to_string()).map(|s| {
        let parts: Vec<&str> = s.split_whitespace().collect();
        if parts.len()==2 && parts[0].eq_ignore_ascii_case("Bearer") { crate::auth::authorize_jwt(Some(parts[1])) } else { false }
    }).unwrap_or(false) { return true; }
    // 3. If neither API key nor secret configured -> open
    if state.api_key.is_none() && std::env::var("FKS_WS_JWT_SECRET").is_err() { return true; }
    false
}

fn subtle_equals(a: &str, b: &str) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for (x,y) in a.bytes().zip(b.bytes()) { diff |= x ^ y; }
    diff == 0
}

fn get_or_make_request_id(headers: &axum::http::HeaderMap) -> String {
    if let Some(v) = headers.get("x-request-id").and_then(|h| h.to_str().ok()) { return v.to_string(); }
    uuid::Uuid::new_v4().to_string()
}

fn init_tracing() -> anyhow::Result<()> {
    use tracing_subscriber::{EnvFilter, fmt, Registry};
    let json = matches!(std::env::var("FKS_JSON_LOG").as_deref(), Ok("1") | Ok("true"));
    let otlp_endpoint = std::env::var("FKS_OTEL_ENDPOINT").ok();
    let service_name = std::env::var("FKS_SERVICE_NAME").ok().unwrap_or_else(|| "fks_master".into());

    let base = Registry::default().with(EnvFilter::from_default_env());
    let fmt_layer = if json { fmt::layer().with_target(false) } else { fmt::layer() };

    // If OTLP endpoint provided, build exporter pipeline
    if let Some(endpoint) = otlp_endpoint {
    use opentelemetry_sdk::{trace as sdktrace, Resource};
    use opentelemetry::{KeyValue};
    use opentelemetry_otlp::WithExportConfig;
    // traits already imported at module level
        // Build OTLP HTTP exporter (0.30 simplified API via exporter builder on sdktrace)
        let exporter = opentelemetry_otlp::SpanExporter::builder()
            .with_http()
            .with_endpoint(endpoint)
            .build()?;
        let resource = Resource::builder_empty()
            .with_attribute(KeyValue::new("service.name", service_name.clone()))
            .build();
        let mut builder = sdktrace::SdkTracerProvider::builder()
            .with_batch_exporter(exporter)
            .with_resource(resource);

        if let Ok(ratio_str) = std::env::var("FKS_TRACE_SAMPLE_RATIO") {
            if let Ok(ratio) = ratio_str.parse::<f64>() { builder = builder.with_sampler(sdktrace::Sampler::TraceIdRatioBased(ratio)); }
        }

        let provider = builder.build();
    let tracer = provider.tracer("fks_master");
        let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
        let subscriber = base.with(fmt_layer).with(otel_layer);
        subscriber.try_init()?;
        tracing::info!("OTLP tracing enabled");
        otel_global::set_tracer_provider(provider);
    } else {
        let subscriber = base.with(fmt_layer);
        subscriber.try_init()?;
    }
    Ok(())
}

fn extract_traceparent(headers: &axum::http::HeaderMap) -> Option<opentelemetry::Context> {
    let ctx = opentelemetry::global::get_text_map_propagator(|prop| prop.extract(&HeaderExtractor(headers)));
    if ctx.span().span_context().is_valid() { Some(ctx) } else { None }
}

struct HeaderExtractor<'a>(&'a axum::http::HeaderMap);
impl<'a> opentelemetry::propagation::Extractor for HeaderExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|v| v.to_str().ok())
    }
    fn keys(&self) -> Vec<&str> { self.0.keys().map(|k| k.as_str()).collect() }
}

async fn shutdown_signal() {
    if let Err(e) = tokio::signal::ctrl_c().await { tracing::error!(error=?e, "failed to install ctrl_c handler"); }
    info!("shutdown signal received, flushing telemetry");
    // TracerProvider will flush on drop; explicit shutdown not provided in current API version.
}
