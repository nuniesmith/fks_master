# NGINX Reverse Proxy - 7gram Network

A comprehensive, production-ready NGINX deployment system with SSL automation, monitoring, backups, and zero-downtime deployments. Based on successful ATS project architecture.

## 🎯 Overview

This nginx setup provides a complete reverse proxy solution for routing traffic between your cloud Linode server and your home servers (Sullivan & Freddy) via Tailscale.

### 🏗️ Architecture

```
Internet → nginx.7gram.xyz (Linode Cloud) → Tailscale Network → Home Servers
                                              ↓
                                         Sullivan (Media/AI)
                                         Freddy (Infrastructure)
```

### Deployment Approaches

This project provides three deployment approaches:

- **🐳 Docker Stack**: Container-based deployment with Docker Compose
- **🚀 StackScript Deployment**: Direct server deployment with modular setup scripts
- **🏠 Home Server Integration**: Nginx configuration for Sullivan and Freddy servers

Choose the approach that best fits your infrastructure needs.

---

## 🐳 Docker Stack Deployment

## 🚀 Quick Start

### Docker Deployment

```bash
git clone https://github.com/nuniesmith/nginx.git
cd nginx
cp .env.example .env
# Edit .env with your configuration
docker-compose --profile ssl --profile monitoring up -d
```

### Script-Based Deployment

```bash
git clone https://github.com/nuniesmith/nginx.git
cd nginx
# Run full deployment
./deploy deploy

# Or setup individual components
./deploy ssl          # SSL certificates
./deploy dns          # DNS configuration
./deploy status       # Check system status
```

### GitHub Actions Deployment

```bash
# Push to main branch to trigger automated deployment
git push origin main
```

---

## 🌐 URL Routing

### Main Routes (via nginx.7gram.xyz or 7gram.xyz)

- **/** → Sullivan (Dashboard)
- **/media**, **/downloads**, **/ai** → Sullivan
- **/auth**, **/dns** → Freddy

### Subdomain Routes

- **sullivan.7gram.xyz** → Direct to Sullivan
- **freddy.7gram.xyz** → Direct to Freddy

### Service-Specific Routes

**Sullivan Services:**
- `/emby` → Emby Media Server
- `/jellyfin` → Jellyfin Media Server  
- `/plex` → Plex Media Server
- `/sonarr` → TV Show Management
- `/radarr` → Movie Management
- `/qbittorrent` → Torrent Client
- `/ai` → Open WebUI (AI Interface)
- `/portainer` → Container Management

**Freddy Services:**
- `/dns` → Pi-hole DNS Management
- `/auth` → Authelia Authentication
- `/home` → Home Assistant
- `/sync` → Syncthing File Sync
- `/portainer` → Container Management

---

## 🏠 Home Server Integration

### Sullivan Server (Media/AI)

```bash
# In your sullivan project directory
# Copy the nginx configuration files to config/
cp nginx.conf config/
cp proxy-*.conf config/

# Update docker-compose.yml to include the nginx service
# (Use the nginx-service.yml as reference)

# Deploy
docker-compose up -d nginx
```

### Freddy Server (Infrastructure)

```bash
# In your freddy project directory
# Copy the nginx configuration files to config/
cp nginx.conf config/
cp proxy-*.conf config/

# Update docker-compose.yml to include the nginx service
# (Use the nginx-service.yml as reference)

# Deploy
docker-compose up -d nginx
```

### Home Server Health Checks

```bash
# Home servers
docker-compose up -d nginx              # Start nginx
docker-compose restart nginx            # Restart nginx  
docker-compose logs -f nginx            # View logs
curl http://localhost/health             # Health check
```

### 📁 Project Structure

```text
nginx/
├── deploy                 # Main deployment script
├── docker-compose.yml     # Docker stack
├── config/               # NGINX configuration
├── scripts/              # All deployment scripts
│   ├── deployment/       # Main deployment scripts
│   ├── ssl/             # SSL management
│   ├── dns/             # DNS management
│   └── utils/           # Utility functions
├── html/                # Web content
├── monitoring/          # Monitoring stack
└── .github/workflows/   # CI/CD pipelines
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed documentation.
- **Automated SSL/TLS** - Let's Encrypt with auto-renewal (HTTP/DNS validation)
- **Container Orchestration** - Modular Docker Compose profiles
- **Monitoring Stack** - Prometheus, Grafana, and health checks
- **Backup System** - Automated backups with S3 integration
- **Blue-Green Deployments** - Zero-downtime updates

### Configuration

#### Essential Environment Variables

```bash
# Domain & SSL
DOMAIN_NAME=nginx.7gram.xyz           # Primary domain
SSL_EMAIL=admin@7gram.xyz             # Email for SSL certificates
SSL_METHOD=http                       # 'http' or 'dns'

