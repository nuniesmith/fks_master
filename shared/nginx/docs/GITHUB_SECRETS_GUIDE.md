# GitHub Secrets Configuration Guide
# Complete list of secrets needed for all repositories

## 🔐 Required GitHub Secrets

### **NGINX Repository Secrets**
These secrets are needed in your `nginx` repository for cloud deployment:

```bash
# === LINODE CONFIGURATION ===
LINODE_CLI_TOKEN=your_linode_personal_access_token

# === SERVER ACCESS ===
NGINX_ROOT_PASSWORD=your_strong_root_password
ACTIONS_USER_PASSWORD=your_actions_user_password

# === TAILSCALE CONFIGURATION ===
TAILSCALE_AUTH_KEY=your_tailscale_auth_key

# === CLOUDFLARE DNS ===
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ZONE_ID=your_cloudflare_zone_id

# === SSL/TLS ===
SSL_EMAIL=admin@7gram.xyz

# === DOCKER HUB ===
DOCKER_USERNAME=your_docker_hub_username
DOCKER_TOKEN=your_docker_hub_access_token

# === MONITORING ===
NETDATA_CLAIM_TOKEN=your_netdata_claim_token
NETDATA_CLAIM_ROOM=your_netdata_room_id

# === NOTIFICATIONS ===
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

### **SULLIVAN Repository Secrets**
These secrets are needed in your `sullivan` repository:

```bash
# === SERVER ACCESS (same as nginx) ===
# No SSH keys needed - using password authentication

# === NOTIFICATIONS ===
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

### **FREDDY Repository Secrets**
These secrets are needed in your `freddy` repository:

```bash
# === SERVER ACCESS (same as nginx) ===
# No SSH keys needed - using password authentication

# === NOTIFICATIONS ===
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

---

## 📋 How to Obtain Each Secret

### **1. LINODE_CLI_TOKEN**
```bash
# 1. Log into Linode Cloud Manager
# 2. Go to Profile & Account > API Tokens
# 3. Create Personal Access Token with full permissions
# 4. Copy the token (it's only shown once!)
```

### **2. Server Passwords**
```bash
# Generate strong passwords for server access
NGINX_ROOT_PASSWORD=generate_strong_password_here
ACTIONS_USER_PASSWORD=generate_different_strong_password_here

# Use a password manager or generate with:
openssl rand -base64 32

# Make sure to use different passwords for security
# Store them securely in a password manager
```

### **3. TAILSCALE_AUTH_KEY**
```bash
# 1. Log into Tailscale admin console: https://login.tailscale.com/admin
# 2. Go to Settings > Keys
# 3. Generate new auth key
# 4. Select options:
#    - Reusable: Yes
#    - Ephemeral: No  
#    - Preauthorized: Yes
#    - Tags: nginx, cloud, server
# 5. Copy the generated key
```

### **4. CLOUDFLARE_API_TOKEN**
```bash
# 1. Log into Cloudflare dashboard
# 2. Go to My Profile > API Tokens
# 3. Create Custom Token with:
#    - Zone:Read permissions for your zone
#    - DNS:Edit permissions for your zone
#    - Zone Resources: Include Specific zone (your domain)
# 4. Copy the token
```

### **5. CLOUDFLARE_ZONE_ID**
```bash
# 1. In Cloudflare dashboard
# 2. Select your domain (7gram.xyz)
# 3. In right sidebar, copy Zone ID
```

### **6. DOCKER_USERNAME & DOCKER_TOKEN**
```bash
# 1. Log into Docker Hub: https://hub.docker.com
# 2. Go to Account Settings > Security > New Access Token
# 3. Create token with name "github-actions"
# 4. Copy the generated token (it's only shown once!)
# 5. DOCKER_USERNAME = your Docker Hub username
# 6. DOCKER_TOKEN = the generated access token
```

### **7. NETDATA_CLAIM_TOKEN & ROOM**
```bash
# 1. Sign up for Netdata Cloud: https://app.netdata.cloud
# 2. Create a Space (room)
# 3. Go to Connect Nodes
# 4. Copy the claim token and room ID from the connection command
```

### **8. DISCORD_WEBHOOK_URL**
```bash
# 1. Go to your Discord server
# 2. Server Settings > Integrations > Webhooks
# 3. Create New Webhook
# 4. Choose channel (e.g., #deployments)
# 5. Copy Webhook URL
```

### **9. Server Passwords**
```bash
# Generate strong passwords for:
NGINX_ROOT_PASSWORD=generate_strong_password_here
ACTIONS_USER_PASSWORD=generate_different_strong_password_here

