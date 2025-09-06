# includes/maps.inc
# Centralized maps to be included once from nginx.conf

# WebSocket upgrade handling
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# Cache control based on content type - Optimized for dashboard
map $sent_http_content_type $cache_control_header {
    "text/html"                          "public, max-age=300, must-revalidate";
    "text/html; charset=utf-8"           "public, max-age=300, must-revalidate";
    "application/json"                   "public, max-age=60, must-revalidate";
    "application/json; charset=utf-8"    "public, max-age=60, must-revalidate";
    "text/css"                           "public, max-age=31536000, immutable";
    "application/javascript"             "public, max-age=31536000, immutable";
    "application/x-javascript"           "public, max-age=31536000, immutable";
    "image/jpeg"                         "public, max-age=31536000";
    "image/jpg"                          "public, max-age=31536000";
    "image/png"                          "public, max-age=31536000";
    "image/gif"                          "public, max-age=31536000";
    "image/webp"                         "public, max-age=31536000";
    "image/svg+xml"                      "public, max-age=31536000";
    "image/x-icon"                       "public, max-age=31536000";
    "font/woff"                          "public, max-age=31536000, immutable";
    "font/woff2"                         "public, max-age=31536000, immutable";
    "font/ttf"                           "public, max-age=31536000, immutable";
    "font/otf"                           "public, max-age=31536000, immutable";
    "application/font-woff"              "public, max-age=31536000, immutable";
    "application/font-woff2"             "public, max-age=31536000, immutable";
    "video/mp4"                          "public, max-age=604800";
    "video/webm"                         "public, max-age=604800";
    "audio/mpeg"                         "public, max-age=604800";
    "audio/mp4"                          "public, max-age=604800";
    "audio/flac"                         "public, max-age=604800";
    "audio/ogg"                          "public, max-age=604800";
    "application/pdf"                    "public, max-age=86400";
    default                              "public, max-age=300";
}

# Expires header based on file extension
map $uri $expires_time {
    ~^/(index\.html|$)$                  "5m";
    ~^/(services\.json|dashboard\.json|config/)$ "1m";
    ~*\.(css|js)$                        "1y";
    ~*\.(jpg|jpeg|png|gif|webp|svg|ico)$ "1y";
    ~*\.(woff|woff2|ttf|otf|eot)$        "1y";
    ~*\.(mp4|mkv|avi|mov|webm|mp3|flac|aac|ogg)$ "1w";
    ~*\.(pdf|doc|docx)$                  "1d";
    ~*\.(html|htm|php)$                  "epoch";
    default                              "5m";
}

# Security header maps
map $http_host $x_frame_options {
    ~^(emby|jellyfin|plex|abs|music)\.7gram\.xyz$     "SAMEORIGIN";
    ~^(auth|pihole|home|sonarr|radarr|lidarr|jackett|qbt)\.7gram\.xyz$ "DENY";
    default                                  "SAMEORIGIN";
}
map $http_host $x_content_type_options { default "nosniff"; }
map $http_host $x_xss_protection { default "1; mode=block"; }
map $http_host $referrer_policy {
    ~^(auth|pihole|home|qbt|sonarr|radarr|lidarr|jackett)\.7gram\.xyz$ "strict-origin";
    ~^(emby|jellyfin|plex|abs|music|calibreweb)\.7gram\.xyz$ "strict-origin-when-cross-origin";
    default "strict-origin-when-cross-origin";
}
map $http_host $content_security_policy {
    ~^(emby|jellyfin|plex)\.7gram\.xyz$ "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: wss:; img-src 'self' data: https: blob:; connect-src 'self' wss: https:";
    ~^(abs|calibreweb|music)\.7gram\.xyz$ "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; img-src 'self' data: https: blob:; connect-src 'self' wss: https:";
    ~^(ai|chat|ollama|sd|comfy|whisper|code)\.7gram\.xyz$ "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; connect-src 'self' wss: https:";
    ~^(auth|pihole)\.7gram\.xyz$ "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';";
    ~^(sonarr|radarr|lidarr|jackett|audiobooks|ebooks)\.7gram\.xyz$ "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; connect-src 'self' https:";
    ~^(mealie|grocy)\.7gram\.xyz$ "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; connect-src 'self' https:";
    default "default-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:";
}

# Rate limiting and access control
map $http_host$request_uri $rate_limit_zone {
    ~^7gram\.xyz/.*$ "dashboard";
    ~^(emby|jellyfin|plex|abs|music|calibreweb)\.7gram\.xyz/.*$ "media";
    ~^(ai|chat|ollama|sd|comfy|whisper|code)\.7gram\.xyz/.*$ "ai";
    ~^(sonarr|radarr|lidarr|jackett|qbt|audiobooks|ebooks|filebot)\.7gram\.xyz/.*$ "admin";
    ~^(home|pihole|grafana|uptime|duplicati|portainer|auth)\.7gram\.xyz/.*$ "system";
    ~^(mealie|grocy)\.7gram\.xyz/.*$ "general";
    default "general";
}
map $rate_limit_zone $rate_limit_burst {
    "dashboard" 50;
    "media"     30;
    "ai"        20;
    "admin"     15;
    "system"    15;
    "general"   25;
    default     20;
}

# Logging and monitoring
map $request_uri $should_log {
    ~*\.(css|js|png|jpg|gif|ico|woff|woff2)$ 0;
    ~^/api/status$ 0;
    default 1;
}
map $http_user_agent $client_type {
    ~*chrome     "browser";
    ~*firefox    "browser";
    ~*safari     "browser";
    ~*edge       "browser";
    ~*mobile     "mobile";
    ~*android    "mobile";
    ~*iphone     "mobile";
    ~*plex       "media_client";
    ~*emby       "media_client";
    ~*jellyfin   "media_client";
    ~*kodi       "media_client";
    ~*curl       "api_client";
    ~*wget       "api_client";
    ~*postman    "api_client";
    ~*bot        "bot";
    ~*crawler    "bot";
    ~*spider     "bot";
    default      "other";
}
map $http_host $service_type {
    ~^7gram\.xyz$                                                     "dashboard";
    ~^(emby|jellyfin|plex|abs|music|calibreweb|youtube)\.7gram\.xyz$ "media";
    ~^(ai|chat|ollama|sd|comfy|whisper|code)\.7gram\.xyz$            "ai";
    ~^(sonarr|radarr|lidarr|jackett|qbt|audiobooks|ebooks|filebot)\.7gram\.xyz$ "admin";
    ~^(home|pihole|grafana|uptime|duplicati|portainer|auth)\.7gram\.xyz$ "system";
    ~^(mealie|grocy)\.7gram\.xyz$                                    "household";
    default "general";
}
map $http_host $service_name {
    ~^([^.]+)\.7gram\.xyz$ $1;
    ~^7gram\.xyz$          "dashboard";
    default                "unknown";
}
map $service_type $req_timeout {
    "dashboard" "10s";
    "media"     "60s";
    "ai"        "120s";
    "admin"     "30s";
    "system"    "30s";
    default     "30s";
}
