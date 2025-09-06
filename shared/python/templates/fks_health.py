# FKS Python Health Check Template
# Standard health check implementation for all FKS Python services

"""
FKS Python Health Check Template
Provides standardized health check endpoints for all FKS Python microservices.
"""

import asyncio
import time
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel, Field
import psutil
import aiohttp


class HealthStatus:
    """Health status constants."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


class ComponentHealth(BaseModel):
    """Individual component health status."""
    status: str = Field(..., description="Component health status")
    latency_ms: Optional[float] = Field(None, description="Response latency in milliseconds")
    message: Optional[str] = Field(None, description="Health check message")
    last_check: Optional[datetime] = Field(None, description="Last health check timestamp")


class SystemInfo(BaseModel):
    """System information for health checks."""
    cpu_percent: float = Field(..., description="CPU usage percentage")
    memory_percent: float = Field(..., description="Memory usage percentage")
    disk_percent: float = Field(..., description="Disk usage percentage")
    uptime_seconds: float = Field(..., description="Service uptime in seconds")
    process_id: int = Field(..., description="Process ID")


class DetailedHealthResponse(BaseModel):
    """Detailed health check response."""
    status: str = Field(..., description="Overall health status")
    service: str = Field(..., description="Service name")
    service_type: str = Field(..., description="Service type")
    version: str = Field(default="1.0.0", description="Service version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    environment: str = Field(..., description="Environment")
    uptime_seconds: float = Field(..., description="Service uptime")
    components: Dict[str, ComponentHealth] = Field(default_factory=dict)
    system: SystemInfo = Field(..., description="System information")
    dependencies: Dict[str, Any] = Field(default_factory=dict)


class FKSHealthChecker:
    """FKS standard health checker implementation."""
    
    def __init__(self, service_name: str, service_type: str, environment: str):
        self.service_name = service_name
        self.service_type = service_type
        self.environment = environment
        self.start_time = time.time()
        self.router = APIRouter()
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup health check routes."""
        
        @self.router.get("/health")
        async def basic_health():
            """Basic health check endpoint."""
            return {
                "status": HealthStatus.HEALTHY,
                "service": self.service_name,
                "service_type": self.service_type,
                "timestamp": datetime.utcnow().isoformat(),
                "environment": self.environment
            }
        
        @self.router.get("/health/detailed")
        async def detailed_health():
            """Detailed health check with system information."""
            try:
                # System information
                system_info = SystemInfo(
                    cpu_percent=psutil.cpu_percent(interval=1),
                    memory_percent=psutil.virtual_memory().percent,
                    disk_percent=psutil.disk_usage('/').percent,
                    uptime_seconds=time.time() - self.start_time,
                    process_id=os.getpid()
                )
                
                # Component health checks
                components = {}
                
                # Database health check
                db_health = await self._check_database()
                if db_health:
                    components["database"] = db_health
                
                # Redis health check
                cache_health = await self._check_redis()
                if cache_health:
                    components["cache"] = cache_health
                
                # External APIs health check
                external_health = await self._check_external_apis()
                components.update(external_health)
                
                # Determine overall status
                overall_status = self._determine_overall_status(components, system_info)
                
                return DetailedHealthResponse(
                    status=overall_status,
                    service=self.service_name,
                    service_type=self.service_type,
                    environment=self.environment,
                    uptime_seconds=system_info.uptime_seconds,
                    components=components,
                    system=system_info
                )
                
            except Exception as e:
                return DetailedHealthResponse(
                    status=HealthStatus.UNHEALTHY,
                    service=self.service_name,
                    service_type=self.service_type,
                    environment=self.environment,
                    uptime_seconds=time.time() - self.start_time,
                    components={"error": ComponentHealth(
                        status=HealthStatus.UNHEALTHY,
                        message=str(e)
                    )},
                    system=SystemInfo(
                        cpu_percent=0,
                        memory_percent=0,
                        disk_percent=0,
                        uptime_seconds=time.time() - self.start_time,
                        process_id=os.getpid()
                    )
                )
        
        @self.router.get("/health/ready")
        async def readiness_check():
            """Readiness probe for Kubernetes."""
            # Check if service is ready to accept traffic
            try:
                # Basic readiness checks
                db_ok = await self._check_database_connectivity()
                cache_ok = await self._check_redis_connectivity()
                
                if db_ok and cache_ok:
                    return {"status": "ready"}
                else:
                    raise HTTPException(status_code=503, detail="Service not ready")
            except Exception:
                raise HTTPException(status_code=503, detail="Service not ready")
        
        @self.router.get("/health/live")
        async def liveness_check():
            """Liveness probe for Kubernetes."""
            # Check if service is alive (basic functionality)
            return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}
    
    async def _check_database(self) -> Optional[ComponentHealth]:
        """Check database health."""
        try:
            from fks_config import get_settings
            settings = get_settings()
            
            if not settings.DATABASE_URL:
                return None
            
            start_time = time.time()
            # Add your database health check logic here
            # Example: await db.execute("SELECT 1")
            latency = (time.time() - start_time) * 1000
            
            return ComponentHealth(
                status=HealthStatus.HEALTHY,
                latency_ms=latency,
                message="Database connection successful",
                last_check=datetime.utcnow()
            )
        except Exception as e:
            return ComponentHealth(
                status=HealthStatus.UNHEALTHY,
                message=f"Database error: {str(e)}",
                last_check=datetime.utcnow()
            )
    
    async def _check_redis(self) -> Optional[ComponentHealth]:
        """Check Redis health."""
        try:
            from fks_config import get_settings
            settings = get_settings()
            
            if not settings.REDIS_URL:
                return None
            
            start_time = time.time()
            # Add your Redis health check logic here
            # Example: await redis.ping()
            latency = (time.time() - start_time) * 1000
            
            return ComponentHealth(
                status=HealthStatus.HEALTHY,
                latency_ms=latency,
                message="Redis connection successful",
                last_check=datetime.utcnow()
            )
        except Exception as e:
            return ComponentHealth(
                status=HealthStatus.UNHEALTHY,
                message=f"Redis error: {str(e)}",
                last_check=datetime.utcnow()
            )
    
    async def _check_external_apis(self) -> Dict[str, ComponentHealth]:
        """Check external API health."""
        external_apis = {}
        
        # Add your external API checks here
        # Example:
        # try:
        #     async with aiohttp.ClientSession() as session:
        #         start_time = time.time()
        #         async with session.get("https://api.example.com/health") as resp:
        #             latency = (time.time() - start_time) * 1000
        #             if resp.status == 200:
        #                 external_apis["example_api"] = ComponentHealth(
        #                     status=HealthStatus.HEALTHY,
        #                     latency_ms=latency,
        #                     last_check=datetime.utcnow()
        #                 )
        # except Exception as e:
        #     external_apis["example_api"] = ComponentHealth(
        #         status=HealthStatus.UNHEALTHY,
        #         message=str(e),
        #         last_check=datetime.utcnow()
        #     )
        
        return external_apis
    
    async def _check_database_connectivity(self) -> bool:
        """Quick database connectivity check for readiness."""
        try:
            # Add quick database connectivity check
            return True
        except Exception:
            return False
    
    async def _check_redis_connectivity(self) -> bool:
        """Quick Redis connectivity check for readiness."""
        try:
            # Add quick Redis connectivity check
            return True
        except Exception:
            return False
    
    def _determine_overall_status(self, components: Dict[str, ComponentHealth], system: SystemInfo) -> str:
        """Determine overall health status based on components and system metrics."""
        # Check system resources
        if system.cpu_percent > 90 or system.memory_percent > 90 or system.disk_percent > 95:
            return HealthStatus.DEGRADED
        
        # Check component health
        unhealthy_components = [c for c in components.values() if c.status == HealthStatus.UNHEALTHY]
        degraded_components = [c for c in components.values() if c.status == HealthStatus.DEGRADED]
        
        if unhealthy_components:
            return HealthStatus.UNHEALTHY
        elif degraded_components:
            return HealthStatus.DEGRADED
        else:
            return HealthStatus.HEALTHY


# Factory function
def create_health_checker(service_name: str, service_type: str, environment: str) -> FKSHealthChecker:
    """Create a new FKS health checker instance."""
    return FKSHealthChecker(service_name, service_type, environment)


# Export main components
__all__ = [
    "FKSHealthChecker",
    "HealthStatus",
    "ComponentHealth",
    "SystemInfo", 
    "DetailedHealthResponse",
    "create_health_checker"
]
