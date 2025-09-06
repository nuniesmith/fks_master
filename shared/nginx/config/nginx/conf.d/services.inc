# services.conf
# Service-specific proxy configurations for Freddy and Sullivan servers
# Include this file in the main server block

# =============================================================================
# FREDDY SERVER SERVICES (Infrastructure/System)
# =============================================================================

# PiHole Admin Interface  
location /pihole/ {
    # Forward to Freddy PiHole (using port 8080 per integration guide)
    set $freddy_pihole http://freddy.7gram.xyz:8080;
    proxy_pass $freddy_pihole/admin/;
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Original-Host $host;
    
    # Handle redirects
    proxy_redirect http://freddy.7gram.xyz:8080/admin/ /pihole/;
    
    # Timeouts
    proxy_connect_timeout 10s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
}

# Home Assistant
location /homeassistant/ {
    set $freddy_hass http://freddy.7gram.xyz:8123;
    proxy_pass $freddy_hass/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # WebSocket support for Home Assistant
    proxy_http_version 1.1;
    proxy_buffering off;
    
    proxy_redirect http://freddy.7gram.xyz:8123/ /homeassistant/;
}

# Syncthing (Freddy)
location /freddy-sync/ {
    set $freddy_syncthing http://freddy.7gram.xyz:8384;
    proxy_pass $freddy_syncthing/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://freddy.7gram.xyz:8384/ /freddy-sync/;
}

# Portainer (Freddy)
location /freddy-portainer/ {
    set $freddy_portainer http://freddy.7gram.xyz:9000;
    proxy_pass $freddy_portainer/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    proxy_http_version 1.1;
    proxy_redirect http://freddy.7gram.xyz:9000/ /freddy-portainer/;
}

# =============================================================================
# SULLIVAN SERVER SERVICES (Media/AI)
# =============================================================================

# AI Services
location /ollama/ {
    set $sullivan_ollama http://sullivan.7gram.xyz:11434;
    proxy_pass $sullivan_ollama/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # API-specific settings
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 30s;
    
    proxy_redirect http://sullivan.7gram.xyz:11434/ /ollama/;
}

location /ai/ {
    set $sullivan_openwebui http://sullivan.7gram.xyz:3001;  # Updated to match integration guide recommendation
    proxy_pass $sullivan_openwebui/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    proxy_http_version 1.1;
    proxy_redirect http://sullivan.7gram.xyz:3001/ /ai/;
}

# Media Services
location /emby/ {
    set $sullivan_emby http://sullivan.7gram.xyz:8096;
    proxy_pass $sullivan_emby/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Media streaming optimizations
    proxy_buffering off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    
    proxy_redirect http://sullivan.7gram.xyz:8096/ /emby/;
}

location /jellyfin/ {
    set $sullivan_jellyfin http://sullivan.7gram.xyz:8097;
    proxy_pass $sullivan_jellyfin/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_buffering off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    
    proxy_redirect http://sullivan.7gram.xyz:8097/ /jellyfin/;
}

location /plex/ {
    set $sullivan_plex http://sullivan.7gram.xyz:32400;
    proxy_pass $sullivan_plex/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_buffering off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    
    proxy_redirect http://sullivan.7gram.xyz:32400/ /plex/;
}

# Book Services
location /audiobooks/ {
    set $sullivan_audiobookshelf http://sullivan.7gram.xyz:13378;
    proxy_pass $sullivan_audiobookshelf/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:13378/ /audiobooks/;
}

location /calibre/ {
    set $sullivan_calibre http://sullivan.7gram.xyz:8082;
    proxy_pass $sullivan_calibre/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8082/ /calibre/;
}

location /calibre-web/ {
    set $sullivan_calibreweb http://sullivan.7gram.xyz:8084;
    proxy_pass $sullivan_calibreweb/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8084/ /calibre-web/;
}

# Download Management
location /qbittorrent/ {
    set $sullivan_qbit http://sullivan.7gram.xyz:8080;
    proxy_pass $sullivan_qbit/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Referer "";
    
    # qBittorrent specific headers
    proxy_set_header X-Forwarded-Host $host;
    proxy_cookie_path / "/qbittorrent/";
    
    proxy_redirect http://sullivan.7gram.xyz:8080/ /qbittorrent/;
}

location /jackett/ {
    set $sullivan_jackett http://sullivan.7gram.xyz:9117;
    proxy_pass $sullivan_jackett/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:9117/ /jackett/;
}

location /sonarr/ {
    set $sullivan_sonarr http://sullivan.7gram.xyz:8989;
    proxy_pass $sullivan_sonarr/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8989/ /sonarr/;
}

location /radarr/ {
    set $sullivan_radarr http://sullivan.7gram.xyz:7878;
    proxy_pass $sullivan_radarr/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:7878/ /radarr/;
}

location /lidarr/ {
    set $sullivan_lidarr http://sullivan.7gram.xyz:8686;
    proxy_pass $sullivan_lidarr/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8686/ /lidarr/;
}

location /readarr-audio/ {
    set $sullivan_readarr_audio http://sullivan.7gram.xyz:8787;
    proxy_pass $sullivan_readarr_audio/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8787/ /readarr-audio/;
}

location /readarr-books/ {
    set $sullivan_readarr_books http://sullivan.7gram.xyz:8585;
    proxy_pass $sullivan_readarr_books/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8585/ /readarr-books/;
}

# Utility Services
location /filebot/ {
    set $sullivan_filebot http://sullivan.7gram.xyz:5452;
    proxy_pass $sullivan_filebot/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:5452/ /filebot/;
}

location /youtube-dl/ {
    set $sullivan_ytdl http://sullivan.7gram.xyz:8998;
    proxy_pass $sullivan_ytdl/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8998/ /youtube-dl/;
}

location /duplicati/ {
    set $sullivan_duplicati http://sullivan.7gram.xyz:8200;
    proxy_pass $sullivan_duplicati/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8200/ /duplicati/;
}

location /mealie/ {
    set $sullivan_mealie http://sullivan.7gram.xyz:9925;
    proxy_pass $sullivan_mealie/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:9925/ /mealie/;
}

location /grocy/ {
    set $sullivan_grocy http://sullivan.7gram.xyz:9283;
    proxy_pass $sullivan_grocy/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:9283/ /grocy/;
}

location /sullivan-sync/ {
    set $sullivan_syncthing http://sullivan.7gram.xyz:8385;
    proxy_pass $sullivan_syncthing/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8385/ /sullivan-sync/;
}

location /wiki/ {
    set $sullivan_wiki http://sullivan.7gram.xyz:8090;
    proxy_pass $sullivan_wiki/;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_redirect http://sullivan.7gram.xyz:8090/ /wiki/;
}
