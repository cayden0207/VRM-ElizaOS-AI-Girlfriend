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
        // Production environment - use relative path (same Vercel app)
        production: {
            baseURL: '',  // Use relative path, API is on the same domain
            timeout: 15000
        }
    },
    
    // Current environment - auto detection
    environment: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? 'development' : 'production',
    
    // Get API base URL
    getApiUrl() {
        const baseURL = this.API[this.environment].baseURL;
        // Production environment returns empty string to use relative path
        return baseURL;
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
    }
};

// Export configuration
window.AppConfig = AppConfig;

console.log(`📋 App configuration loaded - Environment: ${AppConfig.environment}`);