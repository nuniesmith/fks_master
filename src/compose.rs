use anyhow::{anyhow, Result};
use clap::ValueEnum;
use serde::{Serialize, Deserialize};
use tracing::{debug, info, warn};
use crate::metrics;
use bollard::Docker;
use bollard::service::ContainerSummary;
use futures::StreamExt;

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum, Serialize, Deserialize)]
pub enum ComposeAction {
    Build,
    Pull,
    Up,
    Start,
    Stop,
    Restart,
    Push,
    Ps,
    Logs,
}

impl ComposeAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Build => "build",
            Self::Pull => "pull",
            Self::Up => "up",
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Restart => "restart",
            Self::Push => "push",
            Self::Ps => "ps",
            Self::Logs => "logs",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ComposeResult {
    pub action: String,
    pub services: Vec<String>,
    pub success: bool,
    pub status_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ComposeRequest {
    pub action: ComposeAction,
    #[serde(default)]
    pub services: Vec<String>,
    #[serde(default = "default_compose_file")] 
    pub file: String,
    pub project: Option<String>,
    #[serde(default)]
    pub detach: bool,
    pub tail: Option<u32>,
    #[serde(default)]
    pub dry_run: bool,
}

fn default_compose_file() -> String { "docker-compose.yml".into() }

impl ComposeRequest {
    pub async fn execute(self) -> Result<ComposeResult> {
        if self.dry_run {
            metrics::increment_compose_action(self.action.as_str(), true);
            return Ok(ComposeResult { action: self.action.as_str().into(), services: self.services, success: true, status_code: Some(0), stdout: "dry-run".into(), stderr: String::new() });
        }
        // Initialize Docker client (uses DOCKER_HOST / default socket)
        let docker = Docker::connect_with_local_defaults().map_err(|e| anyhow!("Docker connect failed: {e}"))?;
        let action_str = self.action.as_str();
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut success = true;
    let status_code: Option<i32> = Some(0);

        // Helper closures
        let services = if self.services.is_empty() { vec![] } else { self.services.clone() };

    let start_time = std::time::Instant::now();
    match self.action {
            ComposeAction::Ps => {
                let containers: Vec<ContainerSummary> = docker.list_containers::<String>(None).await.map_err(|e| anyhow!("list containers: {e}"))?;
                let mut table = String::new();
                for c in containers.iter() {
                    if let Some(names) = &c.names {
                        let name = names.get(0).cloned().unwrap_or_default();
                        if services.is_empty() || services.iter().any(|s| name.contains(s)) {
                            table.push_str(&format!("{name}\t{:?}\t{:?}\n", c.state, c.status));
                        }
                    }
                }
                stdout = table;
            }
            ComposeAction::Logs => {
                // For logs we stream each specified container sequentially; if none specified we skip (cannot infer compose set w/out parsing file)
                if services.is_empty() { stderr.push_str("no services specified for logs; provide service names\n"); success=false; }
                for svc in services.iter() {
                    let tail = self.tail.unwrap_or(100); // default tail lines
                    let mut logs = docker.logs(svc, Some(bollard::container::LogsOptions::<String>{ follow: false, stdout: true, stderr: true, tail: tail.to_string(), ..Default::default() }))
                        .map(|chunk| match chunk { Ok(bollard::container::LogOutput::StdOut { message }) | Ok(bollard::container::LogOutput::StdErr { message }) => Ok(String::from_utf8_lossy(&message).to_string()), Ok(_) => Ok(String::new()), Err(e)=>Err(e) });
                    while let Some(line) = logs.next().await { match line { Ok(l) => { stdout.push_str(&l); }, Err(e)=> { stderr.push_str(&format!("{e}\n")); success=false; } } }
                }
            }
            ComposeAction::Build => {
                // Compose build semantics (multi-service) are non-trivial; we fallback to CLI for now until full build context parsing is implemented.
                let fallback = run_compose_cli(&self).await?;
                return Ok(fallback);
            }
            ComposeAction::Pull | ComposeAction::Push => {
                // For simplicity fallback to CLI (registry auth / compose semantics out of scope initial refactor)
                let fallback = run_compose_cli(&self).await?;
                return Ok(fallback);
            }
            ComposeAction::Up | ComposeAction::Start => {
                // Start (create if needed) containers by name
                for svc in services.iter() {
                    // Attempt start; if missing we cannot create without compose file parsing -> fallback to CLI
                    if let Err(e) = docker.start_container::<String>(svc, None).await {
                        warn!(service=%svc, error=%e, "start via API failed, falling back to compose CLI");
                        let fallback = run_compose_cli(&self).await?;
                        return Ok(fallback);
                    }
                }
                stdout = format!("Started {} containers", services.len());
            }
            ComposeAction::Stop => {
                for svc in services.iter() {
                    if let Err(e) = docker.stop_container(svc, None).await { stderr.push_str(&format!("stop {svc}: {e}\n")); success=false; }
                }
            }
            ComposeAction::Restart => {
                for svc in services.iter() {
                    if let Err(e) = docker.restart_container(svc, None).await { stderr.push_str(&format!("restart {svc}: {e}\n")); success=false; }
                }
            }
        }

    let elapsed = start_time.elapsed().as_secs_f64();
    crate::metrics::observe_compose_action_duration(action_str, elapsed);
    if success { info!(action=action_str, services=?services, elapsed=?elapsed, "Compose action (API) ok"); } else { warn!(action=action_str, services=?services, stderr, elapsed=?elapsed, "Compose action (API) partial/failed"); }
        metrics::increment_compose_action(action_str, success);
        Ok(ComposeResult { action: action_str.into(), services, success, status_code, stdout, stderr })
    }
}

async fn run_compose_cli(req: &ComposeRequest) -> Result<ComposeResult> {
    use std::process::Command;
    let start_time = std::time::Instant::now();
    let mut args: Vec<String> = vec!["compose".into(), "-f".into(), req.file.clone()];
    if let Some(project) = req.project.clone().filter(|p| !p.is_empty()) { args.push("-p".into()); args.push(project); }
    let action_str = req.action.as_str();
    args.push(action_str.into());
    match req.action {
        ComposeAction::Up => { if req.detach { args.push("-d".into()); } }
        ComposeAction::Logs => { if req.detach { args.push("-f".into()); } if let Some(t)=req.tail { args.push("--tail".into()); args.push(t.to_string()); } }
        _ => {}
    }
    for s in &req.services { args.push(s.clone()); }
    debug!(?args, "Fallback docker compose CLI execution");
    let output = Command::new("docker").args(&args).output().map_err(|e| anyhow!("Failed to invoke docker: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = output.status.success();
    let code = output.status.code();
    let elapsed = start_time.elapsed().as_secs_f64();
    crate::metrics::observe_compose_action_duration(action_str, elapsed);
    if success { info!(action=action_str, services=?req.services, elapsed=?elapsed, "Compose CLI action ok"); } else { warn!(action=action_str, services=?req.services, stderr, elapsed=?elapsed, "Compose CLI action failed"); }
    metrics::increment_compose_action(action_str, success);
    Ok(ComposeResult { action: action_str.into(), services: req.services.clone(), success, status_code: code, stdout, stderr })
}


pub fn run_compose(
    file: &str,
    project: Option<&str>,
    action: ComposeAction,
    services: &[String],
    detach: bool,
    json: bool,
    tail: Option<u32>,
) -> Result<i32> {
    let mut args: Vec<String> = vec!["compose".into(), "-f".into(), file.into()];
    if let Some(project) = project.filter(|p| !p.is_empty()) {
        args.push("-p".into());
        args.push(project.into());
    }

    let action_str = action.as_str();
    args.push(action_str.into());

    // Specific flags per action
    match action {
        ComposeAction::Up => {
            if detach { args.push("-d".into()); }
        }
        ComposeAction::Logs => {
            if detach { args.push("-f".into()); } // follow
            if let Some(t) = tail { args.push("--tail".into()); args.push(t.to_string()); }
        }
        _ => {}
    }

    // Add services last
    for s in services { args.push(s.clone()); }

    debug!(?args, "Executing docker compose command");

    let start_time = std::time::Instant::now();
    let output = std::process::Command::new("docker")
        .args(&args)
        .output()
        .map_err(|e| anyhow!("Failed to invoke docker: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = output.status.success();
    let code = output.status.code();

    if success { info!(action = action_str, services = ?services, "Compose action succeeded"); }
    else { warn!(action = action_str, services = ?services, stderr, "Compose action failed"); }

    let elapsed = start_time.elapsed().as_secs_f64();
    crate::metrics::observe_compose_action_duration(action_str, elapsed);
    metrics::increment_compose_action(action_str, success);
    if json {
        let result = ComposeResult { action: action_str.into(), services: services.to_vec(), success, status_code: code, stdout, stderr };
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        println!("[compose:{action_str}] success={success} code={:?}\nSTDOUT:\n{}\nSTDERR:\n{}", code, stdout, stderr);
    }

    Ok(code.unwrap_or(if success {0} else {1}))
}
