// assets/js/modules/componentLoader.js - Dynamic Component Loading
export class ComponentLoader {
    constructor() {
        this.componentCache = new Map();
        this.templatesLoaded = false;
    }

    async loadComponent(componentName, data = {}) {
        try {
            // Check cache first
            const cacheKey = `${componentName}-${JSON.stringify(data)}`;
            if (this.componentCache.has(cacheKey)) {
                return this.componentCache.get(cacheKey);
            }

            // Load component HTML
            const componentHtml = await this.fetchComponent(componentName);
            
            // Process template with data
            const processedHtml = this.processTemplate(componentHtml, data);
            
            // Cache the result
            this.componentCache.set(cacheKey, processedHtml);
            
            return processedHtml;
            
        } catch (error) {
            console.error(`❌ Failed to load component '${componentName}':`, error);
            return this.getFallbackComponent(componentName, data);
        }
    }

    async fetchComponent(componentName) {
        const componentPath = `components/${componentName}.html`;
        
        try {
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Component not found: ${componentPath}`);
            }
            return await response.text();
        } catch (error) {
            // Try alternative paths
            const altPaths = [
                `components/${componentName}/index.html`,
                `assets/components/${componentName}.html`,
                `templates/${componentName}.html`
            ];
            
            for (const altPath of altPaths) {
                try {
                    const response = await fetch(altPath);
                    if (response.ok) {
                        return await response.text();
                    }
                } catch (e) {
                    // Continue to next path
                }
            }
            
            throw error;
        }
    }

    processTemplate(html, data) {
        let processed = html;
        
        // Simple template variable replacement
        // Supports {{variable}} syntax
        processed = processed.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || '';
        });
        
        // Support for conditional rendering
        // {{#if condition}}content{{/if}}
        processed = processed.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
            return data[condition] ? content : '';
        });
        
        // Support for loops
        // {{#each items}}{{name}}{{/each}}
        processed = processed.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayName, template) => {
            const items = data[arrayName];
            if (!Array.isArray(items)) return '';
            
            return items.map(item => {
                let itemHtml = template;
                // Replace variables in the loop template
                for (const [key, value] of Object.entries(item)) {
                    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                    itemHtml = itemHtml.replace(regex, value);
                }
                return itemHtml;
            }).join('');
        });
        
        // Process dynamic timestamps
        processed = processed.replace(/\{\{timestamp\}\}/g, () => {
            const now = new Date();
            const options = { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit'
            };
            return now.toLocaleDateString('en-US', options);
        });
        
        // Process current year
        processed = processed.replace(/\{\{year\}\}/g, () => {
            return new Date().getFullYear();
        });
        
        return processed;
    }

    getFallbackComponent(componentName, data) {
        // Return basic fallback components
        const fallbacks = {
            header: `
                <div class="header-fallback">
                    <h1>🏠 7gram Network Dashboard</h1>
                    <p class="subtitle">Your complete home services ecosystem</p>
                    <div class="search-container">
                        <input type="text" id="search-input" class="search-input" 
                               placeholder="🔍 Search services... (Ctrl+K)" 
                               aria-label="Search services">
                    </div>
                </div>
            `,
            footer: `
                <div class="footer-fallback">
                    <p>
                        <span class="status-indicator"></span>
                        &copy; ${new Date().getFullYear()} 7gram Network | 
                        Last updated: <span id="last-updated">${new Date().toLocaleDateString()}</span>
                    </p>
                </div>
            `,
            'service-card': `
                <div class="card service-card-fallback">
                    <h3 class="card-title">${data.name || 'Service'}</h3>
                    <p class="card-description">${data.description || 'No description available'}</p>
                    <a href="${data.url || '#'}" class="card-link" target="_blank" rel="noopener noreferrer">
                        ${data.icon || '🔗'} Open ${data.name || 'Service'}
                    </a>
                </div>
            `
        };
        
        return fallbacks[componentName] || `<div class="component-error">Component '${componentName}' not found</div>`;
    }

    // Load multiple components in parallel
    async loadComponents(components) {
        const promises = components.map(async (component) => {
            if (typeof component === 'string') {
                return {
                    name: component,
                    html: await this.loadComponent(component)
                };
            } else {
                return {
                    name: component.name,
                    html: await this.loadComponent(component.name, component.data || {})
                };
            }
        });
        
        return Promise.all(promises);
    }

    // Inject component into DOM element
    async injectComponent(elementId, componentName, data = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`❌ Element with ID '${elementId}' not found`);
            return false;
        }
        
        try {
            const html = await this.loadComponent(componentName, data);
            element.innerHTML = html;
            
            // Trigger any component-specific initialization
            this.initializeComponent(elementId, componentName);
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to inject component '${componentName}':`, error);
            return false;
        }
    }

    // Initialize component-specific functionality
    initializeComponent(elementId, componentName) {
        switch (componentName) {
            case 'header':
                this.initializeSearchInput();
                break;
            case 'service-card':
                this.initializeServiceCard(elementId);
                break;
            case 'category':
                this.initializeCategoryActions(elementId);
                break;
        }
    }

    initializeSearchInput() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('focus', () => {
                searchInput.parentElement.classList.add('search-focused');
            });
            
            searchInput.addEventListener('blur', () => {
                searchInput.parentElement.classList.remove('search-focused');
            });
        }
    }

    initializeServiceCard(elementId) {
        const element = document.getElementById(elementId);
        const links = element.querySelectorAll('.card-link');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                // Add click animation
                link.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    link.style.transform = '';
                }, 150);
            });
        });
    }

    initializeCategoryActions(elementId) {
        const element = document.getElementById(elementId);
        const categoryTitle = element.querySelector('.category-title');
        
        if (categoryTitle) {
            // Add click to collapse/expand functionality
            categoryTitle.addEventListener('click', () => {
                const servicesGrid = element.querySelector('.services-grid');
                if (servicesGrid) {
                    servicesGrid.classList.toggle('collapsed');
                    categoryTitle.classList.toggle('collapsed');
                }
            });
        }
    }

    // Preload commonly used components
    async preloadComponents(componentNames = ['header', 'footer', 'service-card']) {
        console.log('🔄 Preloading components...');
        
        const promises = componentNames.map(name => 
            this.loadComponent(name).catch(error => 
                console.warn(`⚠️ Failed to preload component '${name}':`, error)
            )
        );
        
        await Promise.allSettled(promises);
        console.log('✅ Component preloading complete');
    }

    // Clear component cache
    clearCache() {
        this.componentCache.clear();
        console.log('🧹 Component cache cleared');
    }

    // Get cache statistics
    getCacheStats() {
        return {
            size: this.componentCache.size,
            keys: Array.from(this.componentCache.keys())
        };
    }
}