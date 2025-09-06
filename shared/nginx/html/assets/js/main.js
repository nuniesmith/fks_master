// assets/js/main.js - FAST LOADING VERSION
import { ServiceLoader } from './modules/serviceLoader.js';
import { SearchManager } from './modules/searchManager.js';
import { ComponentLoader } from './modules/componentLoader.js';
import { ThemeManager } from './modules/themeManager.js';

export class DashboardManager {
    constructor() {
        this.serviceLoader = new ServiceLoader();
        this.searchManager = new SearchManager();
        this.componentLoader = new ComponentLoader();
        this.themeManager = new ThemeManager();
        this.services = [];
        this.categories = [];
        this.isInitialized = false;
        
        // Default configuration
        this.config = {
            enableAutoRefresh: true,
            autoRefreshInterval: 300000,
            healthCheckInterval: 120000,
            services: {
                healthCheckEnabled: true,
                healthCheckInterval: 120000,
                healthCheckTimeout: 5000
            },
            ui: {
                fastLoad: true,
                showLoadingStates: true
            },
            debugging: {
                enabled: false,
                healthCheckDebugging: false
            },
            features: {
                shortcuts: {
                    enabled: true
                },
                notifications: {
                    enabled: true,
                }
            }
        };
    }

    async initialize() {
        try {
            console.log('🚀 Initializing 7gram Dashboard (Fast Mode)...');

            // Load configuration first (but don't wait long)
            await this.loadConfigWithTimeout();

            // Apply URL parameter overrides
            this.applyUrlParameterOverrides();

            // Initialize theme immediately (use built-in if needed)
            await this.themeManager.initialize();

            // Load services quickly
            this.services = await this.serviceLoader.loadAllServices();
            this.categories = this.organizeServicesByCategory(this.services);

            // RENDER IMMEDIATELY - Don't wait for anything else
            this.renderDashboardFast();

            // Hide loading spinner now that basic UI is ready
            this.hideAllLoadingStates();

            // Initialize search with the rendered UI
            this.searchManager.initialize(this.services, this.categories);

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Start background tasks (non-blocking)
            this.startBackgroundTasks();

            console.log(`✅ Dashboard loaded instantly with ${this.services.length} services`);
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.renderErrorState(error);
            this.hideAllLoadingStates();
        }
    }

