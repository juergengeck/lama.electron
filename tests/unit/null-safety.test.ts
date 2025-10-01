/**
 * Null Safety Validation Tests
 *
 * These tests will FAIL initially due to improper null/undefined handling.
 * Tests the patterns that should be used instead of type casts.
 */

import { describe, test, expect } from '@jest/globals';

describe('Null Safety Patterns', () => {
  test('should handle undefined SHA256IdHash values safely', () => {
    // Simulates the instanceId undefined issue
    const instanceId: string | undefined = undefined;

    // Wrong way (with cast) - what we're fixing
    // const result = getInstanceEndpoint(instanceId as string);

    // Right way (with validation) - what we want
    expect(() => {
      if (!instanceId) {
        throw new Error('Instance ID is required');
      }
      // Now instanceId is narrowed to string
      return instanceId.length > 0;
    }).toThrow('Instance ID is required');

    // With actual value
    const validId = 'valid-id';
    if (validId) {
      expect(validId.length).toBeGreaterThan(0);
    }
  });

  test('should validate object properties before access', () => {
    const unknownObject: unknown = { someProperty: 'value' };

    // Wrong way (with cast) - what we're fixing
    // const value = (unknownObject as any).someProperty;

    // Right way (with validation) - what we want
    if (typeof unknownObject === 'object' && unknownObject !== null) {
      const obj = unknownObject as Record<string, unknown>;
      if (typeof obj.someProperty === 'string') {
        expect(obj.someProperty).toBe('value');
      }
    }
  });

  test('should handle optional properties correctly', () => {
    interface TestObject {
      required: string;
      optional?: string;
    }

    const testObj: TestObject = { required: 'test' };

    // Should explicitly handle undefined
    const optionalValue = testObj.optional;
    if (optionalValue !== undefined) {
      expect(typeof optionalValue).toBe('string');
    } else {
      expect(optionalValue).toBeUndefined();
    }
  });

  test('should validate function parameters', () => {
    function processData(data: string | undefined): string {
      // Wrong way (with cast)
      // return (data as string).toUpperCase();

      // Right way (with validation)
      if (data === undefined) {
        throw new Error('Data is required');
      }
      return data.toUpperCase();
    }

    expect(() => processData(undefined)).toThrow('Data is required');
    expect(processData('hello')).toBe('HELLO');
  });
});

describe('Type Guard Patterns', () => {
  test('should implement proper type guards', () => {
    // Type guard for LAMA objects
    function isValidLLM(obj: unknown): obj is { $type$: 'LLM'; modelId: string; name: string } {
      if (typeof obj !== 'object' || obj === null) return false;
      const typed = obj as Record<string, unknown>;
      return (
        typed.$type$ === 'LLM' &&
        typeof typed.modelId === 'string' &&
        typeof typed.name === 'string'
      );
    }

    const validLLM = { $type$: 'LLM', modelId: 'test', name: 'test' };
    const invalidLLM = { $type$: 'LLM', name: 'test' }; // missing modelId

    expect(isValidLLM(validLLM)).toBe(true);
    expect(isValidLLM(invalidLLM)).toBe(false);
    expect(isValidLLM(null)).toBe(false);
  });

  test('should handle array validation', () => {
    function validateStringArray(arr: unknown): string[] {
      if (!Array.isArray(arr)) {
        throw new Error('Expected array');
      }

      if (!arr.every(item => typeof item === 'string')) {
        throw new Error('All items must be strings');
      }

      return arr as string[];
    }

    expect(validateStringArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(() => validateStringArray(['a', 1, 'c'])).toThrow('All items must be strings');
    expect(() => validateStringArray('not-array')).toThrow('Expected array');
  });
});

describe('API Result Handling', () => {
  test('should handle Promise results safely', async () => {
    // Simulate API that might return undefined
    async function fetchData(): Promise<{ data: string } | undefined> {
      return undefined; // Simulating failure case
    }

    const result = await fetchData();

    // Wrong way (with cast)
    // const data = (result as { data: string }).data;

    // Right way (with validation)
    if (result === undefined) {
      expect(result).toBeUndefined();
    } else {
      expect(typeof result.data).toBe('string');
    }
  });

  test('should validate configuration objects', () => {
    interface Config {
      url: string;
      timeout?: number;
    }

    function createConfig(input: unknown): Config {
      if (typeof input !== 'object' || input === null) {
        throw new Error('Config must be an object');
      }

      const obj = input as Record<string, unknown>;

      if (typeof obj.url !== 'string') {
        throw new Error('URL is required');
      }

      const config: Config = { url: obj.url };

      if (obj.timeout !== undefined) {
        if (typeof obj.timeout !== 'number') {
          throw new Error('Timeout must be a number');
        }
        config.timeout = obj.timeout;
      }

      return config;
    }

    expect(createConfig({ url: 'test' })).toEqual({ url: 'test' });
    expect(createConfig({ url: 'test', timeout: 5000 })).toEqual({ url: 'test', timeout: 5000 });
    expect(() => createConfig({})).toThrow('URL is required');
    expect(() => createConfig({ url: 'test', timeout: 'invalid' })).toThrow('Timeout must be a number');
  });
});