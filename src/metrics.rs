use once_cell::sync::Lazy;
use prometheus::{
    GaugeVec, HistogramVec, IntCounter, IntCounterVec,
    IntGauge, IntGaugeVec, Registry,
};
use std::sync::atomic::{AtomicU64, Ordering};

// Global Prometheus registry
pub static PROMETHEUS_REGISTRY: Lazy<Registry> = Lazy::new(|| {
    let registry = Registry::new();
    
    // Register all metrics
    registry
        .register(Box::new(SERVICE_HEALTH_STATUS.clone()))
        .expect("Failed to register service_health_status");
    registry
        .register(Box::new(SERVICE_RESPONSE_TIME.clone()))
        .expect("Failed to register service_response_time");
    registry
        .register(Box::new(HEALTH_CHECK_TOTAL.clone()))
        .expect("Failed to register health_check_total");
    registry
        .register(Box::new(SERVICE_RESTART_TOTAL.clone()))
        .expect("Failed to register service_restart_total");
    registry
        .register(Box::new(MONITOR_UPTIME.clone()))
        .expect("Failed to register monitor_uptime");
    registry
        .register(Box::new(ACTIVE_WEBSOCKET_CONNECTIONS.clone()))
        .expect("Failed to register active_websocket_connections");
    registry
        .register(Box::new(SERVICE_ERROR_RATE.clone()))
        .expect("Failed to register service_error_rate");
    registry
        .register(Box::new(COMPOSE_ACTION_TOTAL.clone()))
        .expect("Failed to register compose_action_total");
    registry
        .register(Box::new(COMPOSE_UNAUTHORIZED_TOTAL.clone()))
        .expect("Failed to register compose_unauthorized_total");
    registry
        .register(Box::new(RESTART_UNAUTHORIZED_TOTAL.clone()))
        .expect("Failed to register restart_unauthorized_total");
    registry
        .register(Box::new(HTTP_REQUEST_TOTAL.clone()))
        .expect("Failed to register http_request_total");
    registry
        .register(Box::new(HTTP_REQUEST_DURATION_SECONDS.clone()))
        .expect("Failed to register http_request_duration_seconds");
    registry
        .register(Box::new(COMPOSE_ACTION_DURATION_SECONDS.clone()))
        .expect("Failed to register compose_action_duration_seconds");
    registry
        .register(Box::new(SERVICE_RESTART_DURATION_SECONDS.clone()))
        .expect("Failed to register service_restart_duration_seconds");
    // Resource usage gauges
    registry.register(Box::new(SERVICE_CPU_PERCENT.clone())).ok();
    registry.register(Box::new(SERVICE_MEMORY_MB.clone())).ok();
    registry.register(Box::new(SERVICE_NETWORK_IN_BYTES.clone())).ok();
    registry.register(Box::new(SERVICE_NETWORK_OUT_BYTES.clone())).ok();
    registry.register(Box::new(SERVICE_BLOCK_READ_BYTES.clone())).ok();
    registry.register(Box::new(SERVICE_BLOCK_WRITE_BYTES.clone())).ok();
    
    registry
});

// Service health status (0=unknown, 1=healthy, 2=degraded, 3=unhealthy)
pub static SERVICE_HEALTH_STATUS: Lazy<IntGaugeVec> = Lazy::new(|| {
    IntGaugeVec::new(
        prometheus::Opts::new(
            "fks_service_health_status",
            "Current health status of FKS services (0=unknown, 1=healthy, 2=degraded, 3=unhealthy)"
        ),
        &["service_id", "service_name", "service_type", "critical"]
    ).expect("Failed to create service_health_status metric")
});

// Service response time histogram
pub static SERVICE_RESPONSE_TIME: Lazy<HistogramVec> = Lazy::new(|| {
    HistogramVec::new(
        prometheus::HistogramOpts::new(
            "fks_service_response_time_seconds",
            "Response time of FKS service health checks in seconds"
        ).buckets(vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]),
        &["service_id", "service_name", "service_type"]
    ).expect("Failed to create service_response_time metric")
});

// Health check counter
pub static HEALTH_CHECK_TOTAL: Lazy<IntCounterVec> = Lazy::new(|| {
    IntCounterVec::new(
        prometheus::Opts::new(
            "fks_health_checks_total",
            "Total number of health checks performed"
        ),
        &["service_id", "service_name", "status"]
    ).expect("Failed to create health_checks_total metric")
});

// Service restart counter
pub static SERVICE_RESTART_TOTAL: Lazy<IntCounterVec> = Lazy::new(|| {
    IntCounterVec::new(
        prometheus::Opts::new(
            "fks_service_restarts_total",
            "Total number of service restart attempts"
        ),
        &["service_id", "service_name", "success"]
    ).expect("Failed to create service_restarts_total metric")
});

// Monitor uptime
pub static MONITOR_UPTIME: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "fks_monitor_uptime_seconds_total",
        "Total uptime of the FKS monitor service in seconds"
    ).expect("Failed to create monitor_uptime metric")
});

