import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ImageAttachmentView - Component for rendering image attachments
 */
import { useState, useEffect } from 'react';
import { Loader2, Download, Maximize2, X } from 'lucide-react';
import { formatFileSize } from '@/types/attachments';
import { useAttachmentDescriptor } from './AttachmentViewFactory';
import { Button } from '@/components/ui/button';
export const ImageAttachmentView = ({ attachment, descriptor: providedDescriptor, onClick, onDownload, mode = 'inline', maxWidth = 400, maxHeight = 300, showMetadata = true, className = '' }) => {
    const { descriptor, loading, error } = useAttachmentDescriptor(attachment, providedDescriptor);
    const [imageUrl, setImageUrl] = useState();
    const [fullscreen, setFullscreen] = useState(false);
    useEffect(() => {
        if (!descriptor)
            return;
        // Create object URL from ArrayBuffer
        const blob = new Blob([descriptor.data], { type: descriptor.type });
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        // Cleanup
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [descriptor]);
    const handleClick = () => {
        if (onClick) {
            onClick(attachment);
        }
        else {
            setFullscreen(true);
        }
    };
    const handleDownload = () => {
        if (onDownload) {
            onDownload(attachment);
        }
        else if (descriptor) {
            // Create download link
            const blob = new Blob([descriptor.data], { type: descriptor.type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.name || descriptor.name || 'image';
            a.click();
            URL.revokeObjectURL(url);
        }
    };
    if (loading) {
        return (_jsx("div", { className: `flex items-center justify-center p-4 ${className}`, children: _jsx(Loader2, { className: "h-6 w-6 animate-spin text-muted-foreground" }) }));
    }
    if (error) {
        return (_jsx("div", { className: `text-sm text-red-500 p-2 ${className}`, children: "Failed to load image" }));
    }
    if (!imageUrl)
        return null;
    // Render based on mode
    if (mode === 'compact') {
        return (_jsxs("div", { className: `inline-flex items-center gap-2 p-2 rounded border ${className}`, children: [_jsx("img", { src: imageUrl, alt: attachment.name || 'Image', className: "h-8 w-8 object-cover rounded" }), _jsx("span", { className: "text-sm", children: attachment.name || 'Image' }), _jsx(Button, { size: "icon", variant: "ghost", className: "h-6 w-6", onClick: handleDownload, children: _jsx(Download, { className: "h-4 w-4" }) })] }));
    }
    if (mode === 'thumbnail') {
        return (_jsxs("div", { className: `relative cursor-pointer group ${className}`, onClick: handleClick, style: { maxWidth: 120, maxHeight: 120 }, children: [_jsx("img", { src: imageUrl, alt: attachment.name || 'Image', className: "w-full h-full object-cover rounded" }), _jsx("div", { className: "absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded flex items-center justify-center", children: _jsx(Maximize2, { className: "h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" }) })] }));
    }
    // Default inline mode
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: `relative group ${className}`, children: [_jsxs("div", { className: "cursor-pointer", onClick: handleClick, style: { maxWidth, maxHeight }, children: [_jsx("img", { src: imageUrl, alt: attachment.name || 'Image', className: "rounded shadow-md max-w-full max-h-full object-contain" }), _jsxs("div", { className: "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1", children: [_jsx(Button, { size: "icon", variant: "secondary", className: "h-8 w-8", onClick: (e) => {
                                            e.stopPropagation();
                                            setFullscreen(true);
                                        }, children: _jsx(Maximize2, { className: "h-4 w-4" }) }), _jsx(Button, { size: "icon", variant: "secondary", className: "h-8 w-8", onClick: (e) => {
                                            e.stopPropagation();
                                            handleDownload();
                                        }, children: _jsx(Download, { className: "h-4 w-4" }) })] })] }), showMetadata && (_jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: [attachment.name || 'Image', " \u2022 ", formatFileSize(attachment.size || 0)] }))] }), fullscreen && (_jsx("div", { className: "fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4", onClick: () => setFullscreen(false), children: _jsxs("div", { className: "relative max-w-full max-h-full", children: [_jsx("img", { src: imageUrl, alt: attachment.name || 'Image', className: "max-w-full max-h-full object-contain", onClick: (e) => e.stopPropagation() }), _jsx(Button, { size: "icon", variant: "ghost", className: "absolute top-4 right-4 text-white hover:bg-white/20", onClick: () => setFullscreen(false), children: _jsx(X, { className: "h-6 w-6" }) }), _jsx(Button, { size: "icon", variant: "ghost", className: "absolute bottom-4 right-4 text-white hover:bg-white/20", onClick: (e) => {
                                e.stopPropagation();
                                handleDownload();
                            }, children: _jsx(Download, { className: "h-6 w-6" }) }), _jsxs("div", { className: "absolute bottom-4 left-4 text-white", children: [_jsx("div", { className: "text-lg font-medium", children: attachment.name || 'Image' }), _jsx("div", { className: "text-sm opacity-80", children: formatFileSize(attachment.size || 0) })] })] }) }))] }));
};
