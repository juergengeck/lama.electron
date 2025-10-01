/**
 * Type definitions for custom ONE.core objects used in LAMA
 * These re-export the types from @OneObjectInterfaces for convenience
 */
/**
 * Type guard for LLM objects
 */
export function isLLMObject(obj) {
    return obj != null &&
        typeof obj === 'object' &&
        '$type$' in obj &&
        obj.$type$ === 'LLM';
}
/**
 * Type guard for GlobalLLMSettings objects
 */
export function isGlobalLLMSettings(obj) {
    return obj != null &&
        typeof obj === 'object' &&
        '$type$' in obj &&
        obj.$type$ === 'GlobalLLMSettings';
}
