use fks_master::{compose::{ComposeRequest, ComposeAction}, metrics};
use axum::{Router, routing::post, Json};
use axum::http::{HeaderMap, Request, StatusCode};
use tower::ServiceExt;
use serial_test::serial;

// Re-import items from main crate (private modules not exposed) via constructing minimal handler mirroring main.rs compose logic.

async fn compose_handler(headers: HeaderMap, Json(req): Json<ComposeRequest>) -> (StatusCode, Json<fks_master::compose::ComposeResult>) {
    // Authorization copied (simplified) from main is_authorized logic
    if !is_authorized(&headers) {
        metrics::increment_compose_unauthorized();
        return (StatusCode::UNAUTHORIZED, Json(fks_master::compose::ComposeResult { action: "error".into(), services: vec![], success: false, status_code: Some(401), stdout: String::new(), stderr: "unauthorized".into() }));
    }
    let result = req.execute().await.unwrap();
    (StatusCode::OK, Json(result))
}

fn is_authorized(headers: &HeaderMap) -> bool {
    // API key omitted for test; rely on JWT
    if std::env::var("FKS_WS_JWT_SECRET").is_ok() {
        if let Some(authz) = headers.get(axum::http::header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
            let parts: Vec<&str> = authz.split_whitespace().collect();
            if parts.len()==2 && parts[0].eq_ignore_ascii_case("Bearer") {
                // Call shared auth
                if fks_master::auth::authorize_jwt(Some(parts[1])) { return true; }
            }
        }
        // secret set -> require valid token
        false
    } else { true }
}

fn token_for(roles: &[&str]) -> String {
    use jsonwebtoken::{EncodingKey, Header, Algorithm, encode};
    use serde::Serialize;
    #[derive(Serialize)] struct Claims<'a> { sub: &'a str, exp: usize, roles: Vec<&'a str> }
    let now = 2_000_000_000usize; // far future
    let claims = Claims { sub: "tester", exp: now, roles: roles.to_vec() };
    encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(b"testsecret")).unwrap()
}

#[tokio::test]
#[serial]
async fn compose_authorized_with_jwt() {
    std::env::set_var("FKS_WS_JWT_SECRET", "testsecret");
    std::env::set_var("FKS_WS_JWT_ALLOWED_ROLES", "admin,orchestrate");
    let app = Router::new().route("/api/compose", post(compose_handler));
    let token = token_for(&["admin"]);
    let req_struct = ComposeRequest { action: ComposeAction::Build, services: vec![], file: "docker-compose.yml".into(), project: None, detach: false, tail: None, dry_run: true };
    let body_json = serde_json::to_string(&req_struct).unwrap();
    let req = Request::builder().method("POST").uri("/api/compose").header("Authorization", format!("Bearer {}", token)).header("content-type","application/json").body(axum::body::Body::from(body_json)).unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
#[serial]
async fn compose_unauthorized_with_bad_role() {
    std::env::set_var("FKS_WS_JWT_SECRET", "testsecret");
    std::env::set_var("FKS_WS_JWT_ALLOWED_ROLES", "admin");
    let app = Router::new().route("/api/compose", post(compose_handler));
    let token = token_for(&["viewer"]); // not allowed
    let req_struct = ComposeRequest { action: ComposeAction::Build, services: vec![], file: "docker-compose.yml".into(), project: None, detach: false, tail: None, dry_run: true };
    let body_json = serde_json::to_string(&req_struct).unwrap();
    let req = Request::builder().method("POST").uri("/api/compose").header("Authorization", format!("Bearer {}", token)).header("content-type","application/json").body(axum::body::Body::from(body_json)).unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