    async loadConfigWithTimeout() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000); // Only wait 2 seconds

            const response = await fetch('config/dashboard.json', { signal: controller.signal });
            clearTimeout(timeout);
            
            if (response.ok) {
                const config = await response.json();
                this.config = this.deepMerge(this.config, config);
                console.log('✅ Configuration loaded');
            }
        } catch (error) {
            console.warn('⚠️ Using default config (config load failed/timeout)');
        }
    }

    renderDashboardFast() {
        console.log('🎨 Rendering dashboard immediately...');

        const container = document.getElementById('services-container');
        if (!container) {
            console.error('❌ Services container not found!');
            return;
        }

        // Clear any loading content
        container.innerHTML = '';

        // Add header if needed
        this.renderHeader();

        // Group services by category
        const categoryGroups = this.groupServicesByCategory();

        // Render each category
        Object.entries(categoryGroups).forEach(([categoryName, services]) => {
            const categoryElement = this.createCategoryElement(categoryName, services);
            container.appendChild(categoryElement);
        });

        // Add footer
        this.renderFooter();

        console.log('✅ Dashboard UI rendered');
    }

    renderHeader() {
        let header = document.getElementById('dashboard-header');
        if (!header) {
            header = document.createElement('header');
            header.id = 'dashboard-header';
            header.role = 'banner';
            document.querySelector('main').insertBefore(header, document.getElementById('services-container'));
        }

        header.innerHTML = `
            <div class="header-content">
                <div class="header-main">
                    <h1 class="dashboard-title">
                        <span class="title-icon">🏠</span>
                        7Gram Network Dashboard
                    </h1>
                    <p class="dashboard-subtitle">Your complete home services ecosystem</p>
                </div>
                
                <div class="header-actions">
                    <div class="search-wrapper">
                        <input 
                            type="text" 
                            id="search-input" 
                            class="search-input" 
                            placeholder="🔍 Search services... (Ctrl+K)"
                            aria-label="Search services"
                            autocomplete="off"
                        >
                        <div id="search-suggestions" class="search-suggestions" style="display: none;"></div>
                    </div>
                    
                    <div class="header-controls">
                        <button id="theme-toggle" class="control-button" title="Toggle theme">🌙</button>
                        <button id="refresh-button" class="control-button" title="Refresh services">🔄</button>
                        <button id="health-toggle" class="control-button" title="Toggle health monitoring">🏥</button>
                    </div>
                </div>

                <div class="status-bar">
                    <div class="status-item">
                        Services: <span id="total-services">${this.services.length}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-dot status-healthy"></span>
                        <span id="healthy-count">-</span> Healthy
                    </div>
                    <div class="status-item">
                        <span class="status-dot status-warning"></span>
                        <span id="warning-count">-</span> Warning
                    </div>
                    <div class="status-item">
                        <span class="status-dot status-error"></span>
                        <span id="error-count">-</span> Offline
                    </div>
                    <div class="status-item">
                        Last updated: <span id="last-updated">Just now</span>
                    </div>
                </div>
            </div>
        `;

        // Setup header interactions
        this.setupHeaderControls();
    }

    setupHeaderControls() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.themeManager.toggleTheme();
            });
        }

        // Refresh button
        const refreshButton = document.getElementById('refresh-button');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                location.reload();
            });
        }
    }

    groupServicesByCategory() {
        const groups = {};
        
        this.services.forEach(service => {
            const category = service.category || 'Other Services';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(service);
        });

        // Sort categories and services
        const sortedGroups = {};
        const categoryOrder = ['Media Services', 'AI Services', 'Media Management', 'System Services', 'Development', 'Household Services'];
        
        // Add ordered categories first
        categoryOrder.forEach(cat => {
            if (groups[cat]) {
                sortedGroups[cat] = groups[cat].sort((a, b) => a.name.localeCompare(b.name));
            }
        });

        // Add remaining categories
        Object.keys(groups).forEach(cat => {
            if (!categoryOrder.includes(cat)) {
                sortedGroups[cat] = groups[cat].sort((a, b) => a.name.localeCompare(b.name));
            }
        });

        return sortedGroups;
    }

    createCategoryElement(categoryName, services) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        categoryDiv.dataset.category = categoryName.toLowerCase().replace(/\s+/g, '-');

        // Get category icon and color
        const firstService = services[0];
        const categoryIcon = firstService?.categoryIcon || '📦';
        const categoryColor = firstService?.categoryColor || 'default';

        categoryDiv.innerHTML = `
            <div class="category-header">
                <h2 class="category-title" data-color="${categoryColor}">
                    <span class="category-icon">${categoryIcon}</span>
                    ${categoryName}
                    <span class="category-count">(${services.length})</span>
                </h2>
            </div>
            
            <div class="services-grid">
                ${services.map(service => this.createServiceCard(service)).join('')}
            </div>
        `;

        return categoryDiv;
    }

    createServiceCard(service) {

        return `
            <div class="service-card" data-service="${service.id}" data-category="${service.category}">
                <div class="card-header">
                    <div class="card-icon">${service.icon || '🔗'}</div>
                    <div class="card-title-section">
                        <h3 class="card-title">${service.name}</h3>
                        <div class="card-meta">
                            ${service.type ? `<span class="service-type">${service.type}</span>` : ''}
                            ${service.version ? `<span class="service-version">v${service.version}</span>` : ''}
                        </div>
                    </div>
                    ${healthIndicator}
                </div>
                
                <div class="card-content">
                    <p class="card-description">${service.description || 'No description available'}</p>
                    
                    ${service.tags ? `
                        <div class="card-tags">
                            ${service.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="card-actions">
                    <a href="${service.url}" 
                       class="card-link primary" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       title="Open ${service.name}">
                        ${service.buttonText || `Open ${service.name}`}
                        <span class="link-icon">↗️</span>
                    </a>
                    
                    ${service.healthCheck ? `
                        <button class="card-link secondary health-check-btn" 
                                data-service-id="${service.id}"
                                title="Check health">
                            🏥 Check
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderFooter() {
        let footer = document.getElementById('dashboard-footer');
        if (!footer) {
            footer = document.createElement('footer');
            footer.id = 'dashboard-footer';
            footer.role = 'contentinfo';
            document.querySelector('main').appendChild(footer);
        }

        footer.innerHTML = `
            <div class="footer-content">
                <div class="footer-section">
                    <h4>7Gram Network</h4>
                    <p>Your home services ecosystem</p>
                </div>
                
                <div class="footer-section">
                    <h4>Quick Stats</h4>
                    <p>
                        ${this.services.length} services across ${Object.keys(this.groupServicesByCategory()).length} categories
                    </p>
                </div>
                
                <div class="footer-section">
                    <h4>System Info</h4>
                    <p>
                        Dashboard v2.1.0 | 
                        <span id="footer-timestamp">${new Date().toLocaleString()}</span>
                    </p>
                </div>
            </div>
        `;
    }

    hideAllLoadingStates() {
        // Hide main loading container
        const loadingContainer = document.querySelector('.loading-container');
        if (loadingContainer) {
            loadingContainer.style.display = 'none';
        }

        // Hide any overlay loading
        const loadingOverlay = document.getElementById('dashboard-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }

        // Remove loading class from body
        document.body.classList.remove('loading');

        console.log('✅ All loading states hidden');
    }

    startBackgroundTasks() {
        console.log('🔄 Starting background tasks...');

        // Start auto-refresh if enabled
        if (this.config.enableAutoRefresh) {
            this.startAutoRefresh();
        }

        // Update timestamps periodically
        setInterval(() => {
            this.updateTimestamps();
        }, 30000); // Every 30 seconds
    }

    updateTimestamps() {
        const lastUpdated = document.getElementById('last-updated');
        const footerTimestamp = document.getElementById('footer-timestamp');
        const now = new Date().toLocaleTimeString();

        if (lastUpdated) lastUpdated.textContent = now;
        if (footerTimestamp) footerTimestamp.textContent = new Date().toLocaleString();
    }

    // Utility methods
    organizeServicesByCategory(services) {
        return this.groupServicesByCategory();
    }

    renderErrorState(error) {
        const container = document.getElementById('services-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h2>Failed to Load Dashboard</h2>
                    <p>There was an error loading the dashboard: ${error.message}</p>
                    <button onclick="location.reload()" class="error-retry-btn">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    applyUrlParameterOverrides() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.has('health')) {
            const healthEnabled = urlParams.get('health') === 'true';
            this.config.services = this.config.services || {};
            this.config.services.healthCheckEnabled = healthEnabled;
        }

        if (urlParams.has('debug')) {
            const debugEnabled = urlParams.get('debug') === 'true';
            this.config.debugging = this.config.debugging || {};
            this.config.debugging.enabled = debugEnabled;
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const hasModifier = e.ctrlKey || e.metaKey;

            if (hasModifier && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                document.getElementById('search-input')?.focus();
            } else if (hasModifier && e.key.toLowerCase() === 't') {
                e.preventDefault();
                this.themeManager.toggleTheme();
            } else if (hasModifier && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                location.reload();
            }
        });
    }

    startAutoRefresh() {
        if (this.config.enableAutoRefresh) {
            setInterval(() => {
                if (this.config.services?.healthCheckEnabled && this.healthChecker) {
                    this.healthChecker.checkAllServices(this.services);
                }
            }, this.config.autoRefreshInterval || 300000);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            background: ${type === 'success' ? '#28a745' : 
                       type === 'warning' ? '#ffc107' : 
                       type === 'error' ? '#dc3545' : '#17a2b8'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    window.dashboard = new DashboardManager();
    await window.dashboard.initialize();
});