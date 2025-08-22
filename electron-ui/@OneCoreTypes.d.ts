/// <reference path="./node_modules/@refinio/one.core/@OneCoreTypes.d.ts" />
/// <reference path="./node_modules/@refinio/one.models/@OneObjectInterfaces.d.ts" />

/**
 * Ambient module declaration for ONE.CORE types
 * This file enables TypeScript to properly recognize ONE object types
 * and allows declaration merging for custom types
 */

declare module '@OneCoreTypes' {
    // Re-export all core types
    export * from '@refinio/one.core/lib/recipes';
    export * from '@refinio/one.core/lib/util/type-checks';
    export * from '@refinio/one.core/lib/storage-base-common';
    export * from '@refinio/one.core/lib/errors';
    
    // The interface declarations will be merged from one.models
    // No need to redeclare them here
}