use jsonwebtoken::{DecodingKey, Validation, Algorithm, decode};
use once_cell::sync::Lazy;

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: Option<usize>,
    pub iss: Option<String>,
    pub aud: Option<String>,
    pub roles: Option<Vec<String>>,
}

static ALLOWED_ROLES: Lazy<Vec<String>> = Lazy::new(|| {
    std::env::var("FKS_WS_JWT_ALLOWED_ROLES")
        .unwrap_or_else(|_| "admin,orchestrate".into())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
});

fn decode_jwt(token: &str, secret: &str) -> Option<Claims> {
    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    decode::<Claims>(token, &key, &validation).ok().map(|d| d.claims)
}

fn roles_authorized(claims: &Claims) -> bool {
    match &claims.roles {
        Some(r) => r.iter().any(|role| ALLOWED_ROLES.iter().any(|allowed| allowed.eq_ignore_ascii_case(role))),
        None => false,
    }
}

pub fn authorize_jwt(token: Option<&str>) -> bool {
    let secret = match std::env::var("FKS_WS_JWT_SECRET") { Ok(s) => s, Err(_) => return true }; // secret unset -> allow all
    let token = match token { Some(t) => t, None => return false }; // require token if secret set
    if let Some(claims) = decode_jwt(token, &secret) { roles_authorized(&claims) } else { false }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn allowed_roles_parsing() {
        std::env::set_var("FKS_WS_JWT_ALLOWED_ROLES", "admin, orchestrate");
        assert!(ALLOWED_ROLES.iter().any(|r| r=="admin"));
    }

    #[test]
    fn jwt_authorization_flow() {
        std::env::set_var("FKS_WS_JWT_SECRET", "testsecret");
        std::env::set_var("FKS_WS_JWT_ALLOWED_ROLES", "admin,orchestrate");
        let now = 2_000_000_000usize; // far future
        use jsonwebtoken::{encode, Header, EncodingKey, Algorithm};
        let claims_ok = Claims { sub: "u1".into(), exp: now, iat: None, iss: None, aud: None, roles: Some(vec!["admin".into()]) };
        let token_ok = encode(&Header::new(Algorithm::HS256), &claims_ok, &EncodingKey::from_secret(b"testsecret")).unwrap();
        assert!(crate::auth::authorize_jwt(Some(&token_ok)));
        let claims_bad = Claims { sub: "u2".into(), exp: now, iat: None, iss: None, aud: None, roles: Some(vec!["viewer".into()]) };
        let token_bad = encode(&Header::new(Algorithm::HS256), &claims_bad, &EncodingKey::from_secret(b"testsecret")).unwrap();
        assert!(!crate::auth::authorize_jwt(Some(&token_bad)));
        // Missing token should fail (secret set)
        assert!(!crate::auth::authorize_jwt(None));
    }
}
