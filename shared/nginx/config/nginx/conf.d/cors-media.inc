# config/nginx/conf.d/cors-media.conf
# CORS configuration for media services (Plex, Jellyfin, Emby, etc.)
# More permissive to allow media streaming and embeddable content

# Handle preflight requests
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH' always;
    add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,Authorization,X-Requested-With,User-Agent,Range,Cache-Control,Pragma,X-Plex-Token,X-Emby-Token,X-MediaBrowser-Token' always;
    add_header 'Access-Control-Max-Age' 86400 always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Content-Type' 'text/plain; charset=utf-8' always;
    add_header 'Content-Length' 0 always;
    return 204;
}

# Add CORS headers for actual requests
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH' always;
add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,Authorization,X-Requested-With,User-Agent,Range,Cache-Control,Pragma,X-Plex-Token,X-Emby-Token,X-MediaBrowser-Token' always;
add_header 'Access-Control-Max-Age' 86400 always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,Accept-Ranges' always;

# ================================================================