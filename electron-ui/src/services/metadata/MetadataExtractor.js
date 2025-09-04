/**
 * MetadataExtractor - Extracts rich metadata from files for Subject generation
 *
 * This service extracts EXIF, IPTC, XMP and other metadata from images and documents,
 * converting them into Subjects that contribute to identity emergence.
 */
/**
 * Metadata extraction service
 */
export class MetadataExtractor {
    static getInstance() {
        if (!MetadataExtractor.instance) {
            MetadataExtractor.instance = new MetadataExtractor();
        }
        return MetadataExtractor.instance;
    }
    /**
     * Extract metadata from file
     */
    async extractMetadata(file) {
        console.log(`[MetadataExtractor] Extracting metadata from ${file.name}`);
        const metadata = {
            fileName: file.name,
            fileType: this.getFileType(file),
            mimeType: file.type,
            size: file.size,
            lastModified: new Date(file.lastModified),
            subjects: []
        };
        // Extract based on file type
        if (file.type.startsWith('image/')) {
            await this.extractImageMetadata(file, metadata);
        }
        else if (file.type.includes('pdf')) {
            await this.extractPdfMetadata(file, metadata);
        }
        else if (file.type.startsWith('video/')) {
            await this.extractVideoMetadata(file, metadata);
        }
        else if (file.type.startsWith('audio/')) {
            await this.extractAudioMetadata(file, metadata);
        }
        // Generate subjects from metadata
        metadata.subjects = this.generateSubjects(metadata);
        console.log(`[MetadataExtractor] Extracted ${metadata.subjects.length} subjects:`, metadata.subjects);
        return metadata;
    }
    /**
     * Extract EXIF and other image metadata
     */
    async extractImageMetadata(file, metadata) {
        try {
            // For browser environment, we'll parse EXIF manually
            const arrayBuffer = await file.arrayBuffer();
            const exif = await this.parseExif(arrayBuffer);
            if (exif) {
                metadata.exif = exif;
                // Extract timestamp
                if (exif.dateTimeOriginal) {
                    metadata.timestamp = exif.dateTimeOriginal;
                }
                // Extract location
                if (exif.gpsLatitude && exif.gpsLongitude) {
                    metadata.location = {
                        latitude: exif.gpsLatitude,
                        longitude: exif.gpsLongitude,
                        altitude: exif.gpsAltitude,
                        subjects: this.getLocationSubjects(exif.gpsLatitude, exif.gpsLongitude)
                    };
                }
                // Extract device info
                if (exif.make || exif.model) {
                    metadata.device = {
                        manufacturer: exif.make,
                        model: exif.model,
                        type: this.detectDeviceType(exif.make, exif.model),
                        subjects: this.getDeviceSubjects(exif.make, exif.model)
                    };
                }
                // Detect scene type
                metadata.scene = this.detectSceneType(exif, file.name);
            }
        }
        catch (error) {
            console.warn('[MetadataExtractor] Failed to extract EXIF:', error);
        }
    }
    /**
     * Parse EXIF data from image buffer
     */
    async parseExif(buffer) {
        const view = new DataView(buffer);
        // Check for JPEG
        if (view.getUint16(0) !== 0xFFD8) {
            return null; // Not a JPEG
        }
        // Find EXIF marker (0xFFE1)
        let offset = 2;
        while (offset < view.byteLength - 2) {
            const marker = view.getUint16(offset);
            if (marker === 0xFFE1) {
                // Found EXIF marker
                const exifLength = view.getUint16(offset + 2);
                const exifStart = offset + 4;
                // Check for "Exif\0\0"
                if (view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0x0000) {
                    return this.parseExifData(view, exifStart + 6);
                }
            }
            // Move to next marker
            if ((marker & 0xFF00) === 0xFF00) {
                offset += 2 + view.getUint16(offset + 2);
            }
            else {
                break;
            }
        }
        return null;
    }
    /**
     * Parse EXIF data structure
     */
    parseExifData(view, start) {
        const exif = {};
        // Simplified EXIF parsing - in production, use a library like exifr or piexifjs
        // This is a basic implementation for demonstration
        // Check byte order (little vs big endian)
        const isLittleEndian = view.getUint16(start) === 0x4949;
        // Parse IFD entries
        const ifdOffset = start + view.getUint32(start + 4, isLittleEndian);
        const entryCount = view.getUint16(ifdOffset, isLittleEndian);
        for (let i = 0; i < entryCount; i++) {
            const entryOffset = ifdOffset + 2 + (i * 12);
            const tag = view.getUint16(entryOffset, isLittleEndian);
            // Parse common EXIF tags
            switch (tag) {
                case 0x010F: // Make
                    exif.make = this.getExifString(view, entryOffset + 8, start, isLittleEndian);
                    break;
                case 0x0110: // Model
                    exif.model = this.getExifString(view, entryOffset + 8, start, isLittleEndian);
                    break;
                case 0x9003: // DateTimeOriginal
                    const dateStr = this.getExifString(view, entryOffset + 8, start, isLittleEndian);
                    if (dateStr) {
                        exif.dateTimeOriginal = this.parseExifDate(dateStr);
                    }
                    break;
                case 0x8827: // ISO
                    exif.iso = view.getUint16(entryOffset + 8, isLittleEndian);
                    break;
                // Add more tags as needed
            }
        }
        return exif;
    }
    /**
     * Get EXIF string value
     */
    getExifString(view, offset, tiffStart, isLittleEndian) {
        const count = view.getUint32(offset - 4, isLittleEndian);
        if (count <= 4) {
            // String fits in the offset field
            let str = '';
            for (let i = 0; i < count - 1; i++) {
                str += String.fromCharCode(view.getUint8(offset + i));
            }
            return str;
        }
        else {
            // String is stored elsewhere
            const stringOffset = view.getUint32(offset, isLittleEndian);
            let str = '';
            for (let i = 0; i < count - 1; i++) {
                str += String.fromCharCode(view.getUint8(tiffStart + stringOffset + i));
            }
            return str;
        }
    }
    /**
     * Parse EXIF date format (YYYY:MM:DD HH:MM:SS)
     */
    parseExifDate(dateStr) {
        const [date, time] = dateStr.split(' ');
        const [year, month, day] = date.split(':').map(Number);
        const [hour, minute, second] = time.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, second);
    }
    /**
     * Extract PDF metadata
     */
    async extractPdfMetadata(file, metadata) {
        // Simplified PDF metadata extraction
        // In production, use a library like pdf.js
        const text = await this.readFileAsText(file, 1024); // Read first 1KB
        // Look for common PDF metadata patterns
        const authorMatch = text.match(/\/Author\s*\(([^)]+)\)/);
        if (authorMatch) {
            metadata.author = authorMatch[1];
        }
        const titleMatch = text.match(/\/Title\s*\(([^)]+)\)/);
        if (titleMatch) {
            metadata.title = titleMatch[1];
        }
        const keywordsMatch = text.match(/\/Keywords\s*\(([^)]+)\)/);
        if (keywordsMatch) {
            metadata.keywords = keywordsMatch[1].split(/[,;]/).map(k => k.trim());
        }
    }
    /**
     * Extract video metadata
     */
    async extractVideoMetadata(file, metadata) {
        // Basic video metadata from file properties
        // In production, use a library like mp4box.js
        metadata.scene = {
            type: 'action',
            tags: ['video', 'media', 'motion']
        };
        // Extract from filename patterns
        const fileName = file.name.toLowerCase();
        if (fileName.includes('timelapse')) {
            metadata.scene.tags?.push('timelapse');
        }
        if (fileName.includes('slow')) {
            metadata.scene.tags?.push('slowmotion');
        }
    }
    /**
     * Extract audio metadata
     */
    async extractAudioMetadata(file, metadata) {
        // Basic audio metadata
        // In production, use a library like music-metadata-browser
        const fileName = file.name.toLowerCase();
        const tags = ['audio', 'sound'];
        if (fileName.includes('podcast'))
            tags.push('podcast');
        if (fileName.includes('music'))
            tags.push('music');
        if (fileName.includes('voice'))
            tags.push('voice', 'recording');
        metadata.subjects = tags;
    }
    /**
     * Generate subjects from extracted metadata
     */
    generateSubjects(metadata) {
        const subjects = new Set();
        // From file type
        subjects.add(metadata.fileType);
        // From EXIF
        if (metadata.exif) {
            if (metadata.exif.make) {
                subjects.add(metadata.exif.make.toLowerCase().replace(/[^a-z0-9]/g, ''));
            }
            if (metadata.exif.artist) {
                subjects.add('by-' + metadata.exif.artist.toLowerCase().replace(/[^a-z0-9]/g, ''));
            }
        }
        // From location
        if (metadata.location) {
            metadata.location.subjects.forEach(s => subjects.add(s));
        }
        // From device
        if (metadata.device) {
            metadata.device.subjects.forEach(s => subjects.add(s));
        }
        // From scene
        if (metadata.scene) {
            if (metadata.scene.type) {
                subjects.add(metadata.scene.type);
            }
            if (metadata.scene.indoor !== undefined) {
                subjects.add(metadata.scene.indoor ? 'indoor' : 'outdoor');
            }
            metadata.scene.tags?.forEach(t => subjects.add(t));
        }
        // From timestamp
        if (metadata.timestamp) {
            const year = metadata.timestamp.getFullYear();
            const month = metadata.timestamp.getMonth();
            subjects.add(year.toString());
            subjects.add(['january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'][month]);
            const hour = metadata.timestamp.getHours();
            if (hour >= 6 && hour < 12)
                subjects.add('morning');
            else if (hour >= 12 && hour < 17)
                subjects.add('afternoon');
            else if (hour >= 17 && hour < 21)
                subjects.add('evening');
            else
                subjects.add('night');
        }
        // From keywords
        if (metadata.keywords) {
            metadata.keywords.forEach(k => subjects.add(k.toLowerCase()));
        }
        // From people
        if (metadata.people) {
            metadata.people.forEach(p => subjects.add('person-' + p.toLowerCase()));
        }
        return Array.from(subjects);
    }
    /**
     * Get location-based subjects
     */
    getLocationSubjects(lat, lng) {
        const subjects = ['geotagged', 'location'];
        // Rough geographic regions (simplified)
        if (lat > 0)
            subjects.push('northern-hemisphere');
        else
            subjects.push('southern-hemisphere');
        if (Math.abs(lat) < 23.5)
            subjects.push('tropical');
        else if (Math.abs(lat) > 66.5)
            subjects.push('polar');
        else
            subjects.push('temperate');
        // You could add reverse geocoding here to get city/country
        return subjects;
    }
    /**
     * Get device-based subjects
     */
    getDeviceSubjects(make, model) {
        const subjects = [];
        if (make) {
            const makeLower = make.toLowerCase();
            subjects.push(makeLower.replace(/[^a-z0-9]/g, ''));
            if (makeLower.includes('apple') || makeLower.includes('iphone')) {
                subjects.push('iphone', 'ios');
            }
            else if (makeLower.includes('samsung') || makeLower.includes('google')) {
                subjects.push('android');
            }
            else if (makeLower.includes('canon') || makeLower.includes('nikon') ||
                makeLower.includes('sony') || makeLower.includes('fuji')) {
                subjects.push('dslr', 'professional');
            }
        }
        return subjects;
    }
    /**
     * Detect device type from make/model
     */
    detectDeviceType(make, model) {
        const combined = `${make} ${model}`.toLowerCase();
        if (combined.includes('phone') || combined.includes('iphone') || combined.includes('galaxy')) {
            return 'phone';
        }
        else if (combined.includes('ipad') || combined.includes('tab')) {
            return 'tablet';
        }
        else if (combined.includes('scan')) {
            return 'scanner';
        }
        else if (make && ['canon', 'nikon', 'sony', 'fujifilm', 'olympus', 'panasonic'].some(b => make.toLowerCase().includes(b))) {
            return 'camera';
        }
        return 'unknown';
    }
    /**
     * Detect scene type from EXIF and filename
     */
    detectSceneType(exif, fileName) {
        const scene = {
            tags: []
        };
        const nameLower = fileName.toLowerCase();
        // From filename patterns
        if (nameLower.includes('portrait') || nameLower.includes('selfie')) {
            scene.type = 'portrait';
            scene.tags?.push('people', 'face');
        }
        else if (nameLower.includes('landscape') || nameLower.includes('panorama')) {
            scene.type = 'landscape';
            scene.tags?.push('nature', 'scenic');
        }
        else if (nameLower.includes('night')) {
            scene.type = 'night';
            scene.tags?.push('lowlight', 'dark');
        }
        else if (nameLower.includes('macro') || nameLower.includes('closeup')) {
            scene.type = 'macro';
            scene.tags?.push('detail', 'close');
        }
        // From EXIF data
        if (exif.flash) {
            scene.tags?.push('flash');
            if (!scene.type)
                scene.indoor = true;
        }
        if (exif.iso && exif.iso > 1600) {
            scene.tags?.push('highiso');
            if (!scene.type)
                scene.type = 'night';
        }
        return scene;
    }
    /**
     * Get file type from extension
     */
    getFileType(file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
        const typeMap = {
            jpg: 'photo', jpeg: 'photo', png: 'image', gif: 'animation',
            mp4: 'video', mov: 'video', avi: 'video',
            mp3: 'audio', wav: 'audio', m4a: 'audio',
            pdf: 'document', doc: 'document', docx: 'document',
            xls: 'spreadsheet', xlsx: 'spreadsheet',
            ppt: 'presentation', pptx: 'presentation',
            zip: 'archive', rar: 'archive', tar: 'archive'
        };
        return typeMap[ext] || ext;
    }
    /**
     * Read file as text (for PDF metadata)
     */
    readFileAsText(file, bytes) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file.slice(0, bytes));
        });
    }
}
// Export singleton
export const metadataExtractor = MetadataExtractor.getInstance();
