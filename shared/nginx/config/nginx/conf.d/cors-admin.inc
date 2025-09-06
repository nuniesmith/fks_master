# config/nginx/conf.d/cors-admin.conf
# CORS configuration for admin services (Sonarr, Radarr, etc.)
# More restrictive, only allows specific origins

# Handle preflight requests
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' 'http://7gram.xyz' always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS, POST, PUT, DELETE' always;
    add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,Authorization,X-Requested-With,X-API-Key' always;
    add_header 'Access-Control-Max-Age' 3600 always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Content-Type' 'text/plain; charset=utf-8' always;
    add_header 'Content-Length' 0 always;
    return 204;
}

# Add CORS headers for actual requests
add_header 'Access-Control-Allow-Origin' 'http://7gram.xyz' always;
add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS, POST, PUT, DELETE' always;
add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,Authorization,X-Requested-With,X-API-Key' always;
add_header 'Access-Control-Max-Age' 3600 always;
add_header 'Access-Control-Allow-Credentials' 'true' always;

# ================================================================