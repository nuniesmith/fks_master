# SSL/HTTPS Setup Guide

This guide covers the two-phase approach for setting up HTTPS on the nginx server.

## Phase 1: Self-Signed Certificates (Immediate HTTPS)

The GitHub Actions workflow automatically generates self-signed SSL certificates during deployment. This provides immediate HTTPS functionality without requiring DNS validation or external certificate authorities.

### What happens during deployment:

1. **Certificate Generation**: Self-signed certificates are generated with:
   - Primary domain: `7gram.xyz`
   - Wildcard support: `*.7gram.xyz`
   - Alternative names: `www.7gram.xyz`, `nginx.7gram.xyz`, `localhost`
   - Validity: 365 days

2. **NGINX Configuration**: 
   - HTTP traffic redirects to HTTPS (except health checks and ACME challenges)
   - HTTPS serves the dashboard with self-signed certificates
   - Modern SSL/TLS configuration (TLS 1.2/1.3)

3. **Docker Integration**: SSL certificates are mounted into the container from `/etc/nginx/ssl`

### Accessing the site:

- **HTTP**: http://7gram.xyz (redirects to HTTPS)
- **HTTPS**: https://7gram.xyz (self-signed certificate - browser warning expected)
- **Health check**: http://7gram.xyz/health (no redirect)

### Browser warnings:

Self-signed certificates will show security warnings in browsers. This is expected and safe for testing, but should be upgraded to Let's Encrypt for production use.

## Phase 2: Let's Encrypt Certificates (Production Ready)

Once the basic HTTPS setup is working, upgrade to Let's Encrypt certificates for production use.

### Prerequisites:

1. Domain must be properly configured in DNS
2. Server must be accessible on ports 80 and 443
3. Basic HTTPS setup must be working

### Upgrade process:

1. **SSH into the server**:
   ```bash
   ssh actions_user@YOUR_SERVER_IP
   ```

2. **Run the upgrade script**:
   ```bash
   cd nginx-app
   sudo bash scripts/upgrade-to-letsencrypt.sh
   ```

3. **Verify the upgrade**:
   ```bash
   curl -I https://7gram.xyz
   # Should show a valid Let's Encrypt certificate
   ```

### What the upgrade script does:

1. Installs certbot
2. Temporarily stops NGINX
3. Obtains Let's Encrypt certificates
4. Updates NGINX configuration
5. Restarts NGINX with valid certificates
6. Sets up automatic renewal

### Automatic renewal:

The upgrade script configures automatic certificate renewal:
- **Frequency**: Twice daily (00:00 and 12:00)
- **Command**: `certbot renew`
- **Service**: `certbot-renewal.timer`

## Configuration Files

### Current configuration:

- **HTTP Config**: `config/nginx/conf.d/7gram.http.conf` (disabled after SSL setup)
- **HTTPS Config**: `config/nginx/conf.d/7gram.https.conf` (active)
- **Docker Compose**: `docker-compose-ssl.yml` (with SSL mounts)

### SSL certificate locations:

- **Self-signed**: `/etc/nginx/ssl/`
- **Let's Encrypt**: `/etc/letsencrypt/live/7gram.xyz/`

## Troubleshooting

### Self-signed certificate issues:

```bash
# Check certificate validity
openssl x509 -in /etc/nginx/ssl/7gram.xyz.crt -text -noout

# Test HTTPS locally
curl -k -I https://localhost

# Check NGINX logs
docker logs nginx-proxy
```

### Let's Encrypt issues:

```bash
# Check certbot logs
sudo journalctl -u certbot-renewal

# Test certificate renewal
sudo systemctl start certbot-renewal.service

# Check certificate details
sudo certbot certificates
```

### NGINX configuration issues:

```bash
# Test configuration
docker exec nginx-proxy nginx -t

# Reload configuration
docker compose restart nginx
```

## Security Notes

1. **Self-signed certificates** are suitable for:
   - Development and testing
   - Internal networks
   - Temporary setups

2. **Let's Encrypt certificates** are required for:
   - Production environments
   - Public-facing websites
   - Browser compatibility

3. **SSL configuration** includes:
   - Modern TLS protocols (1.2/1.3)
   - Secure cipher suites
   - Security headers
   - HSTS (after Let's Encrypt upgrade)

## Next Steps

1. **Deploy with self-signed certificates** (automatic via GitHub Actions)
2. **Verify HTTPS is working** (expect browser warnings)
3. **Test the dashboard functionality**
4. **Upgrade to Let's Encrypt** when ready for production
5. **Monitor certificate renewal** (automatic after upgrade)

The two-phase approach ensures you have immediate HTTPS functionality while providing a clear path to production-ready certificates.
