# config/nginx/conf.d/cors-universal.conf
# Universal CORS configuration for health checks and API endpoints
# Used by all services for basic health endpoint access

# Handle preflight requests
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS, POST, PUT, DELETE' always;
    add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,Authorization,X-Requested-With,User-Agent,Cache-Control,Pragma' always;
    add_header 'Access-Control-Max-Age' 86400 always;
    add_header 'Access-Control-Allow-Credentials' 'false' always;
    add_header 'Content-Type' 'text/plain; charset=utf-8' always;
    add_header 'Content-Length' 0 always;
    return 204;
}

# Add CORS headers for actual requests
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS, POST, PUT, DELETE' always;
add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,Authorization,X-Requested-With,User-Agent,Cache-Control,Pragma' always;
add_header 'Access-Control-Max-Age' 86400 always;
add_header 'Access-Control-Allow-Credentials' 'false' always;

# ================================================================