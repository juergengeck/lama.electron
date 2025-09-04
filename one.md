# ONE.core Architecture Documentation

## Overview

ONE.core is a TypeScript/JavaScript framework for building distributed, versioned data systems using a microdata-based object model. It provides cryptographic object hashing, versioning, access control, and synchronization capabilities.

## Core Concepts

### ONE Objects

ONE objects are structured data entities with:
- A `$type$` property identifying the object type
- Properties defined by recipes
- Automatic conversion between JavaScript objects and HTML microdata format
- SHA-256 hashing for content-addressable storage

Example microdata representation:
```html
<div itemscope itemtype="//refin.io/Person">
  <span itemprop="email">user@example.com</span>
  <span itemprop="name">John Doe</span>
</div>
```

### Object Types

#### Unversioned Objects
- Immutable objects without version tracking
- Examples: `Keys`, `VersionNode*` types
- Direct hash-based storage and retrieval

#### Versioned Objects  
- Objects with ID properties (`isId: true` in recipe)
- Support multiple versions with same identity
- Examples: `Person`, `Instance`, `Group`, `Recipe`
- Version tracking through `VersionNode` structures

### Recipes

Recipes define the structure and validation rules for ONE object types:

```typescript
{
  $type$: 'Recipe',
  name: 'Person',  // Type name
  rule: [
    {
      itemprop: 'email',
      isId: true,  // This is an ID property
      itemtype: { type: 'string' }
    },
    {
      itemprop: 'name',
      optional: true
    }
  ]
}
```

#### Recipe Rules

Each rule defines a property with:
- `itemprop`: Property name
- `itemtype`: Value type specification
- `isId`: Whether it's part of object identity
- `optional`: Whether the property is optional
- `inheritFrom`: Inherit rule from another recipe

#### Value Types

Supported value types include:
- Primitives: `string`, `integer`, `number`, `boolean`
- References: `referenceToObj`, `referenceToId`, `referenceToClob`, `referenceToBlob`
- Collections: `array`, `set`, `bag` (multiset), `map`
- Complex: `object` (nested rules), `stringifiable` (JSON)

## Core Object Types

### Instance
Central configuration object for a ONE.core instance:
- `name`: Instance identifier
- `owner`: Reference to Person ID (instance owner)
- `recipe`: Set of Recipe objects defining known types
- `enabledReverseMapTypes`: Configuration for reverse mapping

### Person
Represents an identity in the system:
- `email`: Unique identifier (ID property)
- `name`: Optional display name

### Access/IdAccess
Access control objects:
- `Access`: Grants access to specific object versions
- `IdAccess`: Grants access to all versions of an object
- References to Person and Group objects define who has access

### Keys
Stores public cryptographic keys:
- `owner`: Instance or Person ID
- `publicKey`: Encryption public key
- `publicSignKey`: Signing public key

### Chum
Manages data synchronization between instances:
- Tracks exchanged objects between two instances
- Records transfer history (AtoBObjects, BtoAObjects, etc.)
- Maintains synchronization state

### Group
Collection of Person references for access control:
- `name`: Group identifier (ID property)
- `person`: Array of Person ID references

### Version Nodes
Track object version history:
- `VersionNodeEdge`: Initial version (no predecessor)
- `VersionNodeChange`: Sequential update from previous version
- `VersionNodeMerge`: Combines multiple version branches

## Storage Architecture

### Hash-Based Storage
- Objects stored by SHA-256 hash
- Content-addressable filesystem
- Separate storage for objects, ID objects, BLOBs, CLOBs

### ID Hashes
- Special hash for versioned objects
- Based only on ID properties
- Virtual `data-id-object="true"` attribute differentiates from regular hashes

### Reverse Mapping
- Optional indexes from referenced objects back to referencing objects
- Configurable per type and property
- Enables efficient graph traversal

## Instance Initialization

```typescript
await initInstance({
  name: 'MyInstance',
  email: 'user@example.com',
  secret: 'password',
  directory: '/path/to/storage',
  initialRecipes: [...],
  encryptStorage: true
});
```

Key initialization steps:
1. Calculate instance ID hash from name + email
2. Initialize storage system
3. Create or load Instance object
4. Load and register recipes
5. Configure reverse mapping
6. Unlock keychain with secret

## Recipe Registration

Recipes must be registered before use:

```typescript
addRecipeToRuntime({
  $type$: 'Recipe',
  name: 'MyType',
  rule: [
    { itemprop: 'id', isId: true },
    { itemprop: 'data', itemtype: { type: 'string' } }
  ]
});
```

## Object Operations

### Creating Objects
```typescript
const obj = {
  $type$: 'Person',
  email: 'user@example.com',
  name: 'John Doe'
};
```

### Calculating Hashes
```typescript
// Regular object hash
const hash = await calculateHashOfObj(obj);

// ID hash for versioned objects  
const idHash = await calculateIdHashOfObj(obj);
```

### Storage Strategies
- `STORE_AS.CHANGE`: Normal sequential update (default)
- `STORE_AS.MERGE`: Combine changes from multiple sources
- `STORE_AS.NO_VERSION_MAP`: Store without version tracking

## Type System

### TypeScript Integration
ONE.core uses declaration merging for extensible typing:

1. Core types in `@OneObjectInterfaces` module
2. Applications extend with their own types
3. Automatic union types for all registered types

Example extension:
```typescript
declare module '@OneObjectInterfaces' {
  export interface OneVersionedObjectInterfaces {
    MyCustomType: MyCustomType;
  }
}
```

## Key Features

### Cryptographic Security
- All objects are SHA-256 hashed
- Content integrity verification
- Public key infrastructure for encryption/signing

### Versioning
- Automatic version tracking for ID objects
- Version trees with merge capabilities
- Immutable version history

### Distribution
- Chum-based synchronization between instances
- Access control propagation
- Conflict-free replicated data types (CRDT) support

### Platform Support
- Node.js (filesystem storage)
- Browser (IndexedDB storage)
- React Native (mobile storage)

## Best Practices

1. **Recipe Design**
   - Mark identifying properties with `isId: true`
   - Use appropriate value types for validation
   - Consider inheritance for common patterns

2. **Storage**
   - Enable encryption for sensitive data
   - Configure appropriate reverse mapping
   - Use hierarchical storage for large deployments

3. **Versioning**
   - Use CHANGE for normal updates
   - Use MERGE for distributed changes
   - Maintain version history for audit trails

4. **Type Safety**
   - Define TypeScript interfaces for all object types
   - Use type guards and validators
   - Leverage declaration merging for extensibility

## Common Patterns

### Creating a Versioned Object Type
1. Define the TypeScript interface
2. Create and register the Recipe
3. Configure reverse mapping if needed
4. Implement creation and storage logic

### Access Control
1. Create Access/IdAccess objects
2. Reference Person/Group IDs
3. Store with appropriate object references
4. Propagate through Chum synchronization

### Instance Communication
1. Establish Chum relationship
2. Exchange Person credentials
3. Synchronize objects based on access rights
4. Track transfer history

## Error Handling

ONE.core uses coded errors with specific prefixes:
- `IN-*`: Instance errors
- `OR-*`: Object/Recipe errors  
- `UO-*`: Utility/Object errors

Always handle storage and network operations with appropriate error catching.