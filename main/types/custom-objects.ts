/**
 * Type definitions for custom ONE.core objects used in LAMA
 * These re-export the types from @OneObjectInterfaces for convenience
 */

// Import our custom types from the type declarations
export type { LLM as LLMObject, GlobalLLMSettings } from '@OneObjectInterfaces';
import type { LLM, GlobalLLMSettings as GlobalLLMSettingsType } from '@OneObjectInterfaces';

/**
 * Type guard for LLM objects
 */
export function isLLMObject(obj: unknown): obj is LLM {
    return obj != null &&
           typeof obj === 'object' &&
           '$type$' in obj &&
           obj.$type$ === 'LLM';
}

/**
 * Type guard for GlobalLLMSettings objects
 */
export function isGlobalLLMSettings(obj: unknown): obj is GlobalLLMSettingsType {
    return obj != null &&
           typeof obj === 'object' &&
           '$type$' in obj &&
           obj.$type$ === 'GlobalLLMSettings';
}