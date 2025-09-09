use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs;

use crate::models::{ServiceConfig, ServiceType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub services: Vec<ServiceConfig>,
    pub monitoring: MonitoringConfig,
    pub alerts: AlertConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub check_interval_seconds: u64,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
    pub batch_size: usize,
    #[serde(default = "default_enable_docker_stats")]
    pub enable_docker_stats: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    pub enable_notifications: bool,
    pub high_latency_threshold_ms: u64,
    pub consecutive_failures_threshold: u32,
    pub webhook_url: Option<String>,
}

impl Config {
    pub async fn load<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(&path).await;
        
        match content {
            Ok(content) => {
                let config: Config = toml::from_str(&content)?;
                Ok(config)
            }
            Err(_) => {
                tracing::warn!("Config file not found, using default configuration");
                Ok(Self::default())
            }
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            services: vec![
                ServiceConfig {
                    id: "fks_api".to_string(),
                    name: "FKS API Service".to_string(),
                    health_endpoint: "http://fks_api:8000/health".to_string(),
                    service_type: ServiceType::Api,
                    docker_container: Some("fks_api".to_string()),
                    expected_response_time_ms: 500,
                    critical: true,
                },
                ServiceConfig {
                    id: "fks_auth".to_string(),
                    name: "FKS Authentication Service".to_string(),
                    // Updated to reflect standardized auth service port (4100)
                    health_endpoint: "http://fks_auth:4100/health".to_string(),
                    service_type: ServiceType::Auth,
                    docker_container: Some("fks_auth".to_string()),
                    expected_response_time_ms: 300,
                    critical: true,
                },
                ServiceConfig {
                    id: "fks_data".to_string(),
                    name: "FKS Data Service".to_string(),
                    health_endpoint: "http://fks_data:8002/health".to_string(),
                    service_type: ServiceType::Database,
                    docker_container: Some("fks_data".to_string()),
                    expected_response_time_ms: 800,
                    critical: true,
                },
                ServiceConfig {
                    id: "fks_engine".to_string(),
                    name: "FKS Trading Engine".to_string(),
                    health_endpoint: "http://fks_engine:8003/health".to_string(),
                    service_type: ServiceType::Engine,
                    docker_container: Some("fks_engine".to_string()),
                    expected_response_time_ms: 200,
                    critical: true,
                },
                ServiceConfig {
                    id: "fks_transformer".to_string(),
                    name: "FKS Data Transformer".to_string(),
                    health_endpoint: "http://fks_transformer:8004/health".to_string(),
                    service_type: ServiceType::Transformer,
                    docker_container: Some("fks_transformer".to_string()),
                    expected_response_time_ms: 1000,
                    critical: false,
                },
                ServiceConfig {
                    id: "fks_training".to_string(),
                    name: "FKS ML Training Service".to_string(),
                    health_endpoint: "http://fks_training:8005/health".to_string(),
                    service_type: ServiceType::Training,
                    docker_container: Some("fks_training".to_string()),
                    expected_response_time_ms: 2000,
                    critical: false,
                },
                ServiceConfig {
                    id: "fks_worker".to_string(),
                    name: "FKS Background Worker".to_string(),
                    health_endpoint: "http://fks_worker:8006/health".to_string(),
                    service_type: ServiceType::Worker,
                    docker_container: Some("fks_worker".to_string()),
                    expected_response_time_ms: 500,
                    critical: false,
                },
                ServiceConfig {
                    id: "fks_web".to_string(),
                    name: "FKS Web Interface".to_string(),
                    health_endpoint: "http://fks_web:3000/health".to_string(),
                    service_type: ServiceType::Web,
                    docker_container: Some("fks_web".to_string()),
                    expected_response_time_ms: 300,
                    critical: true,
                },
                ServiceConfig {
                    id: "fks_config".to_string(),
                    name: "FKS Configuration Service".to_string(),
                    health_endpoint: "http://fks_config:8007/health".to_string(),
                    service_type: ServiceType::Config,
                    docker_container: Some("fks_config".to_string()),
                    expected_response_time_ms: 200,
                    critical: true,
                },
                ServiceConfig {
                    id: "fks_execution".to_string(),
                    name: "FKS Execution Service".to_string(),
                    health_endpoint: "http://fks_execution:8008/health".to_string(),
                    service_type: ServiceType::Execution,
                    docker_container: Some("fks_execution".to_string()),
                    expected_response_time_ms: 300,
                    critical: true,
                },
                ServiceConfig {
                    id: "fks_nodes".to_string(),
                    name: "FKS Nodes Master".to_string(),
                    health_endpoint: "http://fks_nodes:8081/health".to_string(),
                    service_type: ServiceType::Worker,
                    docker_container: Some("fks_nodes".to_string()),
                    expected_response_time_ms: 400,
                    critical: false,
                },
            ],
            monitoring: MonitoringConfig {
                check_interval_seconds: 30,
                timeout_seconds: 10,
                retry_attempts: 3,
                batch_size: 5,
                enable_docker_stats: true,
            },
            alerts: AlertConfig {
                enable_notifications: true,
                high_latency_threshold_ms: 2000,
                consecutive_failures_threshold: 3,
                webhook_url: None,
            },
        }
    }
}

fn default_enable_docker_stats() -> bool { true }
