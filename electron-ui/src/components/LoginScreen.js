import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserPlus, LogIn } from 'lucide-react';
export function LoginScreen({ onLogin, onRegister }) {
    const [mode, setMode] = useState('login');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Force prefill credentials on mount
    useEffect(() => {
        setName('test');
        setPassword('test');
        console.log('LoginScreen: Force setting credentials to test/test');
    }, []);
    // Debug logging
    console.log('LoginScreen rendered with:', { name, password, mode });
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (mode === 'login') {
                await onLogin(name, password);
            }
            else {
                await onRegister(name, password);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background p-4", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx(CardTitle, { className: "text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent", children: "LAMA Desktop" }), _jsx(CardDescription, { children: mode === 'login' ? 'Welcome back! Please login to continue.' : 'Create a new account to get started.' })] }), _jsxs(CardContent, { children: [_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: "name", className: "text-sm font-medium", children: mode === 'login' ? 'Identity' : 'Identity Name' }), _jsx("input", { id: "name", type: "text", defaultValue: "test", onChange: (e) => setName(e.target.value), placeholder: mode === 'login' ? 'Your identity (public key or name)' : 'Choose an identity name', required: true, disabled: loading, className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Using cryptographic identities (moving to public keys)" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: "password", className: "text-sm font-medium", children: "Password" }), _jsx("input", { id: "password", type: "password", defaultValue: "test", onChange: (e) => setPassword(e.target.value), placeholder: "Enter your password", required: true, disabled: loading, className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" })] }), error && (_jsx(Alert, { variant: "destructive", children: _jsx(AlertDescription, { children: error }) })), _jsx(Button, { type: "submit", className: "w-full", disabled: loading || !name || !password, children: loading ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), mode === 'login' ? 'Logging in...' : 'Creating account...'] })) : (_jsx(_Fragment, { children: mode === 'login' ? (_jsxs(_Fragment, { children: [_jsx(LogIn, { className: "mr-2 h-4 w-4" }), "Login"] })) : (_jsxs(_Fragment, { children: [_jsx(UserPlus, { className: "mr-2 h-4 w-4" }), "Register"] })) })) }), _jsx("div", { className: "text-center", children: _jsx("button", { type: "button", onClick: () => {
                                            setMode(mode === 'login' ? 'register' : 'login');
                                            setError(null);
                                        }, className: "text-sm text-muted-foreground hover:text-primary transition-colors", disabled: loading, children: mode === 'login'
                                            ? "Don't have an account? Register"
                                            : 'Already have an account? Login' }) })] }), _jsxs("div", { className: "mt-6 pt-6 border-t text-center text-sm text-muted-foreground", children: [_jsx("p", { children: "\uD83D\uDD12 End-to-end encrypted" }), _jsx("p", { children: "\uD83C\uDF10 P2P messaging" }), _jsx("p", { children: "\uD83E\uDD16 Local AI processing" })] })] })] }) }));
}
