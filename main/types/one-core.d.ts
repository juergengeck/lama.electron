/**
 * ONE.core Type Definitions for LAMA Electron
 *
 * Proper type definitions for @refinio/one.core beta-3 compatibility
 * without type casts or assertions.
 */

declare module '@refinio/one.core' {
  // Base hash types
  export interface SHA256IdHash<T> extends String {
    readonly _brand: 'SHA256IdHash';
    readonly _type: T;
  }

  export interface SHA256Hash<T> extends String {
    readonly _brand: 'SHA256Hash';
    readonly _type: T;
  }

  // Core ONE.core types that might be missing
  export interface VersionedObjectResult<T> {
    obj: T;
    hash: SHA256IdHash<T>;
    timestamp: number;
  }

  export interface Recipe {
    $type$: 'Recipe';
    name: string;
    rule: Array<{
      itemprop: string;
      itemtype: { type: string; regexp?: RegExp };
      isId?: boolean;
      optional?: boolean;
    }>;
  }

  // Storage operations
  export interface StorageVersionedObjects {
    storeVersionedObject<T>(obj: T, storeAs?: 'change' | 'merge' | 'no-version-map'): Promise<VersionedObjectResult<T>>;
    retrieveVersionedObject<T>(hash: SHA256IdHash<T>): Promise<T | undefined>;
    retrieveIdObject<T>(hash: SHA256IdHash<T>): Promise<T | undefined>;
    getLatestVersion<T>(hash: SHA256IdHash<T>): Promise<SHA256IdHash<T> | undefined>;
  }

  // Keychain operations for beta-3
  export interface Keychain {
    generateKeys(): Promise<{ publicKey: any; privateKey: any }>;
    createKeyPair(): Promise<{ publicKey: any; privateKey: any }>;
    signData(data: any, privateKey: any): Promise<any>;
    verifySignature(data: any, signature: any, publicKey: any): Promise<boolean>;
  }

  // Configuration types
  export interface ConnectionsModelConfiguration {
    connectionRoutes?: Array<{
      type: string;
      url: string;
    }>;
    enableDirectConnections?: boolean;
    timeout?: number;
  }

  // Event system
  export interface OEvent<T extends (...args: any[]) => void> {
    addEventListener(listener: T): void;
    removeEventListener(listener: T): void;
    emit(...args: Parameters<T>): void;
  }

  // Main ONE.core interfaces
  export interface NodeOneCore {
    storage: StorageVersionedObjects;
    keychain: Keychain;
    isInitialized: boolean;
    shutdown(): Promise<void>;
    init(config?: any): Promise<void>;
  }
}

// Module path corrections for beta-3
declare module '@refinio/one.core/lib/keychain/certificates' {
  export function createMessageAssertion(data: any): Promise<any>;
  export function verifyMessageAssertion(assertion: any): Promise<boolean>;
}

declare module '@refinio/one.core/lib/storage-versioned-objects' {
  export function retrieveVersionedObject<T>(hash: any): Promise<T | undefined>;
  export function storeVersionedObject<T>(obj: T): Promise<any>;
}