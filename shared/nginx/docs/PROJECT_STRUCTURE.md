# Project Structure

This document outlines the organized structure of the NGINX deployment project.

## Root Directory

```text
nginx/
├── deploy                      # Main deployment script entry point
├── docker-compose.yml          # Docker stack configuration
├── Dockerfile                 # Custom NGINX image
├── makefile                   # Build automation
├── .env.example               # Environment configuration template
├── .dockerignore              # Docker build exclusions
├── .gitignore                 # Git exclusions
└── README.md                  # Project documentation
```

## Configuration (`config/`)

```text
config/
├── nginx/                     # NGINX configuration
│   ├── nginx.conf            # Main NGINX config
│   ├── mime.types            # MIME type definitions
│   └── conf.d/               # Site configurations
│       ├── default.conf      # Default site config
│       ├── ssl.conf          # SSL configuration
│       └── *.conf            # Individual site configs
└── certbot/                  # SSL certificate configuration
    └── cloudflare.ini        # Cloudflare API configuration
```

## HTML Content (`html/`)

```text
html/
├── index.html                # Default homepage
├── api/                      # API endpoints
│   ├── health-check.php     # Health check endpoint
│   └── *.php                # Other API files
├── assets/                   # Static assets
│   ├── css/                 # Stylesheets
│   ├── js/                  # JavaScript files
│   └── images/              # Images
├── components/              # Reusable HTML components
└── errors/                  # Error pages
    ├── 404.html
    ├── 500.html
    └── *.html
```

## Scripts (`scripts/`)

```text
scripts/
├── README.md                 # Scripts documentation
├── deployment/               # Main deployment scripts
│   ├── deploy.sh            # Full deployment pipeline
│   ├── setup.sh             # Initial server setup
│   └── tailscale.sh         # Tailscale configuration
├── ssl/                     # SSL management
│   └── lets_encrypt.sh      # Let's Encrypt automation
├── dns/                     # DNS management
│   └── cloudflare-dns-manager.sh
├── utils/                   # Utility functions
│   ├── common.sh            # Shared functions
│   ├── logging.sh           # Logging utilities
│   └── validation.sh        # Input validation
├── templates/               # Script templates
├── setup-*.sh              # Component setup scripts
├── health-monitor.sh        # Health monitoring
├── 7gram-status.sh          # System status
└── rollback.sh              # Deployment rollback
```

## CI/CD (`.github/`)

```text
.github/
└── workflows/               # GitHub Actions workflows
    ├── deploy.yml           # Main deployment workflow
    └── ats-deploy.yml       # ATS deployment workflow
```

## Documentation (`docs/`)

```text
docs/
├── api.md                   # API documentation
├── deployment.md            # Deployment guide
└── troubleshooting.md       # Troubleshooting guide
```

## Monitoring (`monitoring/`)

```text
monitoring/
├── prometheus.yml           # Prometheus configuration
├── alertmanager.yml         # Alert manager configuration
├── blackbox.yml             # Blackbox exporter config
├── alerts/                  # Alert rules
│   ├── nginx-alerts.yml
│   ├── system-alerts.yml
│   └── application-alerts.yml
└── grafana/                 # Grafana configuration
    └── provisioning/
```

## Security (`security/`)

```text
security/
└── setup-security.sh       # Security hardening script
```

## Testing (`tests/`)

```text
tests/
├── test-runner.js           # Test runner
└── k6/                      # Load testing
    └── load-test.js
```

## Usage Examples

### Using the Main Deploy Script

```bash
# Full deployment
./deploy deploy

# Individual components
./deploy ssl
./deploy dns
./deploy status
```

### Using Scripts Directly

```bash
# Deployment scripts
./scripts/deployment/deploy.sh
./scripts/deployment/setup.sh

# SSL management
./scripts/ssl/lets_encrypt.sh

# DNS management
./scripts/dns/cloudflare-dns-manager.sh
```

### Docker Operations

```bash
# Start the stack
docker-compose up -d

# With monitoring
docker-compose --profile monitoring up -d

# With SSL
docker-compose --profile ssl up -d
```

## Environment Configuration

Key configuration files:
- `.env` - Main environment variables
- `config/nginx/` - NGINX configuration
- `monitoring/` - Monitoring stack configuration
- `.github/workflows/` - CI/CD configuration

## Deployment Methods

1. **Manual Deployment**: Using `./deploy` script
2. **Docker Deployment**: Using `docker-compose`
3. **Automated Deployment**: Using GitHub Actions
4. **Component Deployment**: Using individual scripts

This structure provides clear separation of concerns and makes the project maintainable and scalable.
