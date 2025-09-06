// assets/js/modules/themeManager.js - FIXED Theme Management System
export class ThemeManager {
    constructor() {
        this.currentTheme = 'default';
        this.availableThemes = new Map();
        this.themeStorageKey = '7gram-selected-theme';
        this.systemPreference = window.matchMedia('(prefers-color-scheme: dark)');
        this.themeTransitionDuration = 300;
        this._isLoadingTheme = false;
        this._failedThemes = new Set();
        this._cssTimeout = 15000; // Increased timeout
        this._maxRetries = 2; // Add retry logic
    }

    async initialize() {
        try {
            console.log('🎨 Initializing theme manager...');
            
            // ALWAYS load default themes first as a safety net
            this.loadDefaultThemes();
            
            // Try to load additional themes from config (but don't fail if missing)
            try {
                await this.loadAvailableThemes();
            } catch (error) {
                console.warn('⚠️ Could not load additional themes config:', error.message);
            }
            
            // Get saved theme preference
            const savedTheme = this.getSavedTheme();
            const preferredTheme = savedTheme || this.detectSystemPreference();
            
            console.log(`🎨 Attempting to load theme: ${preferredTheme}`);
            
            // Apply the theme with retry logic
            const success = await this.loadThemeWithRetry(preferredTheme);
            
            if (!success) {
                console.warn('⚠️ Failed to load preferred theme, using built-in fallback');
                await this.applyBuiltInTheme();
            }
            
            // Setup theme controls and listeners
            this.setupThemeControls();
            this.setupSystemThemeListener();
            
            console.log(`✅ Theme manager initialized with theme: ${this.currentTheme}`);
            
        } catch (error) {
            console.error('❌ Critical theme manager error:', error);
            await this.applyBuiltInTheme();
        }
    }

