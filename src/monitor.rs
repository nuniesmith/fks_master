use anyhow::Result;
use chrono::Utc;
use dashmap::DashMap;
use futures::future::join_all;
use std::sync::Arc;
use tokio::sync::broadcast;
use std::time::Duration;
use tokio::time::interval;
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::health::HealthChecker;
use crate::models::*;
use crate::metrics;

pub struct ServiceMonitor {
    config: Config,
    health_checker: HealthChecker,
    service_states: Arc<DashMap<String, ServiceStatus>>,
    event_history: Arc<DashMap<String, Vec<MonitorEvent>>>,
    error_history: Arc<DashMap<String, Vec<chrono::DateTime<chrono::Utc>>>>,
    resource_metrics: Arc<DashMap<String, ServiceMetrics>>,
    event_tx: broadcast::Sender<MonitorEvent>,
}

#[derive(Clone)]
pub struct MonitorHandle {
    service_states: Arc<DashMap<String, ServiceStatus>>,
    event_history: Arc<DashMap<String, Vec<MonitorEvent>>>,
    config: Config,
    resource_metrics: Arc<DashMap<String, ServiceMetrics>>,
    event_tx: broadcast::Sender<MonitorEvent>,
}

impl ServiceMonitor {
    pub async fn new(config: Config) -> Result<Self> {
        let health_checker = HealthChecker::new(
            Duration::from_secs(config.monitoring.timeout_seconds),
            config.monitoring.retry_attempts,
        );

        let service_states = Arc::new(DashMap::new());
        let event_history = Arc::new(DashMap::new());

        // Initialize service states
        for service in &config.services {
            service_states.insert(
                service.id.clone(),
                ServiceStatus {
                    id: service.id.clone(),
                    name: service.name.clone(),
                    status: HealthStatus::Unknown,
                    last_check: Utc::now(),
                    uptime_seconds: None,
                    response_time_ms: None,
                    error_message: None,
                    service_type: service.service_type.clone(),
                    critical: service.critical,
                },
            );
        }

        let (event_tx, _event_rx) = broadcast::channel(100);

        Ok(Self {
            config,
            health_checker,
            service_states,
            event_history,
            error_history: Arc::new(DashMap::new()),
            resource_metrics: Arc::new(DashMap::new()),
            event_tx,
        })
    }

    pub async fn start(self) -> Result<MonitorHandle> {
        let handle = MonitorHandle {
            service_states: self.service_states.clone(),
            event_history: self.event_history.clone(),
            config: self.config.clone(),
            resource_metrics: self.resource_metrics.clone(),
            event_tx: self.event_tx.clone(),
        };

        let monitor = Arc::new(self);

        // Start monitoring loop
        let monitor_clone = monitor.clone();
        tokio::spawn(async move {
            monitor_clone.monitoring_loop().await;
        });

        // Start metrics collection loop  
        let monitor_clone = monitor.clone();
        tokio::spawn(async move {
            monitor_clone.metrics_loop().await;
        });

        Ok(handle)
    }

