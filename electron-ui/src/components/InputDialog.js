import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function InputDialog({ open, onOpenChange, title, description, label, placeholder, defaultValue = '', onSubmit }) {
    const [value, setValue] = useState(defaultValue);
    // Reset value when dialog opens with new defaultValue
    useEffect(() => {
        if (open) {
            setValue(defaultValue);
        }
    }, [open, defaultValue]);
    const handleSubmit = () => {
        onSubmit(value);
        onOpenChange(false);
        setValue('');
    };
    const handleCancel = () => {
        onOpenChange(false);
        setValue('');
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-[425px]", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), description && (_jsx(DialogDescription, { children: description }))] }), _jsx("div", { className: "grid gap-4 py-4", children: _jsxs("div", { className: "grid gap-2", children: [label && _jsx(Label, { htmlFor: "input-value", children: label }), _jsx(Input, { id: "input-value", value: value, onChange: (e) => setValue(e.target.value), onKeyDown: handleKeyDown, placeholder: placeholder, autoFocus: true })] }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: handleCancel, children: "Cancel" }), _jsx(Button, { onClick: handleSubmit, children: "OK" })] })] }) }));
}
