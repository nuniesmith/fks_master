#!/bin/bash
# security/setup-security.sh - Comprehensive security setup script

set -euo pipefail

# ============================================================================
# SECURITY CONFIGURATION SCRIPT
# ============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SECURITY_DIR="/etc/7gram-security"
readonly LOG_FILE="/var/log/7gram-security-setup.log"

# Create directories
mkdir -p "$SECURITY_DIR"/{rules,scripts,configs}

# Logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"; }

# ============================================================================
# FAIL2BAN CONFIGURATION
# ============================================================================
setup_fail2ban() {
    log "Setting up Fail2ban..."
    
    # Install fail2ban
    pacman -S --needed --noconfirm fail2ban
    
    # Create custom jail configuration
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# Ban duration and retry settings
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

# Email notifications
destemail = admin@7gram.xyz
sender = fail2ban@7gram.xyz
mta = sendmail
action = %(action_mwl)s

# Whitelist Tailscale network
ignoreip = 127.0.0.1/8 ::1 100.64.0.0/10

[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noproxy]
enabled = true
port = http,https
filter = nginx-noproxy
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-req-limit]
enabled = true
filter = nginx-req-limit
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 60
bantime = 600

# Custom 7gram filters
[7gram-api-abuse]
enabled = true
port = http,https
filter = 7gram-api-abuse
logpath = /var/log/nginx/access.log
maxretry = 100
findtime = 300
bantime = 3600

[7gram-scan-detect]
enabled = true
port = http,https
filter = 7gram-scan-detect
logpath = /var/log/nginx/access.log
maxretry = 3
findtime = 300
bantime = 86400
EOF

    # Create custom filters
    cat > /etc/fail2ban/filter.d/7gram-api-abuse.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* "(GET|POST|PUT|DELETE) /api/.*" (429|503)
ignoreregex =
EOF

    cat > /etc/fail2ban/filter.d/7gram-scan-detect.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* "(GET|POST) /(wp-admin|wp-login|admin|.env|.git|config).* HTTP/.*" (404|403)
            ^<HOST> .* ".*\.\.(/.*)+" \d+
            ^<HOST> .* ".*(<|>|'|%0A|%0D|%27|%3C|%3E|%00).* HTTP/.*" \d+
ignoreregex =
EOF

    # Enable and start fail2ban
    systemctl enable --now fail2ban
    
    log "Fail2ban configured successfully"
}