# Ports
HTTP_PORT=80
HTTPS_PORT=443
ALTERNATIVE_PORTS=false               # Use 8080/8443 for StackScript integration

# Tailscale Integration
TAILSCALE_AUTH_KEY=tskey-auth-...     # Tailscale authentication key

# Upstream Servers (Tailscale hostnames)
SULLIVAN_HOST=sullivan.tailfef10.ts.net
FREDDY_HOST=freddy.tailfef10.ts.net

# Cloudflare (for DNS validation)
CLOUDFLARE_EMAIL=admin@7gram.xyz
CLOUDFLARE_API_KEY=your-api-key
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ZONE_ID=your_zone_id

# Monitoring
DD_API_KEY=your-datadog-key
GRAFANA_USER=admin
GRAFANA_PASSWORD=secure-password

# Backups
BACKUP_SCHEDULE=0 2 * * *             # Daily at 2 AM
BACKUP_RETENTION=7                    # Keep 7 days
BACKUP_S3_BUCKET=my-backup-bucket

# GitHub Integration
GITHUB_REPO=nuniesmith/nginx
DISCORD_WEBHOOK=your-discord-webhook-url
```

### Service Profiles

| Profile | Services | Purpose |
|---------|----------|---------|
| `ssl` | Certbot, SSL management | Certificate automation |
| `monitoring` | Prometheus, Grafana | Metrics and dashboards |
| `backup` | Backup service | Data protection |
| `admin` | Portainer | Container management |
| `dev` | Live reload, watchers | Development |
| `php` | PHP-FPM | Dynamic content |
| `blue-green` | Dual containers | Zero-downtime deployments |

#### Deployment Examples
```bash
# Development
docker-compose --profile dev --profile php up -d

# Production
docker-compose --profile ssl --profile monitoring --profile backup up -d

# Full stack
docker-compose --profile ssl --profile monitoring --profile backup --profile admin up -d
```

### SSL Management

#### HTTP Validation (Default)
```bash
SSL_METHOD=http
```
- Domain must point to your server
- Automatic ACME challenge handling

#### DNS Validation (Cloudflare)
```bash
SSL_METHOD=dns
CLOUDFLARE_EMAIL=admin@example.com
CLOUDFLARE_API_KEY=your-global-api-key
```
- Works without DNS pointing to server
- Perfect for staging environments

#### Certificate Operations
```bash
# Check status
docker-compose exec certbot certbot certificates

# Force renewal
docker-compose exec certbot certbot renew --force-renewal

# Test renewal
docker-compose exec certbot certbot renew --dry-run
```

### Website Management

#### Adding New Sites
```bash
# 1. Create configuration
cp config/nginx/sites-available/domain.template config/nginx/sites-available/newsite.com
sed -i 's/DOMAIN_NAME/newsite.com/g' config/nginx/sites-available/newsite.com

# 2. Enable site
ln -s ../sites-available/newsite.com config/nginx/sites-enabled/newsite.com

# 3. Create content
mkdir -p html/newsite.com
echo "<h1>Welcome to newsite.com</h1>" > html/newsite.com/index.html

# 4. Reload NGINX
docker-compose exec nginx nginx -s reload
```

### Monitoring & Access

- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090  
- **Portainer**: http://localhost:9000

### Management Commands

```bash
# Container operations
docker-compose ps
docker-compose logs -f nginx
docker-compose restart nginx

# NGINX operations
docker-compose exec nginx nginx -t
docker-compose exec nginx nginx -s reload

# Maintenance
make update     # Update all containers
make clean      # Clean old images
make restart    # Full restart
```

---

## 🚀 StackScript Deployment

### Quick Start

1. **Create Linode with StackScript**
   - Use the provided StackScript
   - Configure required UDFs (User Defined Fields)
   - Deploy and wait for automatic setup

2. **Configure GitHub Integration**
   - Add SSH deploy key to repository
   - Set up GitHub Actions secrets
   - Push changes to trigger deployments

### Core Features

- **Modular Architecture** - Testable, maintainable components
- **Automated Deployment** - GitHub Actions with webhook integration
- **Security Hardening** - UFW firewall, fail2ban, SSH keys
- **Tailscale Integration** - Secure VPN access
- **Comprehensive Monitoring** - Health checks and alerting
- **DNS Management** - Cloudflare integration
- **Backup System** - Full, incremental, and configuration backups

### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `TAILSCALE_AUTH_KEY` | Tailscale authentication key | `tskey-auth-...` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DOMAIN_NAME` | Primary domain | `7gram.xyz` |
| `SSL_EMAIL` | Email for SSL certificates | `admin@7gram.xyz` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | - |
| `GITHUB_REPO` | GitHub repository | `nuniesmith/nginx` |
| `DISCORD_WEBHOOK` | Discord webhook URL | - |

