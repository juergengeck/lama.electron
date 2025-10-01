# Data Model: TypeScript Type System Restoration

## Core Type Entities

### 1. IPC Type Contracts
**Purpose**: Ensure type safety across main/renderer process boundary

#### Fields:
- `channel`: string - IPC channel name
- `request`: TypeScript interface for request payload
- `response`: TypeScript interface for response payload
- `error`: Error type definition

#### Relationships:
- Maps to IPC handlers in `/main/ipc/handlers/`
- Used by renderer through `window.electronAPI`

### 2. ONE.core Type Definitions
**Purpose**: Align with @refinio/one.core beta-3 types

#### Fields:
- `OneVersionedObjectTypes`: Union type of all versioned objects
- `SHA256IdHash<T>`: Branded type for hash IDs
- `VersionedObjectResult<T>`: Result type from storage operations
- `Recipe`: Object validation recipe type

#### State Transitions:
- undefined → defined (null safety)
- any → specific type (type narrowing)
- unknown → typed (type guards)

### 3. Custom LAMA Objects
**Purpose**: Type definitions for LAMA-specific ONE.core objects

#### Entities:
- `LLM`: Language model configuration
- `Message`: Chat message with analysis
- `Topic`: Conversation container
- `Keyword`: Extracted term
- `Subject`: Theme identifier
- `Summary`: Topic overview

#### Validation Rules:
- All custom objects must extend `OneVersionedObjectTypes`
- Required fields must be non-nullable
- Optional fields use explicit `| undefined`

### 4. Error Type Hierarchy
**Purpose**: Structured error handling without casts

#### Types:
- `TypeScriptError`: Base error with code and file location
- `ImportError`: Module resolution issues
- `TypeMismatchError`: Type assignment problems
- `PropertyAccessError`: Missing property access
- `NullSafetyError`: Undefined handling issues

## Type Safety Contracts

### IPC Contract Pattern
```typescript
interface IPCContract<Req, Res> {
  channel: string;
  request: Req;
  response: Promise<Res>;
}
```

### Type Guard Pattern
```typescript
function isValidType<T>(value: unknown): value is T {
  // Validation logic without casts
  return validateShape(value);
}
```

### Null Safety Pattern
```typescript
function handleOptional<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Value required');
  }
  return value; // Type narrowed to T
}
```

## Migration States

### Phase 1: Foundation
- Fix import paths
- Add missing type declarations
- Remove duplicate implementations

### Phase 2: Type System
- Update interfaces to match beta-3
- Add proper null safety
- Implement type guards

### Phase 3: API Alignment
- Align with ONE.core API
- Update IPC contracts
- Add comprehensive tests

## Validation Rules

1. **No Type Assertions**: Never use `as Type` unless absolutely necessary
2. **Explicit Undefined**: Use `T | undefined` not optional `T?`
3. **Type Guards Required**: All `unknown` must be validated
4. **Branded Types**: Use branded types for IDs and hashes
5. **Strict Null Checks**: Enable strictNullChecks in tsconfig
6. **No Any Types**: Replace all `any` with specific types
7. **IPC Type Safety**: All IPC calls must have typed contracts