# ============================================================================
# NGINX SECURITY HEADERS
# ============================================================================
setup_nginx_security() {
    log "Setting up NGINX security configurations..."
    
    # Create security headers configuration
    cat > /etc/nginx/includes/security_headers_strict.conf << 'EOF'
# Strict security headers for maximum protection

# HSTS with preload
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# Content Security Policy
set $csp_default "default-src 'self'";
set $csp_script "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com";
set $csp_style "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com";
set $csp_img "img-src 'self' data: https: blob:";
set $csp_font "font-src 'self' https://fonts.gstatic.com";
set $csp_connect "connect-src 'self' wss: https:";
set $csp_media "media-src 'self' blob:";
set $csp_object "object-src 'none'";
set $csp_frame "frame-src 'self'";
set $csp_worker "worker-src 'self' blob:";
set $csp_manifest "manifest-src 'self'";
set $csp_base "base-uri 'self'";
set $csp_form "form-action 'self'";
set $csp_ancestors "frame-ancestors 'self'";
set $csp_upgrade "upgrade-insecure-requests";

add_header Content-Security-Policy "${csp_default}; ${csp_script}; ${csp_style}; ${csp_img}; ${csp_font}; ${csp_connect}; ${csp_media}; ${csp_object}; ${csp_frame}; ${csp_worker}; ${csp_manifest}; ${csp_base}; ${csp_form}; ${csp_ancestors}; ${csp_upgrade}" always;

# Additional security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()" always;

# Remove sensitive headers
proxy_hide_header X-Powered-By;
proxy_hide_header Server;
more_clear_headers 'Server';
more_clear_headers 'X-Powered-By';
EOF

    # Create rate limiting configuration
    cat > /etc/nginx/includes/rate_limiting_strict.conf << 'EOF'
# Strict rate limiting configuration

# Define rate limit zones
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=upload:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=search:10m rate=20r/m;

# Connection limits
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_conn addr 50;

# Request limits with burst
limit_req zone=general burst=20 nodelay;

# Custom error pages
limit_req_status 429;
limit_conn_status 429;

# Log limits exceeded
limit_req_log_level warn;
limit_conn_log_level warn;
EOF

    # Create ModSecurity configuration
    cat > "$SECURITY_DIR/configs/modsecurity.conf" << 'EOF'
# ModSecurity configuration for NGINX

SecRuleEngine On
SecRequestBodyAccess On
SecResponseBodyAccess On
SecResponseBodyMimeType text/plain text/html text/xml application/json

# Limits
SecRequestBodyLimit 13107200
SecRequestBodyNoFilesLimit 131072
SecRequestBodyInMemoryLimit 131072

# Audit logging
SecAuditEngine RelevantOnly
SecAuditLogRelevantStatus "^(?:5|4(?!04))"
SecAuditLogType Serial
SecAuditLog /var/log/modsecurity/audit.log

# Rules
Include /etc/modsecurity/crs/crs-setup.conf
Include /etc/modsecurity/crs/rules/*.conf

# Custom rules for 7gram
SecRule REQUEST_URI "@streq /api/health" "id:1000,phase:1,nolog,allow"
SecRule REQUEST_HEADERS:Host "@streq 7gram.xyz" "id:1001,phase:1,pass"
EOF

    log "NGINX security configurations created"
}

# ============================================================================
# FIREWALL HARDENING
# ============================================================================
setup_firewall_hardening() {
    log "Hardening firewall configuration..."
    
    # Reset firewall
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    ufw default deny forward
    
    # Allow essential services
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Allow from Tailscale network only for internal services
    ufw allow from 100.64.0.0/10 to any port 9090 comment 'Prometheus'
    ufw allow from 100.64.0.0/10 to any port 3000 comment 'Grafana'
    ufw allow from 100.64.0.0/10 to any port 9093 comment 'Alertmanager'
    
    # Rate limiting
    ufw limit ssh/tcp comment 'Rate limit SSH'
    
    # DDoS protection
    cat > /etc/ufw/before.rules << 'EOF'
# DDoS protection rules
*filter
:ufw-before-input - [0:0]
:ufw-before-output - [0:0]
:ufw-before-forward - [0:0]

# Drop invalid packets
-A ufw-before-input -m conntrack --ctstate INVALID -j DROP

# Drop TCP packets that are new and are not SYN
-A ufw-before-input -p tcp ! --syn -m conntrack --ctstate NEW -j DROP

# Drop SYN packets with suspicious MSS value
-A ufw-before-input -p tcp -m conntrack --ctstate NEW -m tcpmss ! --mss 536:65535 -j DROP

# Block packets with bogus TCP flags
-A ufw-before-input -p tcp --tcp-flags FIN,SYN,RST,PSH,ACK,URG NONE -j DROP
-A ufw-before-input -p tcp --tcp-flags FIN,SYN FIN,SYN -j DROP
-A ufw-before-input -p tcp --tcp-flags SYN,RST SYN,RST -j DROP
-A ufw-before-input -p tcp --tcp-flags FIN,RST FIN,RST -j DROP
-A ufw-before-input -p tcp --tcp-flags FIN,ACK FIN -j DROP
-A ufw-before-input -p tcp --tcp-flags ACK,URG URG -j DROP
-A ufw-before-input -p tcp --tcp-flags ACK,FIN FIN -j DROP
-A ufw-before-input -p tcp --tcp-flags ACK,PSH PSH -j DROP
-A ufw-before-input -p tcp --tcp-flags ALL ALL -j DROP
-A ufw-before-input -p tcp --tcp-flags ALL NONE -j DROP
-A ufw-before-input -p tcp --tcp-flags ALL FIN,PSH,URG -j DROP
-A ufw-before-input -p tcp --tcp-flags ALL SYN,FIN,PSH,URG -j DROP
-A ufw-before-input -p tcp --tcp-flags ALL SYN,RST,ACK,FIN,URG -j DROP

# Limit ICMP
-A ufw-before-input -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 2 -j ACCEPT
-A ufw-before-input -p icmp --icmp-type echo-request -j DROP

# Protection against port scanning
-A ufw-before-input -p tcp --tcp-flags SYN,ACK,FIN,RST RST -m limit --limit 1/s --limit-burst 2 -j DROP

COMMIT
EOF
    
    # Enable firewall
    ufw --force enable
    
    log "Firewall hardening completed"
}

# ============================================================================
# INTRUSION DETECTION
# ============================================================================
setup_intrusion_detection() {
    log "Setting up intrusion detection..."
    
    # Install AIDE
    pacman -S --needed --noconfirm aide
    
    # Configure AIDE
    cat > /etc/aide.conf << 'EOF'
# AIDE configuration for 7gram

database=file:/var/lib/aide/aide.db
database_out=file:/var/lib/aide/aide.db.new
report_url=file:/var/log/aide/aide.log
report_url=stdout

# Rules
FIPSR = p+i+n+u+g+s+m+c+acl+selinux+xattrs+sha256
NORMAL = FIPSR+sha512

# Directories to monitor
/boot NORMAL
/bin NORMAL
/sbin NORMAL
/lib NORMAL
/lib64 NORMAL
/opt NORMAL
/usr NORMAL
/root NORMAL
!/usr/src
!/usr/tmp

/etc NORMAL
!/etc/mtab
!/etc/.*~

# Web content - monitor changes
/var/www/html NORMAL
/etc/nginx NORMAL

# Logs - only check attributes
/var/log p+n+u+g
EOF

    # Initialize AIDE database
    aide --init
    mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db
    
    # Create AIDE check script
    cat > "$SECURITY_DIR/scripts/aide-check.sh" << 'EOF'
#!/bin/bash
# AIDE integrity check script

LOG_FILE="/var/log/aide/aide-check-$(date +%Y%m%d).log"
ALERT_EMAIL="admin@7gram.xyz"

# Run AIDE check
aide --check > "$LOG_FILE" 2>&1
RESULT=$?

if [ $RESULT -ne 0 ]; then
    # Changes detected
    echo "AIDE detected changes on $(hostname)" | mail -s "AIDE Alert" "$ALERT_EMAIL" < "$LOG_FILE"
    
    # Send to monitoring
    curl -X POST http://localhost:9091/metrics/job/aide_check \
        --data-binary @- << METRICS
aide_changes_detected{host="$(hostname)"} 1
aide_last_check{host="$(hostname)"} $(date +%s)
METRICS
fi

# Update database
aide --update
mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db
EOF
    
    chmod +x "$SECURITY_DIR/scripts/aide-check.sh"
    
    # Add to cron
    echo "0 3 * * * $SECURITY_DIR/scripts/aide-check.sh" | crontab -l | crontab -
    
    log "Intrusion detection setup completed"
}

# ============================================================================
# SSL/TLS HARDENING
# ============================================================================
setup_ssl_hardening() {
    log "Hardening SSL/TLS configuration..."
    
    # Generate strong DH parameters
    openssl dhparam -out /etc/nginx/ssl/dhparam-4096.pem 4096
    
    # Create SSL configuration
    cat > /etc/nginx/includes/ssl_params_strict.conf << 'EOF'
# Strict SSL/TLS configuration

# Modern SSL configuration
ssl_protocols TLSv1.3;
ssl_prefer_server_ciphers off;

# Strong ciphers only
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

# SSL optimizations
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

# Strong DH parameters
ssl_dhparam /etc/nginx/ssl/dhparam-4096.pem;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/7gram.xyz/chain.pem;
resolver 1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# SSL early data (0-RTT)
ssl_early_data on;
proxy_set_header Early-Data $ssl_early_data;
EOF

    # Create certificate monitoring script
    cat > "$SECURITY_DIR/scripts/cert-monitor.sh" << 'EOF'
#!/bin/bash
# SSL certificate monitoring script

DOMAINS=("7gram.xyz" "*.7gram.xyz")
ALERT_DAYS=30

for domain in "${DOMAINS[@]}"; do
    cert_file="/etc/letsencrypt/live/${domain}/fullchain.pem"
    
    if [ -f "$cert_file" ]; then
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
        expiry_epoch=$(date -d "$expiry_date" +%s)
        current_epoch=$(date +%s)
        days_left=$(( ($expiry_epoch - $current_epoch) / 86400 ))
        
        if [ $days_left -lt $ALERT_DAYS ]; then
            echo "WARNING: Certificate for $domain expires in $days_left days"
            # Send alert
            curl -X POST http://localhost:9091/metrics/job/ssl_monitor \
                --data-binary "ssl_cert_days_remaining{domain=\"$domain\"} $days_left"
        fi
    fi
done
EOF
    
    chmod +x "$SECURITY_DIR/scripts/cert-monitor.sh"
    
    log "SSL/TLS hardening completed"
}

# ============================================================================
# SECURITY SCANNING
# ============================================================================
setup_security_scanning() {
    log "Setting up security scanning tools..."
    
    # Install security tools
    pacman -S --needed --noconfirm lynis rkhunter clamav
    
    # Configure ClamAV
    freshclam
    systemctl enable --now clamav-freshclam
    systemctl enable --now clamav-daemon
    
    # Create security scan script
    cat > "$SECURITY_DIR/scripts/security-scan.sh" << 'EOF'
#!/bin/bash
# Comprehensive security scanning script

SCAN_DIR="/var/log/security-scans"
mkdir -p "$SCAN_DIR"

DATE=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="$SCAN_DIR/security-scan-$DATE.txt"

echo "Security Scan Report - $DATE" > "$REPORT_FILE"
echo "======================================" >> "$REPORT_FILE"

# Lynis system audit
echo -e "\n[Lynis System Audit]" >> "$REPORT_FILE"
lynis audit system --quick --quiet >> "$REPORT_FILE" 2>&1

# Rootkit check
echo -e "\n[Rootkit Hunter Check]" >> "$REPORT_FILE"
rkhunter --check --skip-keypress --report-warnings-only >> "$REPORT_FILE" 2>&1

# ClamAV scan
echo -e "\n[ClamAV Scan]" >> "$REPORT_FILE"
clamscan -r /var/www /etc/nginx --quiet --infected >> "$REPORT_FILE" 2>&1

# Check for suspicious processes
echo -e "\n[Suspicious Processes]" >> "$REPORT_FILE"
ps aux | grep -E '(nc|netcat|perl|python|ruby|sh|bash).*-[lp]' >> "$REPORT_FILE" 2>&1

# Network connections audit
echo -e "\n[Network Connections]" >> "$REPORT_FILE"
ss -tulpn | grep -v '127.0.0.1\|::1' >> "$REPORT_FILE" 2>&1

# Failed login attempts
echo -e "\n[Failed Login Attempts]" >> "$REPORT_FILE"
journalctl -u sshd --since "24 hours ago" | grep "Failed" | tail -20 >> "$REPORT_FILE" 2>&1

# Send results to monitoring
grep -E "(Warning|Error|INFECTED|Vulnerable)" "$REPORT_FILE" | wc -l | \
    xargs -I {} curl -X POST http://localhost:9091/metrics/job/security_scan \
    --data-binary "security_issues_found {}"

echo "Security scan completed: $REPORT_FILE"
EOF
    
    chmod +x "$SECURITY_DIR/scripts/security-scan.sh"
    
    # Add to cron (daily at 4 AM)
    echo "0 4 * * * $SECURITY_DIR/scripts/security-scan.sh" | crontab -l | crontab -
    
    log "Security scanning setup completed"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================
main() {
    log "Starting security hardening setup..."
    
    setup_fail2ban
    setup_nginx_security
    setup_firewall_hardening
    setup_intrusion_detection
    setup_ssl_hardening
    setup_security_scanning
    
    # Create security status script
    cat > /usr/local/bin/security-status << 'EOF'
#!/bin/bash
echo "=== 7gram Security Status ==="
echo ""
echo "Fail2ban:"
fail2ban-client status | grep "Jail list" || echo "  Not running"
echo ""
echo "Firewall:"
ufw status | head -5
echo ""
echo "SSL Certificates:"
for cert in /etc/letsencrypt/live/*/fullchain.pem; do
    if [ -f "$cert" ]; then
        domain=$(basename $(dirname "$cert"))
        expiry=$(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)
        echo "  $domain: expires $expiry"
    fi
done
echo ""
echo "Recent Security Events:"
grep "Ban" /var/log/fail2ban.log | tail -5
EOF
    
    chmod +x /usr/local/bin/security-status
    
    log "Security hardening completed successfully!"
    log "Run 'security-status' to check security status"
}

# Execute main function
main "$@"