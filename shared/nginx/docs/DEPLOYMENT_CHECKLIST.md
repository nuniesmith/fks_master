# NGINX Setup Deployment Checklist

## Phase 1: Cloud Nginx (Linode Server)

### ✅ Pre-deployment
- [ ] Copy `.env.example` to `.env`
- [ ] Configure all environment variables in `.env`:
  - [ ] `DOMAIN_NAME=nginx.7gram.xyz`
  - [ ] `TAILSCALE_AUTH_KEY=your_key`
  - [ ] `CLOUDFLARE_API_TOKEN=your_token`
  - [ ] `CLOUDFLARE_ZONE_ID=your_zone_id`
  - [ ] `SSL_EMAIL=admin@7gram.xyz`
- [ ] Replace old `docker-compose.yml` with `docker-compose.yml`
- [ ] Replace old nginx config with `nginx.new.conf`
- [ ] Replace old server config with `7gram.new.conf`

### ✅ Deployment
- [ ] Make deploy script executable: `chmod +x deploy.sh`
- [ ] Stop old services: `./deploy.sh stop`
- [ ] Deploy new setup: `./deploy.sh prod`
- [ ] Check status: `./deploy.sh status`

### ✅ Testing
- [ ] Health check: `curl http://localhost/health`
- [ ] SSL check: `curl https://nginx.7gram.xyz/health`
- [ ] Tailscale status: `docker-compose exec tailscale tailscale status`

## Phase 2: Sullivan Server (Media/AI)

### ✅ Configuration
- [ ] Copy nginx config files to sullivan project:
  - [ ] `config/nginx.conf`
  - [ ] `config/proxy-common.conf`
  - [ ] `config/proxy-media.conf`
  - [ ] `config/proxy-websocket.conf`

### ✅ Docker Integration
- [ ] Add nginx service to `docker-compose.yml` (use `nginx-service.yml` as reference)
- [ ] Add nginx_logs volume
- [ ] Ensure all services are on sullivan-network

### ✅ Deployment
- [ ] Deploy nginx: `docker-compose up -d nginx`
- [ ] Check logs: `docker-compose logs -f nginx`
- [ ] Health check: `curl http://localhost/health`

### ✅ Testing
- [ ] Test local access: `curl http://sullivan.tailfef10.ts.net/health`
- [ ] Test from cloud: Test via cloud nginx proxy

## Phase 3: Freddy Server (Infrastructure)

### ✅ Configuration
- [ ] Copy nginx config files to freddy project:
  - [ ] `config/nginx.conf`
  - [ ] `config/proxy-common.conf`
  - [ ] `config/proxy-websocket.conf`

### ✅ Docker Integration
- [ ] Add nginx service to `docker-compose.yml` (use `nginx-service.yml` as reference)
- [ ] Add nginx_logs volume
- [ ] Ensure all services are on freddy-network

### ✅ Deployment
- [ ] Deploy nginx: `docker-compose up -d nginx`
- [ ] Check logs: `docker-compose logs -f nginx`
- [ ] Health check: `curl http://localhost/health`

### ✅ Testing
- [ ] Test local access: `curl http://freddy.tailfef10.ts.net/health`
- [ ] Test from cloud: Test via cloud nginx proxy

## Phase 4: End-to-End Testing

### ✅ DNS Configuration
- [ ] Update Cloudflare DNS:
  - [ ] `nginx.7gram.xyz` → [Cloud server Tailscale IP]
  - [ ] `*.7gram.xyz` → [Cloud server Tailscale IP]

### ✅ Route Testing
- [ ] Main domain: `https://7gram.xyz/health`
- [ ] Nginx subdomain: `https://nginx.7gram.xyz/health`
- [ ] Sullivan subdomain: `https://sullivan.7gram.xyz/health`
- [ ] Freddy subdomain: `https://freddy.7gram.xyz/health`

### ✅ Service-Specific Testing
**Sullivan Services:**
- [ ] `/emby` → Emby interface loads
- [ ] `/jellyfin` → Jellyfin interface loads
- [ ] `/sonarr` → Sonarr interface loads
- [ ] `/radarr` → Radarr interface loads
- [ ] `/ai` → AI interface loads

**Freddy Services:**
- [ ] `/dns` → Pi-hole interface loads
- [ ] `/auth` → Authelia interface loads
- [ ] `/home` → Home Assistant loads
- [ ] `/sync` → Syncthing interface loads

### ✅ SSL Testing
- [ ] SSL certificate valid: `curl -I https://nginx.7gram.xyz`
- [ ] HTTPS redirect working: `curl -I http://nginx.7gram.xyz`
- [ ] Security headers present

## Phase 5: Monitoring & Maintenance

### ✅ Monitoring Setup
- [ ] Netdata accessible on cloud server
- [ ] All health endpoints responding
- [ ] Log collection working

### ✅ Backup Strategy
- [ ] SSL certificates backed up
- [ ] Configuration files in git
- [ ] Docker volumes backed up

## 🚨 Rollback Plan

If anything goes wrong:

1. **Stop new services:**
   ```bash
   docker-compose down
   ```

2. **Restore old configuration:**
   ```bash
   git checkout HEAD~1 docker-compose.yml
   git checkout HEAD~1 config/
   ```

3. **Restart old services:**
   ```bash
   docker-compose up -d
   ```

## 📞 Support Commands

### Debug Commands
```bash
# Check all container status
docker-compose ps

# View all logs
docker-compose logs -f

# Test Tailscale connectivity
docker-compose exec tailscale tailscale ping sullivan
docker-compose exec tailscale tailscale ping freddy

# Check nginx configuration
docker-compose exec nginx nginx -t

# Reload nginx configuration
docker-compose exec nginx nginx -s reload
```

### Health Check URLs
- Cloud: `https://nginx.7gram.xyz/health`
- Sullivan: `http://sullivan.tailfef10.ts.net/health`
- Freddy: `http://freddy.tailfef10.ts.net/health`
