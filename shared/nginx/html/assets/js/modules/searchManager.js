// assets/js/modules/searchManager.js - Categories Structure Fix
export class SearchManager {
    constructor() {
        this.services = [];
        this.categories = {}; // Changed to object to match main.js structure
        this.searchIndex = new Map();
        this.recentSearches = this.loadRecentSearches();
        this.searchSuggestions = [];
        this.debounceTimer = null;
        this.minSearchLength = 1;
    }

    initialize(services, categories) {
        this.services = services;
        this.categories = categories || {}; // Ensure it's an object
        this.buildSearchIndex();
        this.setupSearchInput();
        this.setupKeyboardShortcuts();
        console.log(`🔍 Search initialized with ${services.length} services and ${Object.keys(this.categories).length} categories`);
    }

    buildSearchIndex() {
        this.searchIndex.clear();
        
        this.services.forEach(service => {
            const searchTerms = [
                service.name.toLowerCase(),
                service.description.toLowerCase(),
                service.category.toLowerCase(),
                ...(service.tags || []).map(tag => tag.toLowerCase()),
                service.type?.toLowerCase() || '',
                service.id.toLowerCase()
            ].filter(term => term.length > 0);

            this.searchIndex.set(service.id, {
                service: service,
                searchTerms: searchTerms.join(' ')
            });
        });
    }

