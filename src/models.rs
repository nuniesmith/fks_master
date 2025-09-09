use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub id: String,
    pub name: String,
    pub health_endpoint: String,
    pub service_type: ServiceType,
    pub docker_container: Option<String>,
    pub expected_response_time_ms: u64,
    pub critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServiceType {
    Api,
    Worker,
    Database,
    Auth,
    Engine,
    Transformer,
    Training,
    Config,
    Execution,
    Web,
    Nginx,
    Master,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub id: String,
    pub name: String,
    pub status: HealthStatus,
    pub last_check: DateTime<Utc>,
    pub uptime_seconds: Option<u64>,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
    pub service_type: ServiceType,
    pub critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub service_id: String,
    pub status: HealthStatus,
    pub checks: Vec<HealthCheck>,
    pub metrics: ServiceMetrics,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub name: String,
    pub status: HealthStatus,
    pub response_time_ms: u64,
    pub message: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMetrics {
    pub cpu_usage_percent: Option<f64>,
    pub memory_usage_mb: Option<u64>,
    pub disk_usage_percent: Option<f64>,
    pub network_in_bytes: Option<u64>,
    pub network_out_bytes: Option<u64>,
    pub request_count: Option<u64>,
    pub error_rate: Option<f64>,
    pub block_read_bytes: Option<u64>,
    pub block_write_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub total_services: u32,
    pub healthy_services: u32,
    pub unhealthy_services: u32,
    pub critical_services_down: u32,
    pub average_response_time_ms: f64,
    pub system_load_average: Option<f64>,
    pub total_requests: u64,
    pub total_errors: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestartResult {
    pub service_id: String,
    pub success: bool,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorEvent {
    pub event_type: EventType,
    pub service_id: Option<String>,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    ServiceUp,
    ServiceDown,
    ServiceRestarted,
    HighLatency,
    SystemAlert,
    MetricsUpdate,
}

impl Default for ServiceMetrics {
    fn default() -> Self {
        Self {
            cpu_usage_percent: None,
            memory_usage_mb: None,
            disk_usage_percent: None,
            network_in_bytes: None,
            network_out_bytes: None,
            request_count: None,
            error_rate: None,
            block_read_bytes: None,
            block_write_bytes: None,
        }
    }
}
