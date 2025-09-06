// FKS React Environment Configuration Template
// Standard environment handling for FKS React/TypeScript applications

export interface FKSEnvironment {
  // FKS Standard Environment Variables
  FKS_SERVICE_NAME: string;
  FKS_SERVICE_TYPE: string;
  FKS_SERVICE_PORT: number;
  FKS_ENVIRONMENT: 'development' | 'staging' | 'production' | 'test';
  FKS_LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  FKS_HEALTH_CHECK_PATH: string;
  FKS_METRICS_PATH: string;
  
  // API Configuration
  API_BASE_URL: string;
  API_TIMEOUT: number;
  API_RETRIES: number;
  
  // Authentication Configuration
  AUTH_ENABLED: boolean;
  AUTH_BASE_URL: string;
  JWT_STORAGE_KEY: string;
  
  // Feature Flags
  ENABLE_ANALYTICS: boolean;
  ENABLE_ERROR_REPORTING: boolean;
  ENABLE_DEBUG_MODE: boolean;
  
  // Trading Configuration
  TRADING_MODE: 'live' | 'simulation' | 'backtest';
  RISK_WARNINGS_ENABLED: boolean;
  
  // UI Configuration
  THEME_MODE: 'light' | 'dark' | 'auto';
  DEFAULT_LANGUAGE: string;
  
  // Performance Configuration
  ENABLE_SERVICE_WORKER: boolean;
  CACHE_STRATEGY: 'aggressive' | 'normal' | 'disabled';
}

export interface FKSHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  service_type: string;
  version: string;
  timestamp: string;
  environment: string;
  uptime_seconds?: number;
  dependencies?: Record<string, any>;
}

class FKSConfig {
  private static instance: FKSConfig;
  private config: FKSEnvironment;

  private constructor() {
    this.config = this.loadEnvironment();
  }

  public static getInstance(): FKSConfig {
    if (!FKSConfig.instance) {
      FKSConfig.instance = new FKSConfig();
    }
    return FKSConfig.instance;
  }

  private loadEnvironment(): FKSEnvironment {
    // Load from environment variables with fallbacks
    const env = import.meta.env || process.env;
    
    return {
      // FKS Standard Environment Variables
      FKS_SERVICE_NAME: env.VITE_FKS_SERVICE_NAME || env.REACT_APP_FKS_SERVICE_NAME || 'fks-web',
      FKS_SERVICE_TYPE: env.VITE_FKS_SERVICE_TYPE || env.REACT_APP_FKS_SERVICE_TYPE || 'frontend',
      FKS_SERVICE_PORT: parseInt(env.VITE_FKS_SERVICE_PORT || env.REACT_APP_FKS_SERVICE_PORT || '3000', 10),
      FKS_ENVIRONMENT: (env.VITE_FKS_ENVIRONMENT || env.REACT_APP_FKS_ENVIRONMENT || env.NODE_ENV || 'development') as FKSEnvironment['FKS_ENVIRONMENT'],
      FKS_LOG_LEVEL: (env.VITE_FKS_LOG_LEVEL || env.REACT_APP_FKS_LOG_LEVEL || 'INFO') as FKSEnvironment['FKS_LOG_LEVEL'],
      FKS_HEALTH_CHECK_PATH: env.VITE_FKS_HEALTH_CHECK_PATH || env.REACT_APP_FKS_HEALTH_CHECK_PATH || '/health',
      FKS_METRICS_PATH: env.VITE_FKS_METRICS_PATH || env.REACT_APP_FKS_METRICS_PATH || '/metrics',
      
      // API Configuration
      API_BASE_URL: env.VITE_API_BASE_URL || env.REACT_APP_API_BASE_URL || 'http://localhost:8001',
      API_TIMEOUT: parseInt(env.VITE_API_TIMEOUT || env.REACT_APP_API_TIMEOUT || '30000', 10),
      API_RETRIES: parseInt(env.VITE_API_RETRIES || env.REACT_APP_API_RETRIES || '3', 10),
      
      // Authentication Configuration
      AUTH_ENABLED: (env.VITE_AUTH_ENABLED || env.REACT_APP_AUTH_ENABLED || 'true').toLowerCase() === 'true',
      AUTH_BASE_URL: env.VITE_AUTH_BASE_URL || env.REACT_APP_AUTH_BASE_URL || 'http://localhost:8002',
      JWT_STORAGE_KEY: env.VITE_JWT_STORAGE_KEY || env.REACT_APP_JWT_STORAGE_KEY || 'fks_jwt_token',
      
      // Feature Flags
      ENABLE_ANALYTICS: (env.VITE_ENABLE_ANALYTICS || env.REACT_APP_ENABLE_ANALYTICS || 'false').toLowerCase() === 'true',
      ENABLE_ERROR_REPORTING: (env.VITE_ENABLE_ERROR_REPORTING || env.REACT_APP_ENABLE_ERROR_REPORTING || 'true').toLowerCase() === 'true',
      ENABLE_DEBUG_MODE: (env.VITE_ENABLE_DEBUG_MODE || env.REACT_APP_ENABLE_DEBUG_MODE || 'false').toLowerCase() === 'true',
      
      // Trading Configuration
      TRADING_MODE: (env.VITE_TRADING_MODE || env.REACT_APP_TRADING_MODE || 'simulation') as FKSEnvironment['TRADING_MODE'],
      RISK_WARNINGS_ENABLED: (env.VITE_RISK_WARNINGS_ENABLED || env.REACT_APP_RISK_WARNINGS_ENABLED || 'true').toLowerCase() === 'true',
      
      // UI Configuration
      THEME_MODE: (env.VITE_THEME_MODE || env.REACT_APP_THEME_MODE || 'auto') as FKSEnvironment['THEME_MODE'],
      DEFAULT_LANGUAGE: env.VITE_DEFAULT_LANGUAGE || env.REACT_APP_DEFAULT_LANGUAGE || 'en',
      
      // Performance Configuration
      ENABLE_SERVICE_WORKER: (env.VITE_ENABLE_SERVICE_WORKER || env.REACT_APP_ENABLE_SERVICE_WORKER || 'true').toLowerCase() === 'true',
      CACHE_STRATEGY: (env.VITE_CACHE_STRATEGY || env.REACT_APP_CACHE_STRATEGY || 'normal') as FKSEnvironment['CACHE_STRATEGY'],
    };
  }