    setupSearchInput() {
        const searchInput = document.getElementById('search-input');
        const searchSuggestions = document.getElementById('search-suggestions');
        
        if (!searchInput) {
            console.warn('⚠️ Search input not found');
            return;
        }

        // Input event with debouncing
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 150);
        });

        // Focus events for suggestions
        searchInput.addEventListener('focus', () => {
            this.showSearchSuggestions();
        });

        searchInput.addEventListener('blur', (e) => {
            // Delay hiding suggestions to allow clicking
            setTimeout(() => {
                this.hideSearchSuggestions();
            }, 200);
        });

        // Arrow key navigation
        searchInput.addEventListener('keydown', (e) => {
            this.handleSearchNavigation(e);
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Escape to clear search
            if (e.key === 'Escape') {
                const searchInput = document.getElementById('search-input');
                if (searchInput && document.activeElement === searchInput) {
                    searchInput.value = '';
                    this.performSearch('');
                    searchInput.blur();
                }
            }
        });
    }

    performSearch(query) {
        const trimmedQuery = query.trim();
        
        if (trimmedQuery.length === 0) {
            this.showAllServices();
            this.updateSearchSuggestions([]);
            return;
        }

        if (trimmedQuery.length < this.minSearchLength) {
            return;
        }

        // Add to recent searches
        this.addToRecentSearches(trimmedQuery);

        // Perform the search
        const results = this.searchServices(trimmedQuery);
        
        // Update UI
        this.displaySearchResults(results, trimmedQuery);
        this.generateSearchSuggestions(trimmedQuery);
        
        // Analytics
        this.trackSearch(trimmedQuery, results.length);
    }

    searchServices(query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        const results = [];

        for (const [serviceId, indexData] of this.searchIndex) {
            let score = 0;
            let matches = 0;

            searchTerms.forEach(term => {
                if (indexData.searchTerms.includes(term)) {
                    matches++;
                    
                    // Boost score for exact name matches
                    if (indexData.service.name.toLowerCase().includes(term)) {
                        score += 10;
                    }
                    
                    // Boost score for category matches
                    if (indexData.service.category.toLowerCase().includes(term)) {
                        score += 5;
                    }
                    
                    // Regular term match
                    score += 1;
                }
            });

            // Only include if all search terms found some match
            if (matches === searchTerms.length && score > 0) {
                results.push({
                    service: indexData.service,
                    score: score,
                    matches: matches
                });
            }
        }

        // Sort by score (descending) then by name
        results.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.service.name.localeCompare(b.service.name);
        });

        return results.map(result => result.service);
    }

    displaySearchResults(results, query) {
        const categories = document.querySelectorAll('.category');
        const cards = document.querySelectorAll('.card');
        const noResults = document.getElementById('no-results');

        if (results.length === 0) {
            // Hide all
            categories.forEach(cat => cat.style.display = 'none');
            cards.forEach(card => card.style.display = 'none');
            if (noResults) {
                noResults.style.display = 'block';
                this.updateNoResultsMessage(query);
            }
            return;
        }

        // Hide no results
        if (noResults) {
            noResults.style.display = 'none';
        }

        // Hide all categories first
        categories.forEach(cat => cat.style.display = 'none');
        cards.forEach(card => card.style.display = 'none');

        // Show matching services and their categories
        const visibleCategories = new Set();
        
        results.forEach(service => {
            const card = document.querySelector(`[data-service="${service.id}"]`);
            if (card) {
                card.style.display = 'flex';
                
                // Highlight search terms
                this.highlightSearchTerms(card, query);
                
                // Show parent category
                const category = card.closest('.category');
                if (category) {
                    category.style.display = 'block';
                    visibleCategories.add(category);
                }
            }
        });

        // Update category headers with result counts
        visibleCategories.forEach(category => {
            const visibleCards = category.querySelectorAll('.card[style*="flex"]').length;
            const categoryTitle = category.querySelector('.category-title');
            if (categoryTitle) {
                const originalText = categoryTitle.textContent.replace(/ \(\d+\)$/, '');
                categoryTitle.textContent = `${originalText} (${visibleCards})`;
            }
        });
    }

    highlightSearchTerms(card, query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        const elementsToHighlight = [
            card.querySelector('.card-title'),
            card.querySelector('.card-description')
        ].filter(el => el);

        elementsToHighlight.forEach(element => {
            if (!element.dataset.originalText) {
                element.dataset.originalText = element.textContent;
            }
            
            let highlightedText = element.dataset.originalText;
            
            searchTerms.forEach(term => {
                const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
                highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
            });
            
            element.innerHTML = highlightedText;
        });
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    showAllServices() {
        const categories = document.querySelectorAll('.category');
        const cards = document.querySelectorAll('.card');
        const noResults = document.getElementById('no-results');

        // Show everything
        categories.forEach(cat => cat.style.display = 'block');
        cards.forEach(card => {
            card.style.display = 'flex';
            // Remove highlighting
            this.removeHighlighting(card);
        });

        // Hide no results
        if (noResults) {
            noResults.style.display = 'none';
        }

        // Reset category titles
        categories.forEach(category => {
            const categoryTitle = category.querySelector('.category-title');
            if (categoryTitle) {
                categoryTitle.textContent = categoryTitle.textContent.replace(/ \(\d+\)$/, '');
            }
        });
    }

    removeHighlighting(card) {
        const elementsToUnhighlight = [
            card.querySelector('.card-title'),
            card.querySelector('.card-description')
        ].filter(el => el);

        elementsToUnhighlight.forEach(element => {
            if (element.dataset.originalText) {
                element.textContent = element.dataset.originalText;
            }
        });
    }

    generateSearchSuggestions(query) {
        const suggestions = [];
        
        // Recent searches
        this.recentSearches.forEach(recent => {
            if (recent.includes(query.toLowerCase()) && recent !== query.toLowerCase()) {
                suggestions.push({
                    type: 'recent',
                    text: recent,
                    icon: '🕐'
                });
            }
        });

        // Service name suggestions
        this.services.forEach(service => {
            if (service.name.toLowerCase().includes(query.toLowerCase()) && 
                !suggestions.find(s => s.text.toLowerCase() === service.name.toLowerCase())) {
                suggestions.push({
                    type: 'service',
                    text: service.name,
                    icon: service.icon,
                    service: service
                });
            }
        });

        // Category suggestions - FIXED to handle object structure
        if (this.categories && typeof this.categories === 'object') {
            Object.keys(this.categories).forEach(categoryName => {
                if (categoryName.toLowerCase().includes(query.toLowerCase()) &&
                    !suggestions.find(s => s.text.toLowerCase() === categoryName.toLowerCase())) {
                    
                    // Get category info from first service in category
                    const categoryServices = this.categories[categoryName];
                    const firstService = Array.isArray(categoryServices) && categoryServices.length > 0 ? categoryServices[0] : null;
                    
                    suggestions.push({
                        type: 'category',
                        text: categoryName,
                        icon: firstService?.categoryIcon || '📦'
                    });
                }
            });
        }

        this.updateSearchSuggestions(suggestions.slice(0, 8));
    }

    updateSearchSuggestions(suggestions) {
        const suggestionsElement = document.getElementById('search-suggestions');
        if (!suggestionsElement) return;

        if (suggestions.length === 0) {
            suggestionsElement.style.display = 'none';
            return;
        }

        const suggestionsHtml = suggestions.map(suggestion => `
            <div class="search-suggestion" data-type="${suggestion.type}" data-text="${suggestion.text}">
                <span class="suggestion-icon">${suggestion.icon}</span>
                <span class="suggestion-text">${suggestion.text}</span>
                <span class="suggestion-type">${suggestion.type}</span>
            </div>
        `).join('');

        suggestionsElement.innerHTML = suggestionsHtml;
        suggestionsElement.style.display = 'block';

        // Add click handlers
        suggestionsElement.querySelectorAll('.search-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                const text = suggestion.dataset.text;
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.value = text;
                    this.performSearch(text);
                    this.hideSearchSuggestions();
                }
            });
        });
    }

    showSearchSuggestions() {
        const searchInput = document.getElementById('search-input');
        const suggestionsElement = document.getElementById('search-suggestions');
        
        if (searchInput && suggestionsElement && searchInput.value.trim()) {
            this.generateSearchSuggestions(searchInput.value);
        }
    }

    hideSearchSuggestions() {
        const suggestionsElement = document.getElementById('search-suggestions');
        if (suggestionsElement) {
            suggestionsElement.style.display = 'none';
        }
    }

    handleSearchNavigation(e) {
        const suggestionsElement = document.getElementById('search-suggestions');
        if (!suggestionsElement || suggestionsElement.style.display === 'none') return;

        const suggestions = suggestionsElement.querySelectorAll('.search-suggestion');
        const currentActive = suggestionsElement.querySelector('.search-suggestion.active');
        let activeIndex = currentActive ? Array.from(suggestions).indexOf(currentActive) : -1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, suggestions.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, -1);
                break;
            case 'Enter':
                if (currentActive) {
                    e.preventDefault();
                    currentActive.click();
                }
                return;
            case 'Escape':
                this.hideSearchSuggestions();
                return;
            default:
                return;
        }

        // Update active suggestion
        suggestions.forEach((suggestion, index) => {
            suggestion.classList.toggle('active', index === activeIndex);
        });
    }

    updateNoResultsMessage(query) {
        const noResults = document.getElementById('no-results');
        if (noResults) {
            noResults.innerHTML = `
                <h3>🔍 No services found</h3>
                <p>No services match "<strong>${this.escapeHtml(query)}</strong>".</p>
                <p>Try a different search term or browse all services.</p>
                <button onclick="document.getElementById('search-input').value = ''; window.searchManager.performSearch('');" class="clear-search-btn">
                    Clear Search
                </button>
            `;
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Recent searches management
    addToRecentSearches(query) {
        const lowerQuery = query.toLowerCase();
        
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(search => search !== lowerQuery);
        
        // Add to beginning
        this.recentSearches.unshift(lowerQuery);
        
        // Keep only last 10
        this.recentSearches = this.recentSearches.slice(0, 10);
        
        // Save to localStorage
        this.saveRecentSearches();
    }

    loadRecentSearches() {
        try {
            const saved = localStorage.getItem('7gram-recent-searches');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('⚠️ Failed to load recent searches:', error);
            return [];
        }
    }

    saveRecentSearches() {
        try {
            localStorage.setItem('7gram-recent-searches', JSON.stringify(this.recentSearches));
        } catch (error) {
            console.warn('⚠️ Failed to save recent searches:', error);
        }
    }

    clearRecentSearches() {
        this.recentSearches = [];
        this.saveRecentSearches();
    }

    // Analytics
    trackSearch(query, resultCount) {
        const searchEvent = {
            query: query,
            resultCount: resultCount,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        // Log for debugging
        console.log(`🔍 Search: "${query}" → ${resultCount} results`);

        // Store search analytics
        this.storeSearchAnalytics(searchEvent);
    }

    storeSearchAnalytics(event) {
        try {
            const analytics = JSON.parse(localStorage.getItem('7gram-search-analytics') || '[]');
            analytics.push(event);
            
            // Keep only last 100 searches
            const recentAnalytics = analytics.slice(-100);
            localStorage.setItem('7gram-search-analytics', JSON.stringify(recentAnalytics));
        } catch (error) {
            console.warn('⚠️ Failed to store search analytics:', error);
        }
    }

    getSearchAnalytics() {
        try {
            return JSON.parse(localStorage.getItem('7gram-search-analytics') || '[]');
        } catch (error) {
            console.warn('⚠️ Failed to load search analytics:', error);
            return [];
        }
    }

    // Public API for debugging
    getStatus() {
        return {
            services: this.services.length,
            categories: Object.keys(this.categories).length,
            searchIndex: this.searchIndex.size,
            recentSearches: this.recentSearches.length
        };
    }
}