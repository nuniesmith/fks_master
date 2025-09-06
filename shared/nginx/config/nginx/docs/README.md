# 🏠 7Gram Dashboard - Modular Setup Guide

A beautiful, modular, and dynamic dashboard for managing your home network services with automatic service discovery, health monitoring, and modern design.

## ✨ Features

- 🔍 **Dynamic Service Discovery** - Automatically detects services from directory structure
- 🏥 **Health Monitoring** - Real-time service status and uptime tracking
- 🎨 **Multiple Themes** - Dark mode, light mode, high contrast, and custom themes
- 📱 **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- 🔍 **Advanced Search** - Fast search with suggestions and highlighting
- 🎯 **Modular Architecture** - Easy to extend and customize
- 🚀 **Performance Optimized** - Fast loading with caching and optimization
- ♿ **Accessibility** - WCAG compliant with screen reader support

## 🚀 Quick Start

### 1. Download and Extract
```bash
# Download the latest release
wget https://github.com/7gram/dashboard/archive/main.zip
unzip main.zip
cd 7gram-dashboard
```

### 2. Set Up Directory Structure
```bash
# Create required directories
mkdir -p assets/{css,js/modules} config services/{media,ai,admin,system} components api cache

# Set permissions
chmod 755 api/
chmod 777 cache/
```

### 3. Copy Files
Copy all the provided files to their respective locations:

```
7gram-dashboard/
├── index.html                    # Main entry point
├── config/
│   ├── dashboard.json           # Dashboard configuration
│   ├── services.json            # Service definitions  
│   └── themes.json              # Theme configurations
├── assets/
│   ├── css/
│   │   ├── main.css            # Core styles
│   │   ├── components.css      # Component styles
│   │   └── themes/
│   │       ├── default.css     # Default theme
│   │       └── dark.css        # Dark theme
│   └── js/
│       ├── main.js             # Main dashboard manager
│       └── modules/
│           ├── serviceLoader.js    # Service loading
│           ├── searchManager.js    # Search functionality
│           ├── themeManager.js     # Theme management
│           ├── componentLoader.js  # Component loading
│           └── healthChecker.js    # Health monitoring
├── components/
│   ├── header.html             # Header template
│   ├── footer.html             # Footer template
│   └── service-card.html       # Service card template
├── services/
│   └── media/
│       └── index.json          # Media services config
└── api/
    ├── discover-services.php   # Service discovery
    └── health-check.php        # Health monitoring
```

### 4. Configure Your Services

#### Option A: Using services.json (Centralized)
Edit `config/services.json` and add your services:

```json
{
  "services": [
    {
      "id": "emby",
      "name": "Emby",
      "description": "Premium media server",
      "url": "https://emby.yourdomain.com",
      "category": "Media Services",
      "icon": "🎬",
      "healthCheck": "https://emby.yourdomain.com/health"
    }
  ]
}
```

#### Option B: Using Service Directories (Modular)
Create `services/media/index.json`:

```json
{
  "category": "Media Services",
  "icon": "🎬",
  "color": "media",
  "services": [
    {
      "id": "emby",
      "name": "Emby", 
      "description": "Premium media server",
      "url": "https://emby.yourdomain.com",
      "icon": "🎬"
    }
  ]
}
```

### 5. Customize Dashboard
Edit `config/dashboard.json`:

```json
{
  "dashboard": {
    "title": "🏠 Your Network Dashboard",
    "subtitle": "Your services, your way"
  },
  "ui": {
    "theme": "default",
    "showSearch": true,
    "showStats": true
  }
}
```

### 6. Set Up Web Server

#### Apache (.htaccess)
```apache
RewriteEngine On

# API Routes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^api/(.*)$ api/$1.php [L,QSA]

# Single Page App
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [L,QSA]
```

#### Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/7gram-dashboard;
    index index.html;

    # API Routes
    location /api/ {
        try_files $uri $uri.php $uri/ =404;
        
        location ~ \.php$ {
            fastcgi_pass php-fpm;
            fastcgi_index index.php;
            include fastcgi_params;
        }
    }

    # Static files
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Single Page App
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 📋 Configuration Guide

### Dashboard Settings
```json
{
  "dashboard": {
    "title": "Your Dashboard Title",
    "subtitle": "Your subtitle here",
    "theme": "default"
  },
  "ui": {
    "showSearch": true,
    "showStats": true,
    "showServiceHealth": true,
    "enableAnimations": true
  },
  "services": {
    "autoDiscovery": true,
    "healthCheckEnabled": true,
    "healthCheckInterval": 60000
  }
}
```

### Service Configuration

#### Basic Service
```json
{
  "id": "service-name",
  "name": "Service Display Name",
  "description": "Description of the service",
  "url": "https://service.domain.com",
  "category": "Category Name",
  "icon": "🔗"
}
```

