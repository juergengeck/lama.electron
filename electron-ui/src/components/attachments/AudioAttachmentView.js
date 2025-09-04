import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * AudioAttachmentView - Component for rendering audio attachments
 */
import { useState, useEffect } from 'react';
import { Loader2, Download, Music } from 'lucide-react';
import { formatFileSize } from '@/types/attachments';
import { useAttachmentDescriptor } from './AttachmentViewFactory';
import { Button } from '@/components/ui/button';
export const AudioAttachmentView = ({ attachment, descriptor: providedDescriptor, onClick, onDownload, mode = 'inline', showMetadata = true, className = '' }) => {
    const { descriptor, loading, error } = useAttachmentDescriptor(attachment, providedDescriptor);
    const [audioUrl, setAudioUrl] = useState();
    useEffect(() => {
        if (!descriptor)
            return;
        const blob = new Blob([descriptor.data], { type: descriptor.type });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
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
            a.download = attachment.name || descriptor.name || 'audio';
            a.click();
            URL.revokeObjectURL(url);
        }
    };
    if (loading) {
        return (_jsx("div", { className: `flex items-center justify-center p-4 ${className}`, children: _jsx(Loader2, { className: "h-6 w-6 animate-spin text-muted-foreground" }) }));
    }
    if (error) {
        return (_jsx("div", { className: `text-sm text-red-500 p-2 ${className}`, children: "Failed to load audio" }));
    }
    if (!audioUrl)
        return null;
    if (mode === 'compact') {
        return (_jsxs("div", { className: `inline-flex items-center gap-2 p-2 rounded border ${className}`, children: [_jsx(Music, { className: "h-4 w-4" }), _jsx("span", { className: "text-sm", children: attachment.name || 'Audio' }), _jsx(Button, { size: "icon", variant: "ghost", className: "h-6 w-6", onClick: handleDownload, children: _jsx(Download, { className: "h-4 w-4" }) })] }));
    }
    return (_jsx("div", { className: `${className}`, children: _jsxs("div", { className: "flex items-center gap-3 p-3 rounded-lg border bg-card", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("div", { className: "h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center", children: _jsx(Music, { className: "h-5 w-5 text-primary" }) }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("audio", { src: audioUrl, controls: true, className: "w-full", onClick: () => onClick?.(attachment) }), showMetadata && (_jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: [attachment.name || 'Audio', " \u2022 ", formatFileSize(attachment.size || 0)] }))] }), _jsx(Button, { size: "icon", variant: "ghost", onClick: handleDownload, children: _jsx(Download, { className: "h-4 w-4" }) })] }) }));
};
