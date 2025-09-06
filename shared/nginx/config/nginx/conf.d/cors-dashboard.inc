# config/nginx/conf.d/cors-dashboard.conf
# CORS configuration specifically for dashboard access
# Allows dashboard to communicate with all services

# Handle preflight requests
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' 'http://7gram.xyz' always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,User-Agent' always;
    add_header 'Access-Control-Max-Age' 3600 always;
    add_header 'Access-Control-Allow-Credentials' 'false' always;
    add_header 'Content-Type' 'text/plain; charset=utf-8' always;
    add_header 'Content-Length' 0 always;
    return 204;
}

# Add CORS headers for actual requests
add_header 'Access-Control-Allow-Origin' 'http://7gram.xyz' always;
add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Accept,Accept-Language,Content-Language,Content-Type,User-Agent' always;
add_header 'Access-Control-Max-Age' 3600 always;
add_header 'Access-Control-Allow-Credentials' 'false' always;

# ================================================================