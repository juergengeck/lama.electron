import { jsx as _jsx } from "react/jsx-runtime";
/**
 * AppModel Context Provider
 * Provides access to the initialized AppModel throughout the application
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { AppModel } from '../models/AppModel';
const AppModelContext = createContext(undefined);
export function AppModelProvider({ children }) {
    const [appModel, setAppModel] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState(null);
    const initializeApp = async (userId) => {
        try {
            console.log('[AppModelProvider] Initializing app...');
            // Create and initialize AppModel
            const model = new AppModel({
                name: 'LAMA Electron',
                version: '1.0.0'
            });
            await model.init(userId);
            setAppModel(model);
            setIsInitialized(true);
            setError(null);
            console.log('[AppModelProvider] App initialized successfully');
        }
        catch (err) {
            console.error('[AppModelProvider] Failed to initialize app:', err);
            setError(err);
            setIsInitialized(false);
        }
    };
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (appModel) {
                console.log('[AppModelProvider] Shutting down app model...');
                appModel.shutdown().catch(console.error);
            }
        };
    }, [appModel]);
    return (_jsx(AppModelContext.Provider, { value: { appModel, isInitialized, error, initializeApp }, children: children }));
}
export function useAppModel() {
    const context = useContext(AppModelContext);
    if (!context) {
        throw new Error('useAppModel must be used within AppModelProvider');
    }
    return context;
}
