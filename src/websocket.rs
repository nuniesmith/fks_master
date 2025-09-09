use axum::extract::ws::{Message, WebSocket};
use serde_json::json;
use std::time::Duration;
use tokio::time::interval;
use tracing::{debug, error, warn};

use crate::monitor::MonitorHandle;
use crate::metrics;
use crate::auth::authorize_jwt;

// Claims struct & role logic moved to auth module

#[derive(Debug, Clone)]
struct EventFilter {
    service_id: Option<String>,
    event_types: Option<Vec<String>>, // event type names matching EventType variants
}

impl EventFilter {
    fn matches(&self, ev: &crate::models::MonitorEvent) -> bool {
        if let Some(svc) = &self.service_id {
            if ev.service_id.as_ref() != Some(svc) { return false; }
        }
        if let Some(types) = &self.event_types {
            let ev_name = format!("{:?}", ev.event_type); // relies on Debug of enum variant
            if !types.iter().any(|t| t.eq_ignore_ascii_case(&ev_name)) { return false; }
        }
        true
    }
}

async fn authorize_ws_command(token: Option<&str>) -> bool { authorize_jwt(token) }

pub async fn handle_websocket(mut socket: WebSocket, monitor: MonitorHandle) {
    debug!("🔌 WebSocket connection established");
    
    // Track connection in metrics
    metrics::increment_websocket_connections();

    // Send initial data
    let services = monitor.get_all_services().await;
    let metrics = monitor.get_system_metrics().await;
    
    let initial_data = json!({
        "type": "initial",
        "services": services,
        "metrics": metrics
    });

    if socket.send(Message::Text(initial_data.to_string().into())).await.is_err() {
        warn!("Failed to send initial data to WebSocket client");
        return;
    }

    // Subscribe to event stream
    let mut event_rx = monitor.subscribe_events();
    // Current subscription filter (None = all)
    let mut filter: Option<EventFilter> = None;

    // Set up periodic updates
    let mut update_interval = interval(Duration::from_secs(5));
    
    loop {
        tokio::select! {
            // Handle incoming messages from client
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        debug!("📨 Received WebSocket message: {}", text);
                        
                        // Handle client commands
                        if let Ok(command) = serde_json::from_str::<ClientCommand>(&text) {
                            // Authorization: if command requires privileged action and JWT invalid -> reject
                            if command.command_type == "restart_service" {
                                if !authorize_ws_command(command.token.as_deref()).await {
                                    let resp = json!({"type":"error","reason":"unauthorized"});
                                    let _ = socket.send(Message::Text(resp.to_string().into())).await;
                                    crate::metrics::increment_restart_unauthorized();
                                    continue;
                                }
                            }
                            handle_client_command(&mut socket, &monitor, &mut filter, command).await;
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        debug!("🔌 WebSocket connection closed by client");
                        break;
                    }
                    Some(Err(err)) => {
                        error!("❌ WebSocket error: {}", err);
                        break;
                    }
                    None => break,
                    _ => {} // Ignore other message types
                }
            }
            
            // Send periodic updates
            _ = update_interval.tick() => {
                let services = monitor.get_all_services().await;
                let metrics = monitor.get_system_metrics().await;
                
                let update = json!({
                    "type": "update",
                    "services": services,
                    "metrics": metrics,
                    "timestamp": chrono::Utc::now()
                });

                if socket.send(Message::Text(update.to_string().into())).await.is_err() {
                    warn!("Failed to send update to WebSocket client");
                    break;
                }
            }
            // Push monitor events to client
            evt = event_rx.recv() => {
                if let Ok(ev) = evt {
                    if filter.as_ref().map(|f| f.matches(&ev)).unwrap_or(true) {
                        let msg = json!({ "type": "event", "event": ev });
                        if socket.send(Message::Text(msg.to_string().into())).await.is_err() { break; }
                    }
                }
            }
        }
    }

    debug!("🔌 WebSocket connection terminated");
    
    // Update connection count
    metrics::decrement_websocket_connections();
}

async fn handle_client_command(
    socket: &mut WebSocket,
    monitor: &MonitorHandle,
    filter: &mut Option<EventFilter>,
    command: ClientCommand,
) {
    debug!("🎛️  Handling client command: {:?}", command);

    match command.command_type.as_str() {
        "restart_service" => {
            if let Some(service_id) = command.service_id {
                let result = monitor.restart_service(&service_id).await;
                
                let response = json!({
                    "type": "restart_result",
                    "service_id": service_id,
                    "result": result
                });

                if let Err(err) = socket.send(Message::Text(response.to_string().into())).await {
                    error!("Failed to send restart result: {}", err);
                }
            }
        }
        "get_service_details" => {
            if let Some(service_id) = command.service_id {
                let health = monitor.get_service_health(&service_id).await;
                
                let response = json!({
                    "type": "service_details",
                    "service_id": service_id,
                    "health": health
                });

                if let Err(err) = socket.send(Message::Text(response.to_string().into())).await {
                    error!("Failed to send service details: {}", err);
                }
            }
        }
        "subscribe_events" => {
            let f = EventFilter { service_id: command.service_id.clone(), event_types: command.event_types.clone() };
            *filter = Some(f.clone());
            let response = json!({
                "type": "subscription_confirmed",
                "filters": { "service_id": f.service_id, "event_types": f.event_types },
                "message": "Event streaming active"
            });
            if let Err(err) = socket.send(Message::Text(response.to_string().into())).await { error!("Failed to confirm subscription: {}", err); }
        }
        "clear_subscription" => {
            *filter = None;
            let response = json!({
                "type": "subscription_cleared",
                "message": "Event subscription cleared (now receiving all events)"
            });
            if let Err(err) = socket.send(Message::Text(response.to_string().into())).await { error!("Failed to confirm clear_subscription: {}", err); }
        }
        _ => {
            warn!("Unknown command type: {}", command.command_type);
        }
    }
}

#[derive(Debug, serde::Deserialize)]
struct ClientCommand {
    command_type: String,
    service_id: Option<String>,
    // Reserved for future command payloads
    #[allow(dead_code)]
    data: Option<serde_json::Value>,
    token: Option<String>,
    event_types: Option<Vec<String>>,
}

// helper removed; direct await used

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MonitorEvent, EventType};
    use chrono::Utc;

    fn ev(event_type: EventType, service_id: Option<&str>) -> MonitorEvent {
        MonitorEvent { event_type, service_id: service_id.map(|s| s.to_string()), message: String::new(), timestamp: Utc::now(), data: None }
    }

    #[test]
    fn filter_by_service_only() {
        let f = EventFilter { service_id: Some("svcA".into()), event_types: None };
        assert!(f.matches(&ev(EventType::ServiceUp, Some("svcA"))));
        assert!(!f.matches(&ev(EventType::ServiceUp, Some("svcB"))));
    }

    #[test]
    fn filter_by_event_types() {
        let f = EventFilter { service_id: None, event_types: Some(vec!["ServiceDown".into()]) };
        assert!(f.matches(&ev(EventType::ServiceDown, Some("x"))));
        assert!(!f.matches(&ev(EventType::ServiceUp, Some("x"))));
    }

    // Role auth logic covered in auth module tests
}
