# Dockerfile - Nginx reverse proxy for 7gram network
# Optimized for production deployment

FROM nginx:alpine

# Build arguments
ARG VERSION="dev"
ARG BUILD_DATE
ARG VCS_REF

# Metadata
LABEL org.opencontainers.image.title="7gram NGINX Proxy" \
      org.opencontainers.image.description="7gram Network Services Reverse Proxy" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.url="https://7gram.xyz" \
      org.opencontainers.image.source="https://github.com/nuniesmith/nginx"

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    curl \
    tzdata \
    ca-certificates \
    openssl

# Create nginx user and directories
RUN addgroup -g 101 -S nginx 2>/dev/null || true && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx 2>/dev/null || true && \
    mkdir -p /var/log/nginx /var/cache/nginx /var/run/nginx && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx /var/run/nginx

# Copy nginx configuration
COPY config/nginx/nginx.conf /etc/nginx/nginx.conf
COPY config/nginx/conf.d/ /etc/nginx/conf.d/
COPY config/nginx/includes/ /etc/nginx/includes/

# Copy static HTML files and assets
COPY html/ /usr/share/nginx/html/

# Copy scripts
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
COPY scripts/healthcheck.sh /healthcheck.sh

# Set permissions
RUN chmod +x /docker-entrypoint.sh /healthcheck.sh && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \; && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;

# Create health check endpoint
RUN echo '{"status":"healthy","version":"'${VERSION}'","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > /usr/share/nginx/html/health.json

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /healthcheck.sh || exit 1

# Entry point
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]