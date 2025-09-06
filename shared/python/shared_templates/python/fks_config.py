# FKS Python Service Template
# Enhanced configuration template with environment variables and health checks

"""
FKS Python Service Configuration Template
Provides standardized configuration management for all FKS Python microservices.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import json

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings


class FKSHealthCheck(BaseModel):
    """FKS standard health check response model."""
    status: str = Field(..., description="Health status: healthy, unhealthy, degraded")
    service: str = Field(..., description="Service name")
    service_type: str = Field(..., description="Service type")
    version: str = Field(default="1.0.0", description="Service version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    environment: str = Field(..., description="Deployment environment")
    uptime_seconds: Optional[int] = Field(None, description="Service uptime in seconds")
    dependencies: Dict[str, Any] = Field(default_factory=dict, description="Dependency health status")
    

class FKSSettings(BaseSettings):
    """FKS standard settings template with environment variable support."""
    
    # FKS Standard Environment Variables
    FKS_SERVICE_NAME: str = Field(default="fks-service", description="Service identifier")
    FKS_SERVICE_TYPE: str = Field(default="api", description="Service type (api, engine, data, etc.)")
    FKS_SERVICE_PORT: int = Field(default=8000, description="Service port")
    FKS_ENVIRONMENT: str = Field(default="development", description="Deployment environment")
    FKS_LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    FKS_HEALTH_CHECK_PATH: str = Field(default="/health", description="Health check endpoint")
    FKS_METRICS_PATH: str = Field(default="/metrics", description="Metrics endpoint")
    FKS_CONFIG_PATH: str = Field(default="/app/config", description="Configuration path")
    FKS_DATA_PATH: str = Field(default="/app/data", description="Data storage path")
    
    # Database Configuration
    DATABASE_URL: Optional[str] = Field(None, description="Database connection URL")
    DATABASE_HOST: str = Field(default="localhost", description="Database host")
    DATABASE_PORT: int = Field(default=5432, description="Database port")
    DATABASE_NAME: str = Field(default="fks", description="Database name")
    DATABASE_USER: str = Field(default="fks", description="Database user")
    DATABASE_PASSWORD: str = Field(default="", description="Database password")
    
    # Redis Configuration
    REDIS_URL: Optional[str] = Field(None, description="Redis connection URL")
    REDIS_HOST: str = Field(default="localhost", description="Redis host")
    REDIS_PORT: int = Field(default=6379, description="Redis port")
    REDIS_PASSWORD: str = Field(default="", description="Redis password")
    
    # Security Configuration
    SECRET_KEY: str = Field(default="dev-secret-key", description="Application secret key")
    API_KEY: Optional[str] = Field(None, description="API authentication key")
    JWT_SECRET: Optional[str] = Field(None, description="JWT signing secret")
    
    # Trading Configuration
    RISK_MAX_PER_TRADE: float = Field(default=0.01, description="Maximum risk per trade")
    RISK_MAX_DRAWDOWN: float = Field(default=0.05, description="Maximum portfolio drawdown")
    TRADING_MODE: str = Field(default="simulation", description="Trading mode: live, simulation")
    
    # External API Configuration
    EXTERNAL_API_TIMEOUT: int = Field(default=30, description="External API timeout in seconds")
    EXTERNAL_API_RETRIES: int = Field(default=3, description="External API retry attempts")
    
    # Performance Configuration
    WORKER_CONNECTIONS: int = Field(default=1000, description="Worker connection limit")
    WORKER_TIMEOUT: int = Field(default=30, description="Worker timeout in seconds")
    
    # Monitoring Configuration
    ENABLE_METRICS: bool = Field(default=True, description="Enable metrics collection")
    ENABLE_TRACING: bool = Field(default=False, description="Enable distributed tracing")
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )
    
    def get_database_url(self) -> str:
        """Get complete database URL."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        
        password_part = f":{self.DATABASE_PASSWORD}" if self.DATABASE_PASSWORD else ""
        return f"postgresql://{self.DATABASE_USER}{password_part}@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
    
    def get_redis_url(self) -> str:
        """Get complete Redis URL."""
        if self.REDIS_URL:
            return self.REDIS_URL
        
        password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}"
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.FKS_ENVIRONMENT.lower() == "production"
    
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.FKS_ENVIRONMENT.lower() in ("development", "dev")
    
    def get_health_check_response(self, **additional_data) -> FKSHealthCheck:
        """Generate standard health check response."""
        return FKSHealthCheck(
            status="healthy",
            service=self.FKS_SERVICE_NAME,
            service_type=self.FKS_SERVICE_TYPE,
            environment=self.FKS_ENVIRONMENT,
            **additional_data
        )


@lru_cache(maxsize=1)
def get_settings() -> FKSSettings:
    """Get cached settings instance."""
    return FKSSettings()


def reload_settings_cache() -> None:
    """Clear settings cache to force reload."""
    get_settings.cache_clear()


# Service startup helper
def initialize_fks_service() -> FKSSettings:
    """Initialize FKS service with standard configuration."""
    settings = get_settings()
    
    # Create required directories
    os.makedirs(settings.FKS_CONFIG_PATH, exist_ok=True)
    os.makedirs(settings.FKS_DATA_PATH, exist_ok=True)
    
    print(f"🚀 Initializing {settings.FKS_SERVICE_NAME} ({settings.FKS_SERVICE_TYPE})")
    print(f"📊 Environment: {settings.FKS_ENVIRONMENT}")
    print(f"🔌 Port: {settings.FKS_SERVICE_PORT}")
    print(f"🏥 Health Check: {settings.FKS_HEALTH_CHECK_PATH}")
    print(f"📈 Metrics: {settings.FKS_METRICS_PATH}")
    
    return settings


# Export main components
__all__ = [
    "FKSSettings",
    "FKSHealthCheck", 
    "get_settings",
    "reload_settings_cache",
    "initialize_fks_service"
]
