/**
 * React hook for LAMA initialization with proper ONE.CORE
 */
import { useState, useEffect, useCallback } from 'react';
import { browserInit } from '../services/browser-init';
export function useLamaInit() {
    const [state, setState] = useState({
        isInitialized: false,
        isAuthenticated: false,
        isLoading: false, // main.tsx handles the initial loading
        error: null,
        user: null
    });
    // Check initialization status on mount
    useEffect(() => {
        let mounted = true;
        const checkStatus = async () => {
            if (!mounted)
                return;
            try {
                const initialized = browserInit.isInitialized();
                const currentUser = browserInit.getCurrentUser();
                // lamaBridge is already initialized via IPC in its constructor
                // No need to connect AppModel - browser is UI-only
                setState({
                    isInitialized: initialized,
                    isAuthenticated: !!currentUser,
                    isLoading: false,
                    error: null,
                    user: currentUser ? {
                        email: `${currentUser.name}@lama.local`,
                        id: currentUser.id,
                        name: currentUser.name
                    } : null
                });
            }
            catch (error) {
                if (mounted) {
                    setState(prev => ({
                        ...prev,
                        isLoading: false,
                        error: error
                    }));
                }
            }
        };
        checkStatus();
        return () => {
            mounted = false;
        };
    }, []);
    const login = useCallback(async (username, password) => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const result = await browserInit.login(username, password);
            if (result.success && result.user) {
                // Save credentials for auto-login
                localStorage.setItem('lama-last-user', JSON.stringify({
                    username,
                    hint: password // Store password hint for auto-login
                }));
                // lamaBridge is already initialized via IPC in its constructor
                // No need to connect AppModel - browser is UI-only
                console.log('[useLamaInit] Login successful, lamaBridge uses IPC');
                setState(prev => ({
                    ...prev,
                    isAuthenticated: true,
                    isLoading: false,
                    user: {
                        email: `${result.user.name}@lama.local`,
                        id: result.user.id,
                        name: result.user.name
                    }
                }));
                console.log('[useLamaInit] Login successful:', result.user.name);
            }
            else {
                throw new Error('Login failed');
            }
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error
            }));
            throw error;
        }
    }, []);
    const register = useCallback(async (username, password) => {
        // Same flow as login for ONE.CORE SingleUserNoAuth
        return login(username, password);
    }, [login]);
    const logout = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            await browserInit.logout();
            // Clear saved credentials on logout
            localStorage.removeItem('lama-last-user');
            setState(prev => ({
                ...prev,
                isAuthenticated: false,
                isLoading: false,
                user: null
            }));
            console.log('[useLamaInit] Logout successful');
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error
            }));
            throw error;
        }
    }, []);
    return {
        ...state,
        login,
        register,
        logout,
        getLeuteModel: () => browserInit.getLeuteModel(),
        getChannelManager: () => browserInit.getChannelManager()
    };
}