#### Advanced Service with Health Check
```json
{
  "id": "advanced-service",
  "name": "Advanced Service",
  "description": "Service with advanced features",
  "url": "https://service.domain.com",
  "category": "System Services",
  "icon": "⚙️",
  "type": "Web Application",
  "version": "1.0.0",
  "priority": 10,
  "tags": ["web", "api", "service"],
  "healthCheck": {
    "url": "https://service.domain.com/health",
    "method": "GET",
    "timeout": 5000,
    "expectedStatus": [200, 201],
    "interval": 60000
  },
  "features": ["Feature 1", "Feature 2"],
  "documentation": "https://docs.service.com"
}
```

### Theme Configuration
Create custom themes in `config/themes.json`:

```json
{
  "themes": [
    {
      "id": "custom-theme",
      "name": "Custom Theme",
      "description": "My custom theme",
      "cssFile": "assets/css/themes/custom.css",
      "isDark": false,
      "colors": {
        "primary": "#your-color",
        "secondary": "#another-color"
      }
    }
  ]
}
```

## 🔧 Advanced Configuration

### Health Monitoring

#### Simple Health Check
```json
{
  "healthCheck": "https://service.domain.com/ping"
}
```

#### Advanced Health Check
```json
{
  "healthCheck": {
    "url": "https://service.domain.com/api/health",
    "method": "POST",
    "timeout": 10000,
    "expectedStatus": [200, 201],
    "headers": {
      "Authorization": "Bearer token",
      "Content-Type": "application/json"
    },
    "body": {
      "check": "status"
    },
    "retries": 3
  }
}
```

### Service Discovery
The dashboard automatically discovers services from:

1. **Central Configuration** (`config/services.json`)
2. **Service Directories** (`services/*/index.json`)
3. **Individual Service Files** (`services/*/*.json`)
4. **API Discovery** (`/api/discover-services`)

### Custom Categories
Add custom categories in service configurations:

```json
{
  "category": "Gaming Services",
  "icon": "🎮",
  "color": "games",
  "description": "Game servers and gaming tools",
  "services": [...]
}
```

## 🎨 Customization

### Custom Themes
1. Create CSS file in `assets/css/themes/`
2. Add theme definition to `config/themes.json`
3. Use CSS custom properties for easy customization

### Custom Components
1. Create HTML template in `components/`
2. Use template variables: `{{variable}}`
3. Support for conditionals: `{{#if condition}}content{{/if}}`
4. Support for loops: `{{#each items}}{{name}}{{/each}}`

### Custom Icons
- Use emoji icons: `"icon": "🎬"`
- Use Unicode symbols: `"icon": "⚙️"`
- Use custom images: `"icon": "/assets/icons/service.png"`

## 🚀 Performance Optimization

### Caching
- Service discovery results cached for 5 minutes
- Health check results cached for 1 minute
- Theme files cached by browser
- Component templates cached in memory

### Optimization Tips
1. **Enable Gzip** compression on your web server
2. **Set Cache Headers** for static assets
3. **Use a CDN** for better global performance
4. **Optimize Images** used for service icons
5. **Minimize HTTP Requests** by using built-in icons

## 🔍 Troubleshooting

### Common Issues

#### Services Not Loading
1. Check `config/services.json` syntax
2. Verify file permissions (cache directory writable)
3. Check browser console for JavaScript errors
4. Verify API endpoints are accessible

#### Health Checks Failing
1. Confirm service URLs are accessible
2. Check CORS policies for cross-origin requests
3. Verify health check endpoint configurations
4. Check server-side error logs

#### Theme Not Loading
1. Verify theme CSS file exists
2. Check `config/themes.json` syntax
3. Confirm theme ID matches configuration
4. Clear browser cache

### Debug Mode
Enable debug mode in `config/dashboard.json`:

```json
{
  "debugging": {
    "enabled": true,
    "logLevel": "debug",
    "showPerformanceMetrics": true
  }
}
```

## 🔐 Security Considerations

### Best Practices
1. **Use HTTPS** for all service URLs
2. **Validate Input** in custom configurations
3. **Restrict API Access** if hosting publicly
4. **Keep Backups** of configuration files
5. **Monitor Logs** for suspicious activity

### Access Control
For public deployments, consider:
- HTTP Basic Authentication
- IP whitelist restrictions
- VPN access requirements
- OAuth integration

## 📱 Mobile Optimization

The dashboard is fully responsive and includes:
- Touch-optimized interface
- Mobile-friendly navigation
- Optimized loading for slower connections
- PWA capabilities (optional)

## 🔄 Updates and Maintenance

### Updating the Dashboard
1. Backup your configuration files
2. Download latest version
3. Replace core files (keep your configs)
4. Clear cache directory
5. Test functionality

### Regular Maintenance
- Monitor cache directory size
- Review health check logs
- Update service configurations
- Check for theme updates

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request
4. Follow coding standards

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

- 📖 Documentation: Check this guide and inline comments
- 🐛 Issues: Report bugs via GitHub issues
- 💬 Community: Join our Discord server
- 📧 Email: admin@7gram.xyz

---

**Made with 🍯 by the 7gram Team**

Enjoy your beautiful, modular dashboard! 🚀