import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
function SimpleApp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState('');
    const handleLogin = (e) => {
        e.preventDefault();
        if (email && password) {
            setUserName(email.split('@')[0]);
            setIsLoggedIn(true);
        }
    };
    const handleLogout = () => {
        setIsLoggedIn(false);
        setEmail('');
        setPassword('');
        setUserName('');
    };
    if (isLoggedIn) {
        return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-2xl", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Welcome to LAMA Desktop" }), _jsxs(CardDescription, { children: ["Logged in as: ", userName] })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("p", { className: "text-muted-foreground", children: "LAMA Electron app is running with shadcn/ui components!" }), _jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Features:" }), _jsxs("ul", { className: "list-disc list-inside space-y-1 text-sm text-muted-foreground", children: [_jsx("li", { children: "\u2705 Electron desktop app" }), _jsx("li", { children: "\u2705 shadcn/ui components" }), _jsx("li", { children: "\u2705 Dark theme" }), _jsx("li", { children: "\u2705 ONE platform integration ready" }), _jsx("li", { children: "\u2705 UDP IPC for networking" })] })] }), _jsx(Button, { onClick: handleLogout, variant: "outline", className: "w-full", children: "Logout" })] })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "LAMA Desktop" }), _jsx(CardDescription, { children: "Sign in to your local-first messaging app" })] }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: handleLogin, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: "email", className: "text-sm font-medium", children: "Email" }), _jsx(Input, { id: "email", type: "email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: "password", className: "text-sm font-medium", children: "Password" }), _jsx(Input, { id: "password", type: "password", placeholder: "Enter your password", value: password, onChange: (e) => setPassword(e.target.value), required: true })] }), _jsx(Button, { type: "submit", className: "w-full", children: "Sign In" })] }) })] }) }));
}
export default SimpleApp;
