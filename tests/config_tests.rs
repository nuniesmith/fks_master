use fks_master::config::Config;
use std::fs;
use tempfile::tempdir;

#[tokio::test]
async fn load_missing_config_uses_defaults() {
    let cfg = Config::load("/path/that/does/not/exist/monitor.toml").await.expect("fallback ok");
    assert!(!cfg.services.is_empty(), "default services populated");
    // Basic invariant: expected_response_time_ms positive
    assert!(cfg.services.iter().all(|s| s.expected_response_time_ms > 0));
}

#[tokio::test]
async fn load_custom_minimal_config() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("monitor.toml");
    let toml = r#"
        [monitoring]
        check_interval_seconds = 5
        timeout_seconds = 2
        retry_attempts = 1
        batch_size = 2
        enable_docker_stats = false

        [alerts]
        enable_notifications = false
        high_latency_threshold_ms = 1000
        consecutive_failures_threshold = 2
        webhook_url = "https://example.com/hook"

        [[services]]
        id = "demo"
        name = "Demo Service"
        health_endpoint = "http://demo:1234/health"
        service_type = "Api"
        docker_container = "demo"
        expected_response_time_ms = 250
        critical = true
    "#;
    fs::write(&path, toml).unwrap();
    let cfg = Config::load(&path).await.expect("parse custom");
    assert_eq!(cfg.services.len(), 1);
    assert_eq!(cfg.services[0].id, "demo");
    assert_eq!(cfg.monitoring.check_interval_seconds, 5);
    assert_eq!(cfg.alerts.consecutive_failures_threshold, 2);
}

#[tokio::test]
async fn invalid_toml_errors() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("bad.toml");
    fs::write(&path, "this = not = valid").unwrap();
    let err = Config::load(&path).await.unwrap_err();
    let msg = err.to_string();
    assert!(msg.contains("expected"), "unexpected error message: {msg}");
}
