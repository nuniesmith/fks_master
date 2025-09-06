// assets/js/modules/serviceLoader.js - Simplified Service Loading
export class ServiceLoader {
    constructor() {
        this.servicesCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.duplicateCount = 0;
    }

    async loadAllServices() {
        try {
            console.log('📦 Starting service discovery...');
            
            // Check cache first
            const cached = this.getCachedServices();
            if (cached) {
                return cached;
            }

            // Load services from known directories
            const allServices = await this.loadFromDirectories();
            
            // If no services found, use fallback
            if (allServices.length === 0) {
                console.warn('⚠️ No services loaded, using fallback');
                return this.getFallbackServices();
            }

            // Remove duplicates
            const uniqueServices = this.deduplicateServices(allServices);
            
            // Add basic validation and defaults
            const validatedServices = this.validateServices(uniqueServices);

            // Cache the results
            this.setCachedServices(validatedServices);
            
            console.log(`✅ Successfully loaded ${validatedServices.length} services`);
            if (this.duplicateCount > 0) {
                console.warn(`⚠️ Removed ${this.duplicateCount} duplicate services`);
            }
            
            return validatedServices;

        } catch (error) {
            console.error('❌ Error loading services, using fallback:', error.message);
            return this.getFallbackServices();
        }
    }

    async loadFromDirectories() {
        const knownDirectories = [
            { path: 'services/media/', category: 'Media Services', icon: '🎬', color: 'media' },
            { path: 'services/ai/', category: 'AI Services', icon: '🤖', color: 'ai' },
            { path: 'services/admin/', category: 'Media Management', icon: '⚙️', color: 'admin' },
            { path: 'services/system/', category: 'System Services', icon: '🛠️', color: 'system' }
        ];

        const allServices = [];
        
        for (const dir of knownDirectories) {
            try {
                const services = await this.loadServicesFromDirectory(dir);
                if (services && services.length > 0) {
                    allServices.push(...services);
                    console.log(`✅ Loaded ${services.length} services from ${dir.path}`);
                }
            } catch (error) {
                console.warn(`⚠️ Could not load from ${dir.path}: ${error.message}`);
                // Continue loading other directories
            }
        }

        return allServices;
    }

    async loadServicesFromDirectory(dirConfig) {
        try {
            const response = await fetch(`${dirConfig.path}index.json`, {
                headers: { 'Accept': 'application/json' },
                timeout: 3000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.services || !Array.isArray(data.services)) {
                return [];
            }

            // Add directory metadata to each service
            return data.services.map(service => ({
                ...service,
                id: service.id || this.generateServiceId(service.name),
                category: service.category || dirConfig.category,
                categoryIcon: service.categoryIcon || dirConfig.icon,
                categoryColor: service.categoryColor || dirConfig.color,
                discoveredFrom: dirConfig.path
            }));

        } catch (error) {
            throw new Error(`Failed to load ${dirConfig.path}: ${error.message}`);
        }
    }

    deduplicateServices(services) {
        const seen = new Set();
        const deduplicated = [];
        this.duplicateCount = 0;
        
        for (const service of services) {
            const key = service.id || service.name?.toLowerCase() || service.url;
            
            if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(service);
            } else {
                this.duplicateCount++;
                console.warn(`🔄 Duplicate service skipped: ${key}`);
            }
        }
        
        return deduplicated;
    }

    validateServices(services) {
        return services.map(service => {
            // Ensure required fields with defaults
            const validated = {
                id: service.id || this.generateServiceId(service.name || 'unknown'),
                name: service.name || 'Unknown Service',
                description: service.description || 'No description available',
                url: service.url || '#',
                category: service.category || 'Other',
                categoryIcon: service.categoryIcon || '📦',
                categoryColor: service.categoryColor || 'system',
                icon: service.icon || '🔗',
                type: service.type || 'Service',
                version: service.version || '',
                buttonText: service.buttonText || `Open ${service.name || 'Service'}`,
                priority: service.priority || 0,
                tags: service.tags || [],
                status: 'healthy', // Assume healthy by default
                lastUpdated: new Date().toISOString(),
                // Keep any additional properties
                ...service
            };

            // Basic validation warnings (don't fail, just warn)
            if (!service.name) {
                console.warn(`⚠️ Service missing name: ${service.id || 'unknown'}`);
            }
            if (!service.url || service.url === '#') {
                console.warn(`⚠️ Service missing URL: ${service.name || service.id}`);
                validated.status = 'warning';
            }

            return validated;
        });
    }

    generateServiceId(name) {
        if (!name) return `unknown-${Date.now()}`;
        
        return name.toLowerCase()
                  .replace(/[^a-z0-9]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');
    }

    getFallbackServices() {
        console.log('🔄 Using fallback services...');
        
        return [
            {
                id: 'emby',
                name: 'Emby',
                description: 'Premium media server for movies, TV shows, and music',
                url: 'https://emby.7gram.xyz',
                category: 'Media Services',
                categoryIcon: '🎬',
                categoryColor: 'media',
                icon: '🎬',
                status: 'unknown',
                tags: ['media', 'streaming'],
                fallback: true
            },
            {
                id: 'jellyfin',
                name: 'Jellyfin',
                description: 'Free and open-source media server alternative',
                url: 'https://jellyfin.7gram.xyz',
                category: 'Media Services',
                categoryIcon: '🎬',
                categoryColor: 'media',
                icon: '📺',
                status: 'unknown',
                tags: ['media', 'streaming', 'opensource'],
                fallback: true
            },
            {
                id: 'open-webui',
                name: 'Open WebUI',
                description: 'Web interface for AI language models',
                url: 'https://ai.7gram.xyz',
                category: 'AI Services',
                categoryIcon: '🤖',
                categoryColor: 'ai',
                icon: '🤖',
                status: 'unknown',
                tags: ['ai', 'chat', 'llm'],
                fallback: true
            },
            {
                id: 'portainer',
                name: 'Portainer',
                description: 'Container management platform',
                url: 'https://portainer.7gram.xyz',
                category: 'System Services',
                categoryIcon: '🛠️',
                categoryColor: 'system',
                icon: '🐳',
                status: 'unknown',
                tags: ['docker', 'containers', 'management'],
                fallback: true
            },
            {
                id: 'home-assistant',
                name: 'Home Assistant',
                description: 'Home automation platform',
                url: 'https://home.7gram.xyz',
                category: 'System Services',
                categoryIcon: '🛠️',
                categoryColor: 'system',
                icon: '🏠',
                status: 'unknown',
                tags: ['automation', 'iot', 'smart-home'],
                fallback: true
            }
        ].map(service => ({
            ...service,
            lastUpdated: new Date().toISOString()
        }));
    }

    // Cache management
    setCachedServices(services) {
        this.servicesCache.set('services', {
            data: services,
            timestamp: Date.now()
        });
    }

    getCachedServices() {
        const cached = this.servicesCache.get('services');
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            console.log('📦 Using cached services');
            return cached.data;
        }
        return null;
    }

    clearCache() {
        this.servicesCache.clear();
        console.log('🗑️ Service cache cleared');
    }

    // Simple retry method
    async retryServices() {
        this.clearCache();
        return await this.loadAllServices();
    }
}