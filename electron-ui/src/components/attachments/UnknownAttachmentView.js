import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FileQuestion, Download } from 'lucide-react';
import { formatFileSize } from '@/types/attachments';
import { useAttachmentDescriptor } from './AttachmentViewFactory';
import { Button } from '@/components/ui/button';
export const UnknownAttachmentView = ({ attachment, descriptor: providedDescriptor, onClick, onDownload, mode = 'inline', showMetadata = true, className = '' }) => {
    const { descriptor, loading } = useAttachmentDescriptor(attachment, providedDescriptor);
    const handleDownload = () => {
        if (onDownload) {
            onDownload(attachment);
        }
        else if (descriptor) {
            const blob = new Blob([descriptor.data], { type: descriptor.type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.name || descriptor.name || 'file';
            a.click();
            URL.revokeObjectURL(url);
        }
    };
    if (loading) {
        return (_jsxs("div", { className: `flex items-center gap-2 p-2 rounded border animate-pulse ${className}`, children: [_jsx("div", { className: "h-8 w-8 bg-muted rounded" }), _jsx("div", { className: "h-4 w-32 bg-muted rounded" })] }));
    }
    if (mode === 'compact') {
        return (_jsxs("div", { className: `inline-flex items-center gap-2 p-2 rounded border ${className}`, children: [_jsx(FileQuestion, { className: "h-4 w-4" }), _jsx("span", { className: "text-sm truncate", children: attachment.name || 'Unknown file' }), _jsx(Button, { size: "icon", variant: "ghost", className: "h-6 w-6", onClick: handleDownload, children: _jsx(Download, { className: "h-4 w-4" }) })] }));
    }
    return (_jsxs("div", { className: `flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${className}`, onClick: () => onClick?.(attachment), children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("div", { className: "h-10 w-10 rounded-lg bg-muted flex items-center justify-center", children: _jsx(FileQuestion, { className: "h-5 w-5 text-muted-foreground" }) }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium text-sm truncate", children: attachment.name || descriptor?.name || 'Unknown file' }), showMetadata && (_jsxs("div", { className: "text-xs text-muted-foreground", children: [attachment.mimeType || descriptor?.type || 'Unknown type', " \u2022 ", formatFileSize(attachment.size || descriptor?.size || 0)] }))] }), _jsx(Button, { size: "icon", variant: "ghost", onClick: (e) => {
                    e.stopPropagation();
                    handleDownload();
                }, children: _jsx(Download, { className: "h-4 w-4" }) })] }));
};
