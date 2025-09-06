# GitHub Repository Structure for Modular Scripts

## Repository Layout

```
nginx/
├── scripts/
│   ├── setup-base.sh           # Base system setup
│   ├── setup-tailscale.sh      # Tailscale configuration
│   ├── setup-nginx.sh          # NGINX installation & config
│   ├── setup-ssl.sh            # SSL/TLS certificates
│   ├── setup-dns.sh            # DNS management
│   ├── setup-github.sh         # GitHub Actions setup
│   ├── setup-monitoring.sh     # Monitoring stack
│   ├── setup-backup.sh         # Backup configuration
│   ├── post-reboot.sh          # Post-reboot tasks
│   ├── 7gram-status.sh         # Status management
│   ├── utils/
│   │   ├── common.sh           # Shared functions
│   │   ├── logging.sh          # Logging utilities
│   │   └── validation.sh       # Validation functions
│   └── templates/
│       ├── nginx/
│       │   ├── nginx.conf
│       │   ├── default-site.conf
│       │   └── ssl-site.conf
│       ├── systemd/
│       │   └── services/
│       └── monitoring/
│           ├── prometheus.yml
│           └── health-check.sh
├── config/
│   └── nginx/
│       ├── sites-available/
│       └── conf.d/
├── html/
│   ├── index.html
│   ├── assets/
│   └── static/
├── .github/
│   └── workflows/
│       └── deploy-nginx.yml
├── docs/
│   ├── deployment.md
│   ├── troubleshooting.md
│   └── api.md
├── tests/
│   ├── integration/
│   ├── unit/
│   └── e2e/
└── README.md
```

## Key Modular Scripts

### 1. scripts/setup-base.sh
- System package installation
- User creation
- Basic security setup
- Firewall configuration

### 2. scripts/setup-nginx.sh
- NGINX installation
- Basic configuration
- Site setup
- Service enablement

### 3. scripts/setup-github.sh
- GitHub deployment user setup
- SSH key generation
- Webhook receiver setup
- Deployment scripts

### 4. scripts/post-reboot.sh
- Tailscale connection
- DNS updates
- Service startup
- Final configuration

## Benefits of This Structure

### ✅ Advantages
1. **Modularity** - Each component can be tested independently
2. **Maintainability** - Easy to update individual components
3. **Versioning** - Can tag specific versions for stability
4. **Reusability** - Scripts can be used in other projects
5. **Size Reduction** - StackScript becomes much smaller
6. **Debugging** - Easier to isolate issues
7. **Collaboration** - Multiple people can work on different modules

### 🎯 Implementation Benefits
1. **Faster StackScript Execution** - Only downloads what's needed
2. **Better Error Handling** - Granular error reporting per module
3. **Selective Updates** - Can update individual components without full redeployment
4. **Testing** - Each script can be tested independently
5. **Documentation** - Each module can have its own documentation

## Script Communication

### Environment Variables
All scripts receive the same environment variables from the StackScript:
- `TAILSCALE_AUTH_KEY`
- `DOMAIN_NAME`
- `ENABLE_SSL`
- `GITHUB_REPO`
- etc.

### Shared State
- Configuration stored in `/etc/nginx-automation/deployment-config.json`
- Logs centralized in `/var/log/linode-setup/`
- Status files for coordination between scripts

### Common Functions
The `utils/common.sh` provides shared functions:
- Logging utilities
- Notification functions
- Error handling
- Validation helpers

## Versioning Strategy

### Production Use
```bash
# Use specific version tag
SCRIPT_VERSION="v3.0.0"
SCRIPT_BASE_URL="https://raw.githubusercontent.com/nuniesmith/nginx/v3.0.0/scripts"
```

### Development Use
```bash
# Use latest from main branch
SCRIPT_VERSION="latest"
SCRIPT_BASE_URL="https://raw.githubusercontent.com/nuniesmith/nginx/main/scripts"
```

### Rollback Capability
```bash
# Emergency rollback to previous version
SCRIPT_VERSION="v2.9.0"
```

## Security Considerations

### Authentication
- Personal Access Token for private repos
- Public repos work without authentication
- Webhook secrets for deployment triggers

### Validation
- Script checksum verification (optional)
- HTTPS-only downloads
- Input validation in each script

### Permissions
- Minimal required permissions for each script
- Separate user for deployment operations
- Sudo rules for specific operations only

## Error Handling Strategy

### Per-Script Errors
Each script handles its own errors and reports status back to the orchestrator.

### Graceful Degradation
Non-critical features (monitoring, backup) can fail without stopping core setup.

### Recovery Mechanisms
- Retry logic for network operations
- Fallback configurations
- Manual recovery procedures documented

## Testing Strategy

### Unit Tests
Test individual functions within each script.

### Integration Tests
Test script interactions and dependencies.

### End-to-End Tests
Full deployment testing in isolated environments.

### Continuous Integration
Automated testing on every commit to validate scripts.