### Management Commands

#### System Status
```bash
7gram-status                    # Full system status
7gram-status quick             # Quick health check
7gram-status services          # Service status only
```

#### Deployment Management
```bash
sudo -u github-deploy /opt/nginx-deployment/deploy.sh
sudo -u github-deploy /opt/nginx-deployment/deploy.sh rollback
```

#### Backup Management
```bash
/opt/backups/backup-system.sh full      # Full system backup
/opt/backups/backup-system.sh quick     # Configuration backup
/opt/backups/restore-backup.sh          # Interactive restore
```

#### SSL Management
```bash
ssl-check                      # Check certificate status
ssl-renew                      # Manual renewal
```

#### DNS Management
```bash
update-cloudflare-dns <ip> <subdomain>
update-cloudflare-dns 100.64.1.100 www
```

---

## 🏗 Project Structure

```
nginx/
├── docker-compose.yml          # Docker orchestration
├── .env.example               # Environment template
├── deploy.sh                  # Deployment automation
├── Makefile                   # Convenience commands
├── scripts/                   # StackScript modules
│   ├── setup-base.sh         # Base system setup
│   ├── setup-tailscale.sh    # Tailscale VPN
│   ├── setup-nginx.sh        # NGINX installation
│   ├── setup-ssl.sh          # SSL certificates
│   ├── setup-monitoring.sh   # Monitoring stack
│   ├── setup-backup.sh       # Backup system
│   └── utils/common.sh       # Shared functions
├── config/nginx/              # NGINX configurations
│   ├── nginx.conf            # Main configuration
│   ├── sites-available/      # Available sites
│   ├── sites-enabled/        # Enabled sites
│   └── includes/             # Reusable configs
├── html/                      # Website content
├── ssl/                       # SSL certificates
├── monitoring/                # Prometheus & Grafana
├── logs/                      # Application logs
├── backups/                   # Local backups
└── .github/workflows/         # GitHub Actions
```

---

## 🔒 Security Features

### Network Security
- **UFW Firewall** - Restricted port access
- **Tailscale VPN** - Secure service access
- **Fail2ban** - Automatic IP banning
- **SSH Key Authentication** - Passwordless access

### SSL/TLS Security
- **Let's Encrypt Integration** - Automated certificates
- **Modern TLS Configuration** - TLS 1.2+ with secure ciphers
- **Security Headers** - HSTS, CSP, and security headers
- **Certificate Monitoring** - Expiration alerts

### Application Security
- **Rate Limiting** - DDoS protection
- **Security Headers** - Comprehensive header configuration
- **Access Control** - User isolation and sudo restrictions

---

## 📊 Monitoring & Alerting

### Built-in Monitoring
- System metrics (CPU, memory, disk, network)
- Service health (NGINX, Tailscale, monitoring)
- Application health (HTTP/HTTPS endpoints)
- SSL certificate expiration
- Backup success/failure tracking
- DNS resolution monitoring

### Alerting Channels
- **Discord Webhooks** - Real-time notifications
- **Email Alerts** - Critical system alerts
- **Log Monitoring** - Centralized logging

### Access Points
- **Grafana Dashboard** - Visual metrics and alerts
- **Prometheus** - Raw metrics and queries
- **System Status** - Command-line status checks

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Deploy NGINX Stack
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          ssh user@server "cd /opt/nginx && ./deploy.sh deploy"
```

### Required Secrets
```
SSH_PRIVATE_KEY: <deployment key>
SSH_USER: github-deploy
SSH_HOST: <server IP>
DISCORD_WEBHOOK_URL: <optional notifications>
```

### Deployment Flow
1. **Code Push** → GitHub Actions trigger
2. **Security Scan** → Code analysis
3. **Build & Test** → Validation
4. **Deploy** → SSH deployment
5. **Health Check** → Verification
6. **Notify** → Status notifications

---

## 💾 Backup Strategy

### Backup Types

| Type | Frequency | Content | Retention |
|------|-----------|---------|-----------|
| **Full System** | Weekly | All configurations, content, logs | 30 days |
| **Configuration** | Daily | NGINX config, SSL certs | 30 days |
| **Incremental** | 15 minutes | Changed files only | 14 days |
| **Deployment** | Per deploy | Pre-deployment state | 20 recent |

### Backup Features
- **Automated Scheduling** - Cron-based backups
- **Integrity Verification** - Automatic validation
- **Cloud Storage** - S3 integration
- **Point-in-Time Recovery** - Multiple restore points
- **Monitoring & Alerts** - Backup failure notifications

---

## 🛠 Troubleshooting

### Common Issues

#### Service Startup Problems
```bash
# Check service status
systemctl status nginx
7gram-status services

