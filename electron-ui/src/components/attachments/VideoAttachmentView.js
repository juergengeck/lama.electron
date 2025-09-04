import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * VideoAttachmentView - Component for rendering video attachments
 */
import { useState, useEffect } from 'react';
import { Loader2, Download, Play } from 'lucide-react';
import { formatFileSize } from '@/types/attachments';
import { useAttachmentDescriptor } from './AttachmentViewFactory';
import { Button } from '@/components/ui/button';
export const VideoAttachmentView = ({ attachment, descriptor: providedDescriptor, onClick, onDownload, mode = 'inline', maxWidth = 400, maxHeight = 300, showMetadata = true, className = '' }) => {
    const { descriptor, loading, error } = useAttachmentDescriptor(attachment, providedDescriptor);
    const [videoUrl, setVideoUrl] = useState();
    useEffect(() => {
        if (!descriptor)
            return;
        // Create object URL from ArrayBuffer
        const blob = new Blob([descriptor.data], { type: descriptor.type });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        // Cleanup
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [descriptor]);
    const handleDownload = () => {
        if (onDownload) {
            onDownload(attachment);
        }
        else if (descriptor) {
            const blob = new Blob([descriptor.data], { type: descriptor.type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.name || descriptor.name || 'video';
            a.click();
            URL.revokeObjectURL(url);
        }
    };
    if (loading) {
        return (_jsx("div", { className: `flex items-center justify-center p-4 ${className}`, children: _jsx(Loader2, { className: "h-6 w-6 animate-spin text-muted-foreground" }) }));
    }
    if (error) {
        return (_jsx("div", { className: `text-sm text-red-500 p-2 ${className}`, children: "Failed to load video" }));
    }
    if (!videoUrl)
        return null;
    if (mode === 'compact') {
        return (_jsxs("div", { className: `inline-flex items-center gap-2 p-2 rounded border ${className}`, children: [_jsx("div", { className: "relative h-8 w-8 bg-muted rounded flex items-center justify-center", children: _jsx(Play, { className: "h-4 w-4" }) }), _jsx("span", { className: "text-sm", children: attachment.name || 'Video' }), _jsx(Button, { size: "icon", variant: "ghost", className: "h-6 w-6", onClick: handleDownload, children: _jsx(Download, { className: "h-4 w-4" }) })] }));
    }
    return (_jsxs("div", { className: `relative group ${className}`, children: [_jsx("video", { src: videoUrl, controls: true, style: { maxWidth, maxHeight }, className: "rounded shadow-md", onClick: () => onClick?.(attachment) }), _jsx("div", { className: "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(Button, { size: "icon", variant: "secondary", className: "h-8 w-8", onClick: handleDownload, children: _jsx(Download, { className: "h-4 w-4" }) }) }), showMetadata && (_jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: [attachment.name || 'Video', " \u2022 ", formatFileSize(attachment.size || 0)] }))] }));
};
