/**
 * Application Configuration File
 * Only need to modify this file when deploying to production
 */

const AppConfig = {
    // API server configuration
    API: {
        // Development environment
        development: {
            baseURL: 'http://localhost:3001',
            timeout: 10000
        },
        // Production environment - point to Bridge (single, stable Node service)
        production: {
            baseURL: 'https://vrm-elizaos-ai-girlfriend-production.up.railway.app',
            timeout: 15000
        }
    },
    
    // Current environment - auto detection
    environment: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? 'development' : 'production',
    
    // Get API base URL
    getApiUrl() {
        const baseURL = this.API[this.environment].baseURL;
        return baseURL || '';
    },
    
    // Note: Supabase access has been migrated to backend, frontend no longer needs direct access
    // Supabase configuration removed for better security
    
    // Feature toggles
    features: {
        enableLocalStorage: false,  // Should be false in production
        enableDebugLogs: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')), // Auto detection
        requireWalletSignature: false, // TODO: Should be true in production
    },
    
    // Error messages
    messages: {
        networkError: 'Network connection failed, please check your network and refresh the page',
        saveError: 'Save failed, please try again',
        deleteError: 'Delete failed, please try again',
        loadError: 'Loading failed, please refresh the page'
    },

    // Debug logging system
    debug: {
        log: function(...args) {
            if (AppConfig.features.enableDebugLogs) {
                console.log(...args);
            }
        },
        warn: function(...args) {
            if (AppConfig.features.enableDebugLogs) {
                console.warn(...args);
            }
        },
        error: function(...args) {
            // Always show errors
            console.error(...args);
        },
        info: function(...args) {
            // Always show important info in production
            console.log(...args);
        }
    }
};

// Export configuration
window.AppConfig = AppConfig;

console.log(`📋 App configuration loaded - Environment: ${AppConfig.environment}`);