// Active WebSocket connections
pub static ACTIVE_WEBSOCKET_CONNECTIONS: Lazy<IntGauge> = Lazy::new(|| {
    IntGauge::new(
        "fks_websocket_connections_active",
        "Number of active WebSocket connections to the monitor"
    ).expect("Failed to create websocket_connections metric")
});

// Service error rate (errors per minute)
pub static SERVICE_ERROR_RATE: Lazy<GaugeVec> = Lazy::new(|| {
    GaugeVec::new(
        prometheus::Opts::new(
            "fks_service_error_rate",
            "Error rate per minute for each service"
        ),
        &["service_id", "service_name", "service_type"]
    ).expect("Failed to create service_error_rate metric")
});

pub static COMPOSE_ACTION_TOTAL: Lazy<IntCounterVec> = Lazy::new(|| {
    IntCounterVec::new(
        prometheus::Opts::new(
            "fks_compose_actions_total",
            "Total number of docker compose actions invoked"
        ),
        &["action", "success"]
    ).expect("Failed to create compose_action_total metric")
});

pub static COMPOSE_UNAUTHORIZED_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "fks_compose_unauthorized_total",
        "Total number of unauthorized compose attempts"
    ).expect("Failed to create compose_unauthorized_total metric")
});

pub static RESTART_UNAUTHORIZED_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "fks_restart_unauthorized_total",
        "Total number of unauthorized service restart attempts"
    ).expect("Failed to create restart_unauthorized_total metric")
});

pub static HTTP_REQUEST_TOTAL: Lazy<IntCounterVec> = Lazy::new(|| {
    IntCounterVec::new(
        prometheus::Opts::new(
            "fks_http_requests_total",
            "Total HTTP requests received"
        ),
        &["method", "path", "status"]
    ).expect("Failed to create http_requests_total metric")
});

pub static HTTP_REQUEST_DURATION_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    HistogramVec::new(
        prometheus::HistogramOpts::new(
            "fks_http_request_duration_seconds",
            "HTTP request duration in seconds"
        ).buckets(vec![0.005,0.01,0.025,0.05,0.1,0.25,0.5,1.0,2.5,5.0]),
        &["method", "path"]
    ).expect("Failed to create http_request_duration_seconds histogram")
});

pub static COMPOSE_ACTION_DURATION_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    HistogramVec::new(
        prometheus::HistogramOpts::new(
            "fks_compose_action_duration_seconds",
            "Duration of docker compose actions"
        ).buckets(vec![0.05,0.1,0.25,0.5,1.0,2.5,5.0,10.0,30.0]),
        &["action"]
    ).expect("compose_action_duration_seconds")
});

pub static SERVICE_RESTART_DURATION_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    HistogramVec::new(
        prometheus::HistogramOpts::new(
            "fks_service_restart_duration_seconds",
            "Duration of service restart attempts"
        ).buckets(vec![0.1,0.25,0.5,1.0,2.5,5.0,10.0]),
        &["service_id"]
    ).expect("service_restart_duration_seconds")
});

static TOTAL_HTTP_REQUESTS: Lazy<AtomicU64> = Lazy::new(|| AtomicU64::new(0));

// ----- Resource Usage Gauges -----
static G_SERVICE_LABELS: [&str; 2] = ["service_id", "service_name"];
pub static SERVICE_CPU_PERCENT: Lazy<GaugeVec> = Lazy::new(|| {
    GaugeVec::new(prometheus::Opts::new("fks_service_cpu_usage_percent", "Service CPU usage percent"), &G_SERVICE_LABELS).expect("cpu gauge")
});
pub static SERVICE_MEMORY_MB: Lazy<GaugeVec> = Lazy::new(|| {
    GaugeVec::new(prometheus::Opts::new("fks_service_memory_usage_megabytes", "Service memory usage MB"), &G_SERVICE_LABELS).expect("mem gauge")
});
pub static SERVICE_NETWORK_IN_BYTES: Lazy<IntGaugeVec> = Lazy::new(|| {
    IntGaugeVec::new(prometheus::Opts::new("fks_service_network_in_bytes", "Service network receive bytes"), &G_SERVICE_LABELS).expect("net in")
});
pub static SERVICE_NETWORK_OUT_BYTES: Lazy<IntGaugeVec> = Lazy::new(|| {
    IntGaugeVec::new(prometheus::Opts::new("fks_service_network_out_bytes", "Service network transmit bytes"), &G_SERVICE_LABELS).expect("net out")
});
pub static SERVICE_BLOCK_READ_BYTES: Lazy<IntGaugeVec> = Lazy::new(|| {
    IntGaugeVec::new(prometheus::Opts::new("fks_service_block_read_bytes", "Service block IO read bytes"), &G_SERVICE_LABELS).expect("block read")
});
pub static SERVICE_BLOCK_WRITE_BYTES: Lazy<IntGaugeVec> = Lazy::new(|| {
    IntGaugeVec::new(prometheus::Opts::new("fks_service_block_write_bytes", "Service block IO write bytes"), &G_SERVICE_LABELS).expect("block write")
});

