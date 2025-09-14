import { jsx as _jsx } from "react/jsx-runtime";
console.log('[MAIN] Starting LAMA with proper ONE.CORE initialization...');
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Initialize browser ONE.CORE instance (simple version)
import { browserInit as browserInit } from './services/browser-init';
async function startApp() {
    try {
        console.log('[MAIN] Initializing browser ONE.CORE instance...');
        const initResult = await browserInit.initialize();
        if (initResult.ready) {
            console.log('[MAIN] ✅ Browser ONE.CORE ready, starting React app');
            ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
        }
        else {
            console.error('[MAIN] ❌ Browser ONE.CORE initialization failed');
            // Still render the app - it can show error state
            ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
        }
    }
    catch (error) {
        console.error('[MAIN] Fatal initialization error:', error);
        // Still try to render the app
        ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
    }
}
// Start the application
startApp();