# Use a password manager or:
openssl rand -base64 32
```

---

## ⚙️ Setting Up Secrets in GitHub

### **For Each Repository:**

1. **Go to repository on GitHub**
2. **Settings > Secrets and variables > Actions**
3. **Click "New repository secret"**
4. **Add each secret with exact name and value**

### **Nginx Repository Secrets:**
```
LINODE_CLI_TOKEN
NGINX_ROOT_PASSWORD  
ACTIONS_USER_PASSWORD
TAILSCALE_AUTH_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
SSL_EMAIL
DOCKER_USERNAME
DOCKER_TOKEN
NETDATA_CLAIM_TOKEN
NETDATA_CLAIM_ROOM
DISCORD_WEBHOOK_URL
```

### **Sullivan Repository Secrets:**
```
DISCORD_WEBHOOK_URL
```

### **Freddy Repository Secrets:**
```
DISCORD_WEBHOOK_URL
```

---

## 🔒 Security Best Practices

### **Password Authentication**
- Use **different passwords** for root and actions users
- Store passwords securely in password manager
- Use strong passwords (32+ characters)
- Generate passwords with: `openssl rand -base64 32`

### **Tailscale Security**
- Use **preauthorized keys** to avoid manual approval
- Set appropriate **tags** for access control
- Monitor connected devices regularly
- Use **Tailscale IPs only** for DNS records

### **Cloudflare Token**
- Use **least privilege** - only DNS edit permissions
- Scope to **specific zone** only
- Monitor API usage in Cloudflare dashboard
- Rotate tokens every 6 months

### **Password Security**
- Use **different passwords** for root and actions users
- Store in password manager
- Use strong passwords (32+ characters)
- Enable 2FA where possible

### **Docker Hub Security**
- Use **access tokens** instead of passwords
- Scope tokens to specific repositories where possible
- Use least privilege - only push/pull permissions needed
- Rotate tokens every 6 months
- Monitor Docker Hub usage for unauthorized access

---

## 🚀 Deployment Flow

### **How the secrets are used:**

1. **Nginx Deployment:**
   - `LINODE_CLI_TOKEN` → Create/manage cloud server
   - `NGINX_ROOT_PASSWORD` + `ACTIONS_USER_PASSWORD` → Server authentication
   - `TAILSCALE_AUTH_KEY` → Connect server to VPN network
   - `CLOUDFLARE_*` → Update DNS to point to Tailscale IP
   - `SSL_EMAIL` → Generate Let's Encrypt certificates
   - `NETDATA_*` → Connect monitoring
   - `DISCORD_WEBHOOK_URL` → Send deployment notifications

2. **Sullivan/Freddy Updates:**
   - Connect via existing server connection (password auth)
   - From nginx server → SSH to home servers via Tailscale
   - Deploy updates and restart services
   - `DISCORD_WEBHOOK_URL` → Send update notifications

### **Security Model:**
```
GitHub Actions → nginx.7gram.xyz (public IP) → Tailscale → Home Servers
                      ↓
                 Only Tailscale IPs in DNS
                 Only VPN users can access services
```

---

## ✅ Verification Checklist

Before deploying, verify you have:

- [ ] All nginx repository secrets configured
- [ ] All sullivan repository secrets configured  
- [ ] All freddy repository secrets configured
- [ ] Strong passwords generated for server access
- [ ] Tailscale auth key created with correct permissions
- [ ] Cloudflare API token with DNS edit permissions
- [ ] Cloudflare zone ID copied correctly
- [ ] Docker Hub access token created with push permissions
- [ ] Docker Hub username and token configured
- [ ] Netdata account created and tokens obtained
- [ ] Discord webhook created in deployment channel
- [ ] Password authentication enabled on server
- [ ] All secret names match exactly (case sensitive)

---

## 🆘 Troubleshooting

### **Common Issues:**

**Secret name mismatch:**
- Secret names are case-sensitive
- Must match exactly as shown above

**SSH key format:**
- No SSH keys needed with password authentication
- Ensure sshpass is installed in GitHub Actions runner
- Use `sshpass -p "password" ssh` for authentication

**Password authentication:**
- Ensure PasswordAuthentication is enabled in SSH config
- Use strong, unique passwords for each user
- Test authentication locally before deployment

**Tailscale auth key:**
- Must be preauthorized
- Should be reusable for multiple deployments
- Check expiration date

**Cloudflare permissions:**
- Token needs Zone:Read AND DNS:Edit
- Must be scoped to correct zone
- Test token with curl before using

**Discord webhook:**
- URL should start with `https://discord.com/api/webhooks/`
- Test webhook with curl before using

**Docker authentication:**
- Use access tokens, not passwords
- Ensure tokens have correct permissions
- Test login locally: `echo $DOCKER_TOKEN | docker login -u $DOCKER_USERNAME --password-stdin`
- Check token expiration in Docker Hub settings