    // FIX: Enhanced theme loading with retry logic
    async loadThemeWithRetry(themeId, maxRetries = this._maxRetries) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🎨 Loading theme '${themeId}' (attempt ${attempt}/${maxRetries})`);
                await this.loadTheme(themeId);
                return true;
            } catch (error) {
                console.warn(`⚠️ Theme load attempt ${attempt} failed:`, error.message);
                if (attempt < maxRetries) {
                    await this.delay(1000 * attempt); // Progressive delay
                }
            }
        }
        return false;
    }

    // FIX: More robust theme loading
    async loadTheme(themeId) {
        if (this._isLoadingTheme) {
            console.warn('⚠️ Theme loading already in progress');
            return;
        }

        if (this._failedThemes.has(themeId)) {
            console.warn(`⚠️ Theme '${themeId}' previously failed, skipping`);
            throw new Error(`Theme ${themeId} previously failed`);
        }

        const theme = this.availableThemes.get(themeId);
        if (!theme) {
            console.warn(`⚠️ Theme '${themeId}' not found in available themes`);
            throw new Error(`Theme ${themeId} not found`);
        }

        this._isLoadingTheme = true;

        try {
            // Add transition class
            document.body.classList.add('theme-transitioning');
            
            // Load the theme CSS with enhanced error handling
            await this.loadThemeCSS(theme.cssFile, theme.id);
            
            // Update current theme
            this.currentTheme = themeId;
            
            // Update body classes
            this.updateBodyClasses(theme);
            
            // Update theme meta tags
            this.updateThemeMetaTags(theme);
            
            // Save preference
            this.saveThemePreference(themeId);
            
            // Update controls
            this.updateThemeControls();
            
            // Dispatch event
            this.dispatchThemeChangeEvent(theme);
            
            console.log(`✅ Theme loaded successfully: ${theme.name}`);
            
        } catch (error) {
            this._failedThemes.add(themeId);
            throw error;
        } finally {
            this._isLoadingTheme = false;
            // Remove transition class
            setTimeout(() => {
                document.body.classList.remove('theme-transitioning');
            }, this.themeTransitionDuration);
        }
    }

    // FIX: Enhanced CSS loading with better error handling
    async loadThemeCSS(cssFile, themeId) {
        return new Promise((resolve, reject) => {
            // Remove existing theme stylesheet
            const existingTheme = document.getElementById('theme-stylesheet');
            
            // Create new stylesheet
            const link = document.createElement('link');
            link.id = 'theme-stylesheet';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            
            // Try multiple possible paths
            const possiblePaths = [
                cssFile,
                `assets/css/themes/${themeId}.css`,
                `css/themes/${themeId}.css`,
                `themes/${themeId}.css`
            ];
            
            let pathIndex = 0;
            
            const tryNextPath = () => {
                if (pathIndex >= possiblePaths.length) {
                    reject(new Error(`All CSS paths failed for theme: ${themeId}`));
                    return;
                }
                
                const currentPath = possiblePaths[pathIndex];
                console.log(`🔍 Trying CSS path: ${currentPath}`);
                
                link.href = `${currentPath}?v=${Date.now()}`;
                pathIndex++;
                
                // Set timeout for this attempt
                const timeout = setTimeout(() => {
                    console.warn(`⏰ CSS load timeout for: ${currentPath}`);
                    link.remove();
                    tryNextPath();
                }, this._cssTimeout);
                
                link.onload = () => {
                    clearTimeout(timeout);
                    if (existingTheme) {
                        existingTheme.remove();
                    }
                    console.log(`✅ CSS loaded successfully: ${currentPath}`);
                    resolve();
                };
                
                link.onerror = () => {
                    clearTimeout(timeout);
                    console.warn(`❌ CSS load error: ${currentPath}`);
                    link.remove();
                    tryNextPath();
                };
                
                // Add to head
                document.head.appendChild(link);
            };
            
            tryNextPath();
        });
    }

    // FIX: Built-in theme as absolute fallback
    async applyBuiltInTheme() {
        console.log('🚨 Applying built-in emergency theme');
        
        // Remove any existing theme stylesheets
        const existingTheme = document.getElementById('theme-stylesheet');
        if (existingTheme) {
            existingTheme.remove();
        }
        
        // Create built-in CSS
        const builtInCSS = this.generateBuiltInCSS();
        
        // Create style element
        const style = document.createElement('style');
        style.id = 'theme-stylesheet';
        style.textContent = builtInCSS;
        document.head.appendChild(style);
        
        // Update body classes
        this.updateBodyClasses({ id: 'built-in', isDark: false });
        
        this.currentTheme = 'built-in';
        console.log('✅ Built-in theme applied successfully');
    }

    // FIX: Generate built-in CSS
    generateBuiltInCSS() {
        return `
/* Built-in Emergency Theme */
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
    --text-primary: #212529;
    --text-secondary: #6c757d;
    --text-light: #ffffff;
    --background-card: rgba(255, 255, 255, 0.95);
    --border-light: rgba(255, 255, 255, 0.2);
    --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.1);
    --radius-lg: 16px;
    --radius-full: 50px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
}

body {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    margin: 0;
    padding: var(--spacing-lg);
}

.dashboard-header, .dashboard-footer, .card {
    background: var(--background-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-light);
    padding: var(--spacing-xl);
    margin-bottom: var(--spacing-lg);
}

.card-title {
    color: var(--primary-color);
    margin-bottom: var(--spacing-md);
}

.card-description {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
}

.card-link {
    display: block;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: var(--text-light);
    padding: var(--spacing-md) var(--spacing-lg);
    text-decoration: none;
    border-radius: var(--radius-full);
    text-align: center;
    transition: all 0.3s ease;
}

.card-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;
}

.category-title {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: var(--text-light);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    text-align: center;
    margin-bottom: var(--spacing-lg);
}

.search-input {
    width: 100%;
    padding: var(--spacing-md) var(--spacing-lg);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.9);
    outline: none;
}