// Helper functions to update metrics
pub fn update_service_health_metric(
    service_id: &str,
    service_name: &str,
    service_type: &str,
    critical: bool,
    status: &crate::models::HealthStatus,
) {
    let status_value = match status {
        crate::models::HealthStatus::Unknown => 0,
        crate::models::HealthStatus::Healthy => 1,
        crate::models::HealthStatus::Degraded => 2,
        crate::models::HealthStatus::Unhealthy => 3,
    };
    
    SERVICE_HEALTH_STATUS
        .with_label_values(&[service_id, service_name, service_type, &critical.to_string()])
        .set(status_value);
}

pub fn record_service_response_time(
    service_id: &str,
    service_name: &str,
    service_type: &str,
    response_time_secs: f64,
) {
    SERVICE_RESPONSE_TIME
        .with_label_values(&[service_id, service_name, service_type])
        .observe(response_time_secs);
}

pub fn increment_health_check(
    service_id: &str,
    service_name: &str,
    status: &str,
) {
    HEALTH_CHECK_TOTAL
        .with_label_values(&[service_id, service_name, status])
        .inc();
}

pub fn increment_service_restart(
    service_id: &str,
    service_name: &str,
    success: bool,
) {
    SERVICE_RESTART_TOTAL
        .with_label_values(&[service_id, service_name, &success.to_string()])
        .inc();
}

pub fn increment_websocket_connections() {
    ACTIVE_WEBSOCKET_CONNECTIONS.inc();
}

pub fn decrement_websocket_connections() {
    ACTIVE_WEBSOCKET_CONNECTIONS.dec();
}

pub fn update_service_error_rate(
    service_id: &str,
    service_name: &str,
    service_type: &str,
    error_rate: f64,
) {
    SERVICE_ERROR_RATE
        .with_label_values(&[service_id, service_name, service_type])
        .set(error_rate);
}

pub fn increment_compose_action(action: &str, success: bool) {
    COMPOSE_ACTION_TOTAL
        .with_label_values(&[action, &success.to_string()])
        .inc();
}

pub fn increment_compose_unauthorized() {
    COMPOSE_UNAUTHORIZED_TOTAL.inc();
}

pub fn increment_restart_unauthorized() {
    RESTART_UNAUTHORIZED_TOTAL.inc();
}

pub fn record_http_request(method: &str, path: &str, status: u16) {
    HTTP_REQUEST_TOTAL
        .with_label_values(&[method, path, &status.to_string()])
        .inc();
    TOTAL_HTTP_REQUESTS.fetch_add(1, Ordering::Relaxed);
}

pub fn observe_http_request_duration(method: &str, path: &str, seconds: f64) {
    HTTP_REQUEST_DURATION_SECONDS
        .with_label_values(&[method, path])
        .observe(seconds);
}

pub fn observe_compose_action_duration(action: &str, seconds: f64) {
    COMPOSE_ACTION_DURATION_SECONDS
        .with_label_values(&[action])
        .observe(seconds);
}

pub fn observe_service_restart_duration(service_id: &str, seconds: f64) {
    SERVICE_RESTART_DURATION_SECONDS
        .with_label_values(&[service_id])
        .observe(seconds);
}

pub fn get_total_http_requests() -> u64 { TOTAL_HTTP_REQUESTS.load(Ordering::Relaxed) }

pub fn update_service_resource_metrics(
    service_id: &str,
    service_name: &str,
    cpu: Option<f64>,
    mem_mb: Option<u64>,
    net_in: Option<u64>,
    net_out: Option<u64>,
    blk_read: Option<u64>,
    blk_write: Option<u64>,
) {
    if let Some(c) = cpu { SERVICE_CPU_PERCENT.with_label_values(&[service_id, service_name]).set(c); }
    if let Some(m) = mem_mb { SERVICE_MEMORY_MB.with_label_values(&[service_id, service_name]).set(m as f64); }
    if let Some(n) = net_in { SERVICE_NETWORK_IN_BYTES.with_label_values(&[service_id, service_name]).set(n as i64); }
    if let Some(n) = net_out { SERVICE_NETWORK_OUT_BYTES.with_label_values(&[service_id, service_name]).set(n as i64); }
    if let Some(b) = blk_read { SERVICE_BLOCK_READ_BYTES.with_label_values(&[service_id, service_name]).set(b as i64); }
    if let Some(b) = blk_write { SERVICE_BLOCK_WRITE_BYTES.with_label_values(&[service_id, service_name]).set(b as i64); }
}

// Initialize uptime tracking
pub fn start_uptime_tracking() {
    tokio::spawn(async {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));
        loop {
            interval.tick().await;
            MONITOR_UPTIME.inc();
        }
    });
}
