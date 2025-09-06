use anyhow::Result;
use reqwest::Client;
use std::time::{Duration, Instant};
use tracing::{debug, Instrument};

pub struct HealthChecker {
    client: Client,
    retry_attempts: u32,
}

impl HealthChecker {
    pub fn new(timeout: Duration, retry_attempts: u32) -> Self {
        let client = Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to create HTTP client");

    Self { client, retry_attempts }
    }

    pub async fn check_health(&self, endpoint: &str) -> Result<Duration> {
    let mut last_error = None;

        for attempt in 1..=self.retry_attempts {
            debug!("Health check attempt {}/{} for {}", attempt, self.retry_attempts, endpoint);
            
            let start_time = Instant::now();
            
            let send_future = self.client.get(endpoint).send();
            match send_future.instrument(tracing::info_span!("health_http", %endpoint)).await {
                Ok(response) => {
                    let elapsed = start_time.elapsed();
                    
                    if response.status().is_success() {
                        debug!("✅ Health check succeeded for {} in {}ms", endpoint, elapsed.as_millis());
                        return Ok(elapsed);
                    } else {
                        let error = format!("HTTP {}: {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown"));
                        last_error = Some(anyhow::anyhow!(error));
                        debug!("❌ Health check failed for {}: HTTP {}", endpoint, response.status());
                    }
                }
                Err(err) => {
                    debug!("❌ Health check error for {}: {}", endpoint, err);
                    last_error = Some(anyhow::anyhow!(err));
                }
            }

            // Wait before retry (except on last attempt)
            if attempt < self.retry_attempts {
                let delay = Duration::from_millis(1000 * attempt as u64); // Exponential backoff
                tokio::time::sleep(delay).await;
            }
        }

        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("All health check attempts failed")))
    }

        #[cfg(feature = "detailed_health")]
        pub async fn check_detailed_health(&self, endpoint: &str) -> Result<HealthCheckResult> {
    let start_time = Instant::now();
    let span = tracing::info_span!("health_detailed", %endpoint);
    match self.client.get(endpoint).send().instrument(span).await {
            Ok(response) => {
                let elapsed = start_time.elapsed();
                let status_code = response.status();
                
                // Try to parse JSON response for additional health info
                let body = response.text().await.unwrap_or_default();
                let health_data: Option<serde_json::Value> = serde_json::from_str(&body).ok();
                
                Ok(HealthCheckResult {
                    success: status_code.is_success(),
                    response_time: elapsed,
                    status_code: status_code.as_u16(),
                    response_body: body,
                    health_data,
                })
            }
            Err(err) => {
                Err(anyhow::anyhow!(err))
            }
        }
    }
}

#[derive(Debug)]
#[cfg(feature = "detailed_health")]
pub struct HealthCheckResult {
    pub success: bool,
    pub response_time: Duration,
    pub status_code: u16,
    pub response_body: String,
    pub health_data: Option<serde_json::Value>,
}
