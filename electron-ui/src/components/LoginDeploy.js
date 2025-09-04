import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Login/Deploy Component
 * Enter credentials to either login to existing instance or deploy new one
 * Security through obscurity - credentials determine the instance
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, User, Lock } from 'lucide-react';
export function LoginDeploy({ onLogin }) {
    // Demo user credentials prefilled
    const [username, setUsername] = useState('demo');
    const [password, setPassword] = useState('demo');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password)
            return;
        setIsLoading(true);
        setError(null);
        try {
            // Use the provided login function
            await onLogin(username, password);
            console.log('[LoginDeploy] Login successful');
        }
        catch (error) {
            console.error('[LoginDeploy] Login failed:', error);
            setError(error.message || 'Login failed');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-gray-900", children: _jsx(Card, { className: "w-full max-w-sm border-0 shadow-2xl", children: _jsx(CardContent, { className: "pt-6", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "LAMA" }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "Enter credentials to access or deploy" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "relative", children: [_jsx(User, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx(Input, { type: "text", placeholder: "Username", value: username, onChange: (e) => setUsername(e.target.value), className: "pl-10", disabled: isLoading, autoFocus: true, required: true })] }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx(Input, { type: "password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), className: "pl-10", disabled: isLoading, required: true })] })] }), _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading || !username || !password, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Initializing..."] })) : ('Enter') }), error && (_jsx("div", { className: "mt-4 text-sm text-red-500 text-center", children: error }))] }) }) }) }));
}
