use fks_master::compose::{ComposeRequest, ComposeAction};

#[tokio::test]
async fn logs_without_services_errors() {
    let req = ComposeRequest { action: ComposeAction::Logs, services: vec![], file: "docker-compose.yml".into(), project: None, detach: false, tail: Some(5), dry_run: false };
    // This will attempt docker API; if daemon not present, we treat that as skip.
    match req.execute().await {
        Ok(result) => {
            // When no services specified we expect failure state (success=false)
            assert!(!result.success, "logs with no services should not succeed");
            assert!(result.stderr.contains("no services"));
        }
        Err(e) => {
            // Accept daemon connection failures gracefully to keep CI portable
            let msg = e.to_string();
            assert!(msg.to_lowercase().contains("docker"), "unexpected error: {msg}");
        }
    }
}

#[tokio::test]
async fn dry_run_short_circuits() {
    let req = ComposeRequest { action: ComposeAction::Up, services: vec!["svc".into()], file: "docker-compose.yml".into(), project: Some("proj".into()), detach: true, tail: None, dry_run: true };
    let result = req.execute().await.expect("dry run should succeed");
    assert!(result.success);
    assert_eq!(result.stdout, "dry-run");
}
