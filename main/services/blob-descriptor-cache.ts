/**
 * BlobDescriptor cache for efficient attachment retrieval
 * Caches BlobDescriptor objects to avoid repeated ONE.core lookups
 *
 * Reference: ATTACHMENTS.md - ONE.leute BlobDescriptor caching pattern
 */

import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { BlobDescriptor } from '@refinio/one.models/lib/recipes/BlobRecipes.js';

class BlobDescriptorCache {
    private cache: Map<string, BlobDescriptor> = new Map();
    private pending: Map<string, Promise<BlobDescriptor>> = new Map();

    /**
     * Get BlobDescriptor by hash, with caching
     * Handles internal fetching from ONE.core storage
     */
    async get(hash: string): Promise<BlobDescriptor> {
        const hashStr = String(hash);

        // Check cache first
        if (this.cache.has(hashStr)) {
            return this.cache.get(hashStr)!;
        }

        // Check if already fetching
        if (this.pending.has(hashStr)) {
            return this.pending.get(hashStr)!;
        }

        // Fetch from ONE.core
        const promise = this.fetchBlobDescriptor(hashStr);
        this.pending.set(hashStr, promise);

        try {
            const descriptor = await promise;
            this.cache.set(hashStr, descriptor);
            this.pending.delete(hashStr);
            return descriptor;
        } catch (error) {
            this.pending.delete(hashStr);
            throw error;
        }
    }

    /**
     * Fetch BlobDescriptor from ONE.core storage
     */
    private async fetchBlobDescriptor(hash: string): Promise<BlobDescriptor> {
        // Load Node.js platform first
        await import('@refinio/one.core/lib/system/load-nodejs.js');

        // Import getObject from unversioned storage (BlobDescriptor is unversioned)
        const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');

        // Fetch the object
        const descriptor = await getObject(hash as SHA256Hash<BlobDescriptor>);

        if (descriptor.$type$ !== 'BlobDescriptor') {
            throw new Error(`Object ${hash} is not a BlobDescriptor (got ${descriptor.$type$})`);
        }

        return descriptor as BlobDescriptor;
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this.cache.clear();
        this.pending.clear();
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Check if hash is cached
     */
    has(hash: string): boolean {
        return this.cache.has(String(hash));
    }

    /**
     * Remove specific entry from cache
     */
    delete(hash: string): boolean {
        return this.cache.delete(String(hash));
    }
}

// Export singleton instance
export default new BlobDescriptorCache();