    async fn monitoring_loop(self: Arc<Self>) {
        let mut interval = interval(Duration::from_secs(self.config.monitoring.check_interval_seconds));
        info!("🔍 Starting service monitoring loop");

        loop {
            interval.tick().await;
            debug!("Running health checks for {} services", self.config.services.len());

            // Check services in batches to avoid overwhelming the system
            let chunks: Vec<_> = self
                .config
                .services
                .chunks(self.config.monitoring.batch_size)
                .collect();

            for chunk in chunks {
                let futures = chunk.iter().map(|service| {
                    self.check_service_health(service)
                });
                
                join_all(futures).await;
                
                // Small delay between batches
                if chunk.len() == self.config.monitoring.batch_size {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        }
    }

    async fn metrics_loop(self: Arc<Self>) {
        let mut interval = interval(Duration::from_secs(60)); // Collect metrics every minute
        
        loop {
            interval.tick().await;
            debug!("Collecting system metrics");
            
            // Here you would collect additional metrics like:
            // - Docker container stats
            // - System resource usage
            // - Network metrics
            // - Custom application metrics
            
            // For now, this is a placeholder
            self.emit_event(MonitorEvent {
                event_type: EventType::MetricsUpdate,
                service_id: None,
                message: "System metrics updated".to_string(),
                timestamp: Utc::now(),
                data: None,
            }).await;

            // Update error rate (failures per minute over sliding window)
            let window_secs = 300; // 5 minute window
            let now = Utc::now();
            for svc in &self.config.services {
                let mut entry = self.error_history.entry(svc.id.clone()).or_insert_with(Vec::new);
                // Retain only entries within window
                entry.retain(|ts| (now.signed_duration_since(*ts).num_seconds() as i64) <= window_secs as i64);
                let failures = entry.len() as f64;
                let rate_per_min = failures / (window_secs as f64 / 60.0);
                crate::metrics::update_service_error_rate(
                    &svc.id,
                    &svc.name,
                    &format!("{:?}", svc.service_type),
                    rate_per_min,
                );
            }

            // Collect Docker resource stats if enabled (best effort)
            if self.config.monitoring.enable_docker_stats {
                if let Err(e) = self.collect_docker_stats().await { debug!(error=?e, "docker stats collection failed") }
            }
        }
    }

    async fn check_service_health(&self, service: &ServiceConfig) {
        
        match self.health_checker.check_health(&service.health_endpoint).await {
            Ok(response_time) => {
                let mut current_status = self.service_states.get_mut(&service.id).unwrap();
                let was_unhealthy = matches!(current_status.status, HealthStatus::Unhealthy);
                
                // Determine status based on response time
                let status = if response_time.as_millis() > service.expected_response_time_ms as u128 {
                    HealthStatus::Degraded
                } else {
                    HealthStatus::Healthy
                };

                current_status.status = status.clone();
                current_status.last_check = Utc::now();
                current_status.response_time_ms = Some(response_time.as_millis() as u64);
                current_status.error_message = None;

                // Update Prometheus metrics
                metrics::update_service_health_metric(
                    &service.id,
                    &service.name,
                    &format!("{:?}", service.service_type),
                    service.critical,
                    &status,
                );
                
                metrics::record_service_response_time(
                    &service.id,
                    &service.name,
                    &format!("{:?}", service.service_type),
                    response_time.as_secs_f64(),
                );

                metrics::increment_health_check(
                    &service.id,
                    &service.name,
                    match status {
                        HealthStatus::Healthy => "healthy",
                        HealthStatus::Degraded => "degraded",
                        _ => "unknown",
                    },
                );

                // Emit event if service recovered
                if was_unhealthy && matches!(status, HealthStatus::Healthy) {
                    self.emit_event(MonitorEvent {
                        event_type: EventType::ServiceUp,
                        service_id: Some(service.id.clone()),
                        message: format!("Service {} is now healthy", service.name),
                        timestamp: Utc::now(),
                        data: None,
                    }).await;
                }

                // Check for high latency
                if response_time.as_millis() > self.config.alerts.high_latency_threshold_ms as u128 {
                    warn!("High latency detected for {}: {}ms", service.name, response_time.as_millis());
                    self.emit_event(MonitorEvent {
                        event_type: EventType::HighLatency,
                        service_id: Some(service.id.clone()),
                        message: format!("High latency: {}ms", response_time.as_millis()),
                        timestamp: Utc::now(),
                        data: Some(serde_json::json!({"latency_ms": response_time.as_millis()})),
                    }).await;
                }

                debug!("✅ {} healthy - {}ms", service.name, response_time.as_millis());
            }
            Err(err) => {
                let mut current_status = self.service_states.get_mut(&service.id).unwrap();
                let was_healthy = matches!(current_status.status, HealthStatus::Healthy | HealthStatus::Degraded);

                current_status.status = HealthStatus::Unhealthy;
                current_status.last_check = Utc::now();
                current_status.response_time_ms = None;
                current_status.error_message = Some(err.to_string());

                // Update Prometheus metrics
                metrics::update_service_health_metric(
                    &service.id,
                    &service.name,
                    &format!("{:?}", service.service_type),
                    service.critical,
                    &HealthStatus::Unhealthy,
                );

                metrics::increment_health_check(
                    &service.id,
                    &service.name,
                    "unhealthy",
                );

                // Emit event if service went down
                if was_healthy {
                    error!("❌ {} is unhealthy: {}", service.name, err);
                    self.emit_event(MonitorEvent {
                        event_type: EventType::ServiceDown,
                        service_id: Some(service.id.clone()),
                        message: format!("Service {} is unhealthy: {}", service.name, err),
                        timestamp: Utc::now(),
                        data: Some(serde_json::json!({"error": err.to_string()})),
                    }).await;
                }

                // Track failure timestamp for error rate calculations
                let mut failures = self.error_history.entry(service.id.clone()).or_insert_with(Vec::new);
                failures.push(Utc::now());
            }
        }
    }

    async fn emit_event(&self, event: MonitorEvent) {
        let service_id = event.service_id.clone().unwrap_or_else(|| "system".to_string());
        
        self.event_history
            .entry(service_id.clone())
            .or_insert_with(Vec::new)
            .push(event.clone());
            
        // Keep only last 100 events per service
    if let Some(mut events) = self.event_history.get_mut(&service_id) {
            if events.len() > 100 {
                let keep_count = 100;
                let events_len = events.len();
                events.drain(0..events_len - keep_count);
            }
        }

    // Broadcast (ignore errors if no receivers)
    let _ = self.event_tx.send(event);
    }

    async fn collect_docker_stats(&self) -> Result<()> {
        // Build mapping container_name -> (service_id, service_name)
        let mut name_to_meta = std::collections::HashMap::new();
        for svc in &self.config.services {
            if let Some(c) = &svc.docker_container { name_to_meta.insert(c.clone(), (svc.id.clone(), svc.name.clone())); }
        }
        if name_to_meta.is_empty() { return Ok(()); }
        let output = tokio::process::Command::new("docker")
            .args(["stats","--no-stream","--format","{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}"])
            .output()
            .await?;
        if !output.status.success() { anyhow::bail!("docker stats failed: {}", String::from_utf8_lossy(&output.stderr)); }
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() < 4 { continue; }
            let name = parts[0].trim().to_string(); // container name
            if let Some((service_id, service_name)) = name_to_meta.get(&name) {
                let cpu = parts[1].trim_end_matches('%').parse::<f64>().ok();
                // MemUsage looks like "12.34MiB / 2.00GiB"
                let mem_usage_part = parts[2].split('/').next().unwrap_or("").trim();
                let mem_mb = parse_size_to_mb(mem_usage_part);
                // NetIO like "123kB / 45kB"
                let net_parts: Vec<&str> = parts[3].split('/').collect();
                let net_in = net_parts.get(0).and_then(|v| parse_size_to_bytes(v.trim()));
                let net_out = net_parts.get(1).and_then(|v| parse_size_to_bytes(v.trim()));
                // BlockIO column (if present) like "12.3MB / 4.5MB"
                let (blk_read, blk_write) = if parts.len() >=5 {
                    let blk_parts: Vec<&str> = parts[4].split('/').collect();
                    let r = blk_parts.get(0).and_then(|v| parse_size_to_bytes(v.trim()));
                    let w = blk_parts.get(1).and_then(|v| parse_size_to_bytes(v.trim()));
                    (r,w)
                } else { (None, None) };
                let mut entry = self.resource_metrics.entry(service_id.clone()).or_insert_with(ServiceMetrics::default);
                if let Some(c) = cpu { entry.cpu_usage_percent = Some(c); }
                if let Some(m) = mem_mb { entry.memory_usage_mb = Some(m as u64); }
                if let Some(n_in) = net_in { entry.network_in_bytes = Some(n_in as u64); }
                if let Some(n_out) = net_out { entry.network_out_bytes = Some(n_out as u64); }
                if let Some(br) = blk_read { entry.block_read_bytes = Some(br as u64); }
                if let Some(bw) = blk_write { entry.block_write_bytes = Some(bw as u64); }
                crate::metrics::update_service_resource_metrics(
                    service_id,
                    service_name,
                    entry.cpu_usage_percent,
                    entry.memory_usage_mb,
                    entry.network_in_bytes,
                    entry.network_out_bytes,
                    entry.block_read_bytes,
                    entry.block_write_bytes,
                );
            }
        }
        Ok(())
    }
}

fn parse_size_to_mb(input: &str) -> Option<f64> {
    parse_size_to_bytes(input).map(|b| b as f64 / (1024.0 * 1024.0))
}

fn parse_size_to_bytes(input: &str) -> Option<u64> {
    // Accept formats like "123kB", "12.3MiB", "1.2GiB"
    let input = input.trim();
    if input.is_empty() { return None; }
    let (num_part, unit_part) = input.split_at(input.find(char::is_alphabetic).unwrap_or(input.len()));
    let value: f64 = num_part.trim().replace(',', ".").parse().ok()?;
    let unit = unit_part.trim().to_lowercase();
    let bytes = if unit.starts_with("gib") || unit.starts_with("gb") { value * 1024.0 * 1024.0 * 1024.0 }
        else if unit.starts_with("mib") || unit.starts_with("mb") { value * 1024.0 * 1024.0 }
        else if unit.starts_with("kib") || unit.starts_with("kb") { value * 1024.0 }
        else if unit.starts_with('g') { value * 1_000_000_000.0 }
        else if unit.starts_with('m') { value * 1_000_000.0 }
        else if unit.starts_with('k') { value * 1_000.0 }
        else { value };
    Some(bytes as u64)
}

impl MonitorHandle {
    pub async fn get_all_services(&self) -> Vec<ServiceStatus> {
        self.service_states
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    pub async fn get_service_health(&self, service_id: &str) -> Option<ServiceHealth> {
        let status = self.service_states.get(service_id)?;
        let metrics = self.resource_metrics.get(service_id).map(|m| m.value().clone()).unwrap_or_default();
        
        Some(ServiceHealth {
            service_id: service_id.to_string(),
            status: status.status.clone(),
            checks: vec![], // TODO: Implement detailed health checks
            metrics,
            last_updated: status.last_check,
        })
    }

    pub async fn restart_service(&self, service_id: &str) -> RestartResult {
    let start_time = std::time::Instant::now();
        // Find the service configuration
        let service_config = self.config.services
            .iter()
            .find(|s| s.id == service_id);

        match service_config {
            Some(config) => {
                if let Some(container_name) = &config.docker_container {
                    // Attempt to restart Docker container
                    match std::process::Command::new("docker")
                        .args(["restart", container_name])
                        .output()
                    {
                        Ok(output) => {
                            if output.status.success() {
                                info!("🔄 Successfully restarted {}", container_name);
                                
                                // Update Prometheus metrics
                                metrics::increment_service_restart(&service_id, &config.name, true);
                                
                                let elapsed = start_time.elapsed().as_secs_f64();
                                crate::metrics::observe_service_restart_duration(service_id, elapsed);
                                RestartResult {
                                    service_id: service_id.to_string(),
                                    success: true,
                                    message: format!("Successfully restarted container {}", container_name),
                                    timestamp: Utc::now(),
                                }
                            } else {
                                let error = String::from_utf8_lossy(&output.stderr);
                                error!("❌ Failed to restart {}: {}", container_name, error);
                                
                                // Update Prometheus metrics
                                metrics::increment_service_restart(&service_id, &config.name, false);
                                
                                let elapsed = start_time.elapsed().as_secs_f64();
                                crate::metrics::observe_service_restart_duration(service_id, elapsed);
                                RestartResult {
                                    service_id: service_id.to_string(),
                                    success: false,
                                    message: format!("Failed to restart container: {}", error),
                                    timestamp: Utc::now(),
                                }
                            }
                        }
                        Err(err) => {
                            error!("❌ Error executing docker restart: {}", err);
                            let elapsed = start_time.elapsed().as_secs_f64();
                            crate::metrics::observe_service_restart_duration(service_id, elapsed);
                            RestartResult {
                                service_id: service_id.to_string(),
                                success: false,
                                message: format!("Error executing restart command: {}", err),
                                timestamp: Utc::now(),
                            }
                        }
                    }
                } else {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    crate::metrics::observe_service_restart_duration(service_id, elapsed);
                    RestartResult {
                        service_id: service_id.to_string(),
                        success: false,
                        message: "No Docker container configured for this service".to_string(),
                        timestamp: Utc::now(),
                    }
                }
            }
            None => {
                let elapsed = start_time.elapsed().as_secs_f64();
                crate::metrics::observe_service_restart_duration(service_id, elapsed);
                RestartResult {
                service_id: service_id.to_string(),
                success: false,
                message: "Service not found".to_string(),
                timestamp: Utc::now(),
            }}
        }
    }

    pub async fn get_system_metrics(&self) -> SystemMetrics {
        let services: Vec<ServiceStatus> = self.get_all_services().await;
        let total_services = services.len() as u32;
        let healthy_services = services.iter()
            .filter(|s| matches!(s.status, HealthStatus::Healthy))
            .count() as u32;
        let unhealthy_services = services.iter()
            .filter(|s| matches!(s.status, HealthStatus::Unhealthy))
            .count() as u32;
        let critical_services_down = services.iter()
            .filter(|s| s.critical && matches!(s.status, HealthStatus::Unhealthy))
            .count() as u32;

        let response_times: Vec<u64> = services.iter()
            .filter_map(|s| s.response_time_ms)
            .collect();
        
        let average_response_time_ms = if response_times.is_empty() {
            0.0
        } else {
            response_times.iter().sum::<u64>() as f64 / response_times.len() as f64
        };

        let (load_avg, total_errors) = collect_load_and_errors(&self.event_history);

        SystemMetrics {
            total_services,
            healthy_services,
            unhealthy_services,
            critical_services_down,
            average_response_time_ms,
            system_load_average: load_avg,
            total_requests: crate::metrics::get_total_http_requests() as u64,
            total_errors,
        }
    }

    pub fn subscribe_events(&self) -> broadcast::Receiver<MonitorEvent> {
        self.event_tx.subscribe()
    }
}

fn collect_load_and_errors(event_history: &Arc<DashMap<String, Vec<MonitorEvent>>>) -> (Option<f64>, u64) {
    use sysinfo::System;
    // Instantiate (not currently needed but kept if future metrics require)
    let load_avg_struct = System::load_average();
    let load_avg = Some(load_avg_struct.one);
    let mut error_count: u64 = 0;
    for entry in event_history.iter() {
        for ev in entry.value().iter() {
            if matches!(ev.event_type, EventType::ServiceDown) { error_count += 1; }
        }
    }
    (load_avg, error_count)
}
