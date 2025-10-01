/**
 * Implode Wrapper Service
 * Integrates ONE.core's implode() function for HTML export
 */
import { implode } from '@refinio/one.core/lib/microdata-imploder.js';
/**
 * Wraps a message hash with imploded microdata
 * @param {string} messageHash - SHA-256 hash of the message
 * @returns {Promise<string>} - Imploded HTML microdata
 */
export async function wrapMessageWithMicrodata(messageHash) {
    try {
        console.log('[ImplodeWrapper] Processing message hash:', messageHash);
        // Use ONE.core's implode function to recursively embed referenced objects
        const implodedMicrodata = await implode(messageHash);
        // Add the hash as a data attribute to the root element
        const microdataWithHash = addHashAttribute(implodedMicrodata, messageHash);
        console.log('[ImplodeWrapper] Successfully imploded message');
        return microdataWithHash;
    }
    catch (error) {
        console.error('[ImplodeWrapper] Error imploding message:', error);
        throw new Error(`Failed to implode message ${messageHash}: ${error.message}`);
    }
}
/**
 * Process multiple messages in batches for performance
 * @param {string[]} messageHashes - Array of message hashes
 * @param {Object} options - Processing options
 * @returns {Promise<string[]>} - Array of imploded microdata strings
 */
export async function processMessages(messageHashes, options = {}) {
    const { batchSize = 50 } = options;
    if (!messageHashes || messageHashes.length === 0) {
        return [];
    }
    console.log(`[ImplodeWrapper] Processing ${messageHashes.length} messages in batches of ${batchSize}`);
    const results = [];
    // Process in batches to avoid memory issues
    for (let i = 0; i < messageHashes.length; i += batchSize) {
        const batch = messageHashes.slice(i, i + batchSize);
        console.log(`[ImplodeWrapper] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messageHashes.length / batchSize)}`);
        // Process batch in parallel
        const batchPromises = batch.map((hash) => wrapMessageWithMicrodata(hash));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }
    console.log(`[ImplodeWrapper] Successfully processed ${results.length} messages`);
    return results;
}
/**
 * Add signature to imploded microdata
 * @param {string} microdata - Imploded HTML microdata
 * @param {string} signature - Digital signature (optional)
 * @returns {string} - Microdata with signature attribute
 */
export function addSignature(microdata, signature) {
    if (!signature) {
        return microdata;
    }
    // Find the root element and add data-signature attribute
    const rootElementMatch = String(microdata).match(/^(<[^>]+)(>)/);
    if (rootElementMatch) {
        const [, openTag, closeChar] = rootElementMatch;
        const updatedOpenTag = `${openTag} data-signature="${signature}"${closeChar}`;
        return microdata.replace(rootElementMatch[0], updatedOpenTag);
    }
    return microdata;
}
/**
 * Add hash attribute to the root element of microdata
 * @param {string} microdata - HTML microdata string
 * @param {string} hash - Message hash
 * @returns {string} - Microdata with hash attribute
 */
function addHashAttribute(microdata, hash) {
    // Find the root element (first tag) and add data-hash attribute
    const rootElementMatch = String(microdata).match(/^(<[^>]+)(>)/);
    if (rootElementMatch) {
        const [, openTag, closeChar] = rootElementMatch;
        // Check if data-hash already exists (from implode)
        if (openTag.includes('data-hash=')) {
            return microdata; // Already has hash attribute
        }
        // Add data-hash attribute
        const updatedOpenTag = `${openTag} data-hash="${hash}"${closeChar}`;
        return microdata.replace(rootElementMatch[0], updatedOpenTag);
    }
    // If no root element found, wrap in a span with hash
    return `<span data-hash="${hash}">${microdata}</span>`;
}
/**
 * Add timestamp information to microdata
 * @param {string} microdata - HTML microdata
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - Microdata with timestamp
 */
export function addTimestamp(microdata, timestamp) {
    if (!timestamp) {
        return microdata;
    }
    // Add data-timestamp attribute to root element
    const rootElementMatch = String(microdata).match(/^(<[^>]+)(>)/);
    if (rootElementMatch) {
        const [, openTag, closeChar] = rootElementMatch;
        const updatedOpenTag = `${openTag} data-timestamp="${timestamp}"${closeChar}`;
        return microdata.replace(rootElementMatch[0], updatedOpenTag);
    }
    return microdata;
}
export default {
    wrapMessageWithMicrodata,
    processMessages,
    addSignature,
    addTimestamp
};