.status-healthy { background-color: var(--success-color); }
.status-warning { background-color: var(--warning-color); }
.status-error { background-color: var(--danger-color); }
        `;
    }

    // FIX: Improved default themes loading
    loadDefaultThemes() {
        const defaultThemes = [
            {
                id: 'built-in',
                name: 'Built-in Emergency',
                description: 'Built-in fallback theme',
                cssFile: null, // No external file
                preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                isDark: false,
                isBuiltIn: true
            },
            {
                id: 'default',
                name: 'Default',
                description: 'Default 7gram theme with blue gradients',
                cssFile: 'assets/css/themes/default.css',
                preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                isDark: false
            },
            {
                id: 'dark',
                name: 'Dark Mode',
                description: 'Dark theme for low-light environments',
                cssFile: 'assets/css/themes/dark.css',
                preview: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
                isDark: true
            },
            {
                id: 'compact',
                name: 'Compact',
                description: 'Compact layout for smaller screens',
                cssFile: 'assets/css/themes/compact.css',
                preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                isDark: false
            },
            {
                id: 'high-contrast',
                name: 'High Contrast',
                description: 'High contrast theme for accessibility',
                cssFile: 'assets/css/themes/high-contrast.css',
                preview: 'linear-gradient(135deg, #000000 0%, #ffffff 100%)',
                isDark: false
            }
        ];

        defaultThemes.forEach(theme => {
            this.availableThemes.set(theme.id, theme);
        });
        
        console.log(`✅ Loaded ${defaultThemes.length} default themes`);
    }

    // FIX: More robust theme config loading
    async loadAvailableThemes() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('config/themes.json', {
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const themesConfig = await response.json();
                if (themesConfig?.themes && Array.isArray(themesConfig.themes)) {
                    themesConfig.themes.forEach(theme => {
                        if (theme.id && theme.name) {
                            this.availableThemes.set(theme.id, theme);
                        }
                    });
                    console.log(`✅ Loaded ${themesConfig.themes.length} additional themes from config`);
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('⚠️ Theme config load timeout');
            } else {
                console.warn('⚠️ Could not load themes config:', error.message);
            }
            // Don't throw - this is not critical
        }
    }

    // FIX: Enhanced fallback with built-in theme
    async loadFallbackTheme(originalThemeId) {
        const fallbackOrder = ['default', 'dark', 'compact', 'built-in'];
        
        for (const fallbackId of fallbackOrder) {
            if (fallbackId !== originalThemeId && 
                this.availableThemes.has(fallbackId) && 
                !this._failedThemes.has(fallbackId)) {
                
                console.log(`🔄 Trying fallback theme: ${fallbackId}`);
                
                if (fallbackId === 'built-in') {
                    await this.applyBuiltInTheme();
                    return;
                } else {
                    try {
                        await this.loadTheme(fallbackId);
                        return;
                    } catch (error) {
                        console.warn(`⚠️ Fallback theme ${fallbackId} also failed:`, error.message);
                    }
                }
            }
        }
        
        // If all else fails, use built-in
        console.error('❌ All fallback themes failed, using built-in');
        await this.applyBuiltInTheme();
    }

    // Keep existing methods but with improved error handling
    detectSystemPreference() {
        if (this.systemPreference.matches) {
            return this.availableThemes.has('dark') ? 'dark' : 'built-in';
        }
        return this.availableThemes.has('default') ? 'default' : 'built-in';
    }

    getSavedTheme() {
        try {
            const saved = localStorage.getItem(this.themeStorageKey);
            if (saved && this.availableThemes.has(saved) && !this._failedThemes.has(saved)) {
                return saved;
            }
            return null;
        } catch (error) {
            console.warn('⚠️ Could not access localStorage for theme preference');
            return null;
        }
    }

    updateBodyClasses(theme) {
        // Remove existing theme classes
        const classList = Array.from(document.body.classList);
        classList.forEach(className => {
            if (className.startsWith('theme-') || 
                className === 'dark-theme' || 
                className === 'light-theme' ||
                className === 'emergency-theme') {
                document.body.classList.remove(className);
            }
        });
        
        // Reset inline styles
        if (document.body.style.cssText) {
            document.body.style.cssText = '';
        }
        
        // Add new theme classes
        document.body.classList.add(`theme-${theme.id}`);
        
        if (theme.isDark) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.add('light-theme');
        }
    }

    // Add utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Enhanced public API
    async setTheme(themeId) {
        const success = await this.loadThemeWithRetry(themeId);
        if (!success) {
            console.warn(`Failed to set theme to ${themeId}, keeping current theme`);
        }
        return success;
    }

    getStatus() {
        return {
            currentTheme: this.currentTheme,
            availableThemes: this.availableThemes.size,
            failedThemes: Array.from(this._failedThemes),
            isLoading: this._isLoadingTheme,
            hasBuiltInFallback: true
        };
    }

    // Keep all other existing methods...
    updateThemeMetaTags(theme) {
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.name = 'theme-color';
            document.head.appendChild(themeColorMeta);
        }
        
        const primaryColor = theme.isDark ? '#2c3e50' : '#667eea';
        themeColorMeta.content = primaryColor;
        
        let colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
        if (!colorSchemeMeta) {
            colorSchemeMeta = document.createElement('meta');
            colorSchemeMeta.name = 'color-scheme';
            document.head.appendChild(colorSchemeMeta);
        }
        
        colorSchemeMeta.content = theme.isDark ? 'dark' : 'light';
    }

    setupThemeControls() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
            this.updateThemeToggleButton();
        }

        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            this.populateThemeSelector(themeSelector);
            themeSelector.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    populateThemeSelector(selector) {
        selector.innerHTML = '';
        
        this.availableThemes.forEach((theme, id) => {
            if (!this._failedThemes.has(id)) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = theme.name;
                option.selected = id === this.currentTheme;
                selector.appendChild(option);
            }
        });
    }

    updateThemeControls() {
        this.updateThemeToggleButton();
        
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.value = this.currentTheme;
        }
    }

    updateThemeToggleButton() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;
        
        const currentTheme = this.availableThemes.get(this.currentTheme);
        
        if (currentTheme?.isDark) {
            themeToggle.innerHTML = '☀️';
            themeToggle.title = 'Switch to Light Mode';
        } else {
            themeToggle.innerHTML = '🌙';
            themeToggle.title = 'Switch to Dark Mode';
        }
    }

    toggleTheme() {
        const currentTheme = this.availableThemes.get(this.currentTheme);
        
        if (currentTheme?.isDark) {
            const lightTheme = Array.from(this.availableThemes.values())
                .find(theme => !theme.isDark && !this._failedThemes.has(theme.id));
            if (lightTheme) {
                this.setTheme(lightTheme.id);
            }
        } else {
            const darkTheme = Array.from(this.availableThemes.values())
                .find(theme => theme.isDark && !this._failedThemes.has(theme.id));
            if (darkTheme) {
                this.setTheme(darkTheme.id);
            }
        }
    }

    setupSystemThemeListener() {
        this.systemPreference.addListener((e) => {
            const hasManualSelection = this.getSavedTheme();
            if (!hasManualSelection) {
                const preferredTheme = e.matches ? 'dark' : 'default';
                this.setTheme(preferredTheme);
            }
        });
    }

    saveThemePreference(themeId) {
        try {
            localStorage.setItem(this.themeStorageKey, themeId);
        } catch (error) {
            console.warn('⚠️ Could not save theme preference to localStorage');
        }
    }

    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themeChanged', {
            detail: {
                themeId: this.currentTheme,
                theme: theme,
                isDark: theme.isDark
            }
        });
        
        document.dispatchEvent(event);
    }

    getCurrentTheme() {
        return {
            id: this.currentTheme,
            ...this.availableThemes.get(this.currentTheme)
        };
    }

    getAvailableThemes() {
        return Array.from(this.availableThemes.values())
            .filter(theme => !this._failedThemes.has(theme.id));
    }

    isDarkMode() {
        const currentTheme = this.availableThemes.get(this.currentTheme);
        return currentTheme?.isDark || false;
    }
}