# Review logs
journalctl -u nginx -f
tail -f /var/log/nginx/error.log
```

#### SSL Certificate Issues
```bash
# Check certificate status
ssl-check
certbot certificates

# Test domain accessibility
curl -I http://your-domain.com/.well-known/acme-challenge/test
```

#### Deployment Failures
```bash
# Check deployment logs
journalctl -u webhook-receiver -f

# Manual deployment
sudo -u github-deploy /opt/nginx-deployment/deploy.sh

# Repository status
cd /opt/nginx-deployment && git status
```

#### Network Connectivity & Tailscale
```bash
# Test Tailscale
tailscale-status
tailscale ping <peer>

# On cloud server
docker-compose exec tailscale tailscale status

# Test upstream connectivity from cloud server
curl -I http://sullivan.tailfef10.ts.net/health
curl -I http://freddy.tailfef10.ts.net/health

# Check firewall
ufw status
ss -tlnp | grep :80
```

#### Service Health Checks
```bash
# Cloud nginx
curl http://localhost/health
curl https://nginx.7gram.xyz/health

# Home servers
curl http://sullivan.tailfef10.ts.net/health
curl http://freddy.tailfef10.ts.net/health
```

### DNS Configuration Issues

In Cloudflare, ensure your domains point to the Tailscale IP of your cloud nginx server:

```
nginx.7gram.xyz → [Tailscale IP of cloud server]
*.7gram.xyz → [Tailscale IP of cloud server]
```

### Migration from Old Setup

1. **Backup Current Configuration**
2. **Stop Old Services**: `docker-compose down`
3. **Replace docker-compose.yml**: Use the new simplified version
4. **Update Configuration**: Copy new nginx configs
5. **Deploy**: `./deploy prod`
6. **Test**: Verify all routes work correctly

### Log Locations

| Component | Location |
|-----------|----------|
| Setup | `/var/log/linode-setup/` |
| NGINX | `/var/log/nginx/` |
| System | `journalctl -u <service>` |
| Deployment | `/var/log/webhook-receiver.log` |
| Backups | `/var/log/backups/` |
| SSL | `/var/log/letsencrypt/` |

---

## 🚀 Advanced Configuration

### Load Balancing
```nginx
upstream backend {
    server backend1:80 weight=3;
    server backend2:80 weight=1;
    keepalive 32;
}

server {
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Rate Limiting
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
}
```

### Multi-Environment
```bash
# Production
docker-compose --env-file .env.prod up -d

# Staging  
docker-compose --env-file .env.staging up -d

# Development
docker-compose --env-file .env.dev --profile dev up -d
```

---

## 📚 Prerequisites & Requirements

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+, Debian 10+, Arch Linux)
- **Docker**: Engine 20.10+ and Compose 2.0+ (for Docker deployment)
- **Memory**: 2GB+ RAM recommended
- **Storage**: 20GB+ available space
- **Network**: Ports 80 and 443 available

### External Dependencies
- Domain name with DNS control
- Cloudflare account (for DNS validation, optional)
- GitHub account (for CI/CD integration)
- Tailscale account (for StackScript deployment)

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/new-feature`
3. **Test** changes thoroughly
4. **Update** documentation
5. **Submit** a pull request

### Development Guidelines
- Test scripts with `--dry-run` when available
- Validate NGINX configurations: `nginx -t`
- Update documentation for new features
- Follow existing code style and patterns

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Resources

### Getting Help
- **System Status**: `7gram-status` (StackScript) or `docker-compose ps` (Docker)
- **Documentation**: Check project wiki and `/docs/` directory
- **Issues**: [GitHub Issues](https://github.com/nuniesmith/nginx/issues)
- **Logs**: Review relevant log files for detailed error information

### External Documentation
- [NGINX Documentation](https://nginx.org/en/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)

### Version History
- **v3.0.0**: Modular architecture, enhanced monitoring and security
- **v2.1.0**: GitHub Actions integration, automated deployment
- **v2.0.0**: SSL automation, comprehensive backup system
- **v1.0.0**: Basic NGINX setup with container orchestration

---

## 📖 Based on ATS Success Pattern

This setup replicates the successful patterns from your ATS project:

- ✅ Clean Docker architecture
- ✅ Environment-based configuration  
- ✅ Tailscale integration
- ✅ Automated SSL management
- ✅ Health monitoring
- ✅ Simple deployment scripts

### Updates & Maintenance

- **Regular Updates**: `./deploy update`
- **SSL Renewal**: Automatic via certbot
- **Log Rotation**: Configured automatically
- **Backups**: Include SSL certificates and configs
# Trigger deployment after fixing SSL script syntax errors
# Trigger deployment after fixing shell variable escaping issues