  public get<K extends keyof FKSEnvironment>(key: K): FKSEnvironment[K] {
    return this.config[key];
  }

  public getAll(): Readonly<FKSEnvironment> {
    return { ...this.config };
  }

  public isProduction(): boolean {
    return this.config.FKS_ENVIRONMENT === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.FKS_ENVIRONMENT === 'development';
  }

  public isStaging(): boolean {
    return this.config.FKS_ENVIRONMENT === 'staging';
  }

  public getApiUrl(endpoint: string = ''): string {
    const baseUrl = this.config.API_BASE_URL.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '');
    return cleanEndpoint ? `${baseUrl}/${cleanEndpoint}` : baseUrl;
  }

  public getAuthUrl(endpoint: string = ''): string {
    const baseUrl = this.config.AUTH_BASE_URL.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '');
    return cleanEndpoint ? `${baseUrl}/${cleanEndpoint}` : baseUrl;
  }

  public log(level: FKSEnvironment['FKS_LOG_LEVEL'], message: string, ...args: any[]): void {
    const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    const currentLevel = levels[this.config.FKS_LOG_LEVEL];
    const messageLevel = levels[level];

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${this.config.FKS_SERVICE_NAME}] [${level}]`;
      
      switch (level) {
        case 'DEBUG':
          console.debug(prefix, message, ...args);
          break;
        case 'INFO':
          console.info(prefix, message, ...args);
          break;
        case 'WARN':
          console.warn(prefix, message, ...args);
          break;
        case 'ERROR':
          console.error(prefix, message, ...args);
          break;
      }
    }
  }

  public async checkHealth(): Promise<FKSHealthResponse> {
    const healthUrl = `${window.location.origin}${this.config.FKS_HEALTH_CHECK_PATH}`;
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: 5000,
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status: ${response.status}`);
      }

      const healthData: FKSHealthResponse = await response.json();
      return healthData;
    } catch (error) {
      this.log('ERROR', 'Health check failed:', error);
      
      return {
        status: 'unhealthy',
        service: this.config.FKS_SERVICE_NAME,
        service_type: this.config.FKS_SERVICE_TYPE,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: this.config.FKS_ENVIRONMENT,
        dependencies: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  public initializeService(): void {
    this.log('INFO', `🚀 Initializing ${this.config.FKS_SERVICE_NAME} (${this.config.FKS_SERVICE_TYPE})`);
    this.log('INFO', `📊 Environment: ${this.config.FKS_ENVIRONMENT}`);
    this.log('INFO', `🔌 Port: ${this.config.FKS_SERVICE_PORT}`);
    this.log('INFO', `🏥 Health Check: ${this.config.FKS_HEALTH_CHECK_PATH}`);
    this.log('INFO', `📈 Metrics: ${this.config.FKS_METRICS_PATH}`);
    this.log('INFO', `🌐 API Base URL: ${this.config.API_BASE_URL}`);
    
    // Log feature flags
    if (this.config.ENABLE_DEBUG_MODE) {
      this.log('DEBUG', 'Debug mode enabled');
    }
    
    if (this.config.AUTH_ENABLED) {
      this.log('INFO', `🔐 Authentication enabled: ${this.config.AUTH_BASE_URL}`);
    }
    
    if (this.config.ENABLE_ANALYTICS) {
      this.log('INFO', '📊 Analytics enabled');
    }
    
    this.log('INFO', `🎨 Theme: ${this.config.THEME_MODE}`);
    this.log('INFO', `🌍 Language: ${this.config.DEFAULT_LANGUAGE}`);
    this.log('INFO', `💼 Trading Mode: ${this.config.TRADING_MODE}`);
  }
}

// Singleton instance
export const fksConfig = FKSConfig.getInstance();

// Convenience hooks for React components
export const useFKSConfig = () => {
  return {
    config: fksConfig.getAll(),
    get: <K extends keyof FKSEnvironment>(key: K) => fksConfig.get(key),
    isProduction: () => fksConfig.isProduction(),
    isDevelopment: () => fksConfig.isDevelopment(),
    isStaging: () => fksConfig.isStaging(),
    getApiUrl: (endpoint?: string) => fksConfig.getApiUrl(endpoint),
    getAuthUrl: (endpoint?: string) => fksConfig.getAuthUrl(endpoint),
    log: (level: FKSEnvironment['FKS_LOG_LEVEL'], message: string, ...args: any[]) => 
      fksConfig.log(level, message, ...args),
    checkHealth: () => fksConfig.checkHealth(),
  };
};

// Initialize service when module loads
fksConfig.initializeService();

export default fksConfig;
