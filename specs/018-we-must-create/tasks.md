# Implementation Tasks: XML-Based LLM Communication

**Feature**: 018-we-must-create | **Date**: 2025-10-06 | **Status**: Ready for Implementation

---

## Task Execution Order

Tasks must be executed in the order listed. Tasks marked `[P]` can be executed in parallel with other `[P]` tasks in the same section.

**TDD Order**: Contract Tests → Integration Tests → Implementation → Unit Tests

---

## T001: Install Dependencies [Setup]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/package.json`

### Description
Install fast-xml-parser v4.x for XML parsing.

### Acceptance Criteria
- [ ] `fast-xml-parser` added to package.json dependencies
- [ ] Version: ^4.0.0 or latest 4.x
- [ ] `npm install` completes without errors
- [ ] TypeScript types available (@types not needed - built-in)

### Implementation
```bash
npm install --save fast-xml-parser
```

### Verification
```bash
npm list fast-xml-parser
# Should show version 4.x.x
```

---

## T002: Define XML Schema Contract Tests [Contract Test]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/tests/contract/xml-schema.test.ts`

### Description
Create contract tests for XML query and response formats. These tests MUST FAIL initially (RED phase of TDD).

### Acceptance Criteria
- [ ] Tests for valid query XML parsing
- [ ] Tests for valid response XML parsing
- [ ] Tests for malformed XML rejection
- [ ] Tests for missing required elements
- [ ] Tests for invalid confidence values (must be 0.0-1.0)
- [ ] Tests for UTF-8 encoding preservation
- [ ] Tests for XML escaping (< > & " ')
- [ ] All tests FAIL initially (no implementation yet)

### Implementation
Create `/tests/contract/xml-schema.test.ts`:

```typescript
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

describe('XML Schema Contract - Query Format', () => {
  let parser: XMLParser;

  beforeEach(() => {
    parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true
    });
  });

  test('should parse valid query XML', () => {
    const xml = `
      <llmQuery>
        <userMessage>How much for college?</userMessage>
        <context topicId="test-topic" messageCount="5">
          <activeSubjects>education</activeSubjects>
          <recentKeywords>college, tuition</recentKeywords>
        </context>
      </llmQuery>
    `;

    const parsed = parser.parse(xml);
    expect(parsed.llmQuery).toBeDefined();
    expect(parsed.llmQuery.userMessage).toBe('How much for college?');
    expect(parsed.llmQuery.context.topicId).toBe('test-topic');
    expect(parsed.llmQuery.context.messageCount).toBe(5);
  });

  test('should reject query without userMessage', () => {
    const xml = `
      <llmQuery>
        <context topicId="test" messageCount="0" />
      </llmQuery>
    `;

    expect(() => {
      const parsed = parser.parse(xml);
      validateQueryStructure(parsed); // To be implemented
    }).toThrow('Missing required element: userMessage');
  });

  test('should handle XML special characters', () => {
    const xml = `
      <llmQuery>
        <userMessage>Test &lt;angle&gt; &amp; &quot;quotes&quot;</userMessage>
        <context topicId="test" messageCount="1" />
      </llmQuery>
    `;

    const parsed = parser.parse(xml);
    expect(parsed.llmQuery.userMessage).toBe('Test <angle> & "quotes"');
  });
});

describe('XML Schema Contract - Response Format', () => {
  let parser: XMLParser;

  beforeEach(() => {
    parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true
    });
  });

  test('should parse valid response XML', () => {
    const xml = `
      <llmResponse>
        <response>529 plans are great for college savings.</response>
        <analysis>
          <subject name="college-savings" description="Saving for education" isNew="true">
            <keyword term="529-plan" confidence="0.95" />
            <keyword term="education" confidence="0.85" />
          </subject>
          <summaryUpdate>User asked about college savings.</summaryUpdate>
        </analysis>
      </llmResponse>
    `;

    const parsed = parser.parse(xml);
    expect(parsed.llmResponse.response).toBeDefined();
    expect(parsed.llmResponse.analysis.subject.name).toBe('college-savings');
    expect(parsed.llmResponse.analysis.subject.isNew).toBe('true');
  });

  test('should reject response without required elements', () => {
    const xml = `<llmResponse><response>Text only</response></llmResponse>`;

    expect(() => {
      const parsed = parser.parse(xml);
      validateResponseStructure(parsed); // To be implemented
    }).toThrow('Missing required element: analysis');
  });

  test('should reject invalid confidence values', () => {
    const xml = `
      <llmResponse>
        <response>Test</response>
        <analysis>
          <subject name="test" description="test" isNew="true">
            <keyword term="test" confidence="1.5" />
          </subject>
          <summaryUpdate>Test</summaryUpdate>
        </analysis>
      </llmResponse>
    `;

    expect(() => {
      const parsed = parser.parse(xml);
      validateResponseStructure(parsed); // To be implemented
    }).toThrow('Confidence must be between 0.0 and 1.0');
  });

  test('should handle multiple subjects', () => {
    const xml = `
      <llmResponse>
        <response>Multiple topics discussed.</response>
        <analysis>
          <subject name="topic-1" description="First" isNew="true">
            <keyword term="keyword1" confidence="0.9" />
          </subject>
          <subject name="topic-2" description="Second" isNew="false">
            <keyword term="keyword2" confidence="0.8" />
          </subject>
          <summaryUpdate>Discussion covered two topics.</summaryUpdate>
        </analysis>
      </llmResponse>
    `;

    const parsed = parser.parse(xml);
    const subjects = Array.isArray(parsed.llmResponse.analysis.subject)
      ? parsed.llmResponse.analysis.subject
      : [parsed.llmResponse.analysis.subject];
    expect(subjects).toHaveLength(2);
  });
});

// Validation functions to be implemented in T005
function validateQueryStructure(parsed: any): void {
  throw new Error('Not implemented yet');
}

function validateResponseStructure(parsed: any): void {
  throw new Error('Not implemented yet');
}
```

### Dependencies
- T001 (fast-xml-parser installed)

### Verification
```bash
npm test -- tests/contract/xml-schema.test.ts
# All tests should FAIL (RED phase)
```

---

## T003: Create ONE.core Recipe for XMLMessageAttachment [Recipe]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/core/one-ai/recipes/xml-message-attachment.ts`

### Description
Define ONE.core recipe for XMLMessageAttachment versioned object.

### Acceptance Criteria
- [ ] Recipe follows ONE.core recipe pattern
- [ ] Fields: topicId, messageId, xmlContent, xmlBlob, format, version, size, createdAt
- [ ] Type: 'XMLMessageAttachment'
- [ ] Exports recipe object for registration

### Implementation
Create `/main/core/one-ai/recipes/xml-message-attachment.ts`:

```typescript
import type { Recipe } from '@refinio/one.core/lib/recipes.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * XMLMessageAttachment Recipe
 * Stores XML-formatted LLM messages as BLOB or inline
 */
export const XMLMessageAttachmentRecipe: Recipe = {
  $type$: 'Recipe',
  name: 'XMLMessageAttachment',
  rule: {
    $type$: 'XMLMessageAttachment',
    topicId: 'string',            // FK to Topic
    messageId: 'string',           // FK to Message
    xmlContent: '?string',         // Inline XML if ≤1KB
    xmlBlob: '?SHA256IdHash<BLOB>', // BLOB hash if >1KB
    format: 'string',              // 'llm-query' | 'llm-response'
    version: 'number',             // Schema version (1)
    createdAt: 'number',           // Unix timestamp
    size: 'number'                 // Byte size
  }
};

export default XMLMessageAttachmentRecipe;
```

### Dependencies
None

### Verification
```typescript
// Verify recipe structure
import { XMLMessageAttachmentRecipe } from './xml-message-attachment.js';
console.log(XMLMessageAttachmentRecipe.name); // 'XMLMessageAttachment'
```

---

## T004: Create ONE.core Recipe for SystemPromptTemplate [Recipe]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/core/one-ai/recipes/system-prompt-template.ts`

### Description
Define ONE.core recipe for SystemPromptTemplate versioned object.

### Acceptance Criteria
- [ ] Recipe follows ONE.core recipe pattern
- [ ] Fields: modelId, promptText, xmlSchemaVersion, version, createdAt, updatedAt, active
- [ ] Type: 'SystemPromptTemplate'
- [ ] Exports recipe object for registration

### Implementation
Create `/main/core/one-ai/recipes/system-prompt-template.ts`:

```typescript
import type { Recipe } from '@refinio/one.core/lib/recipes.js';

/**
 * SystemPromptTemplate Recipe
 * Stores LLM system prompts with XML format instructions
 */
export const SystemPromptTemplateRecipe: Recipe = {
  $type$: 'Recipe',
  name: 'SystemPromptTemplate',
  rule: {
    $type$: 'SystemPromptTemplate',
    modelId: 'string',           // LLM model identifier
    promptText: 'string',        // Complete system prompt
    xmlSchemaVersion: 'number',  // XML schema version
    version: 'number',           // Template version
    createdAt: 'number',         // Creation timestamp
    updatedAt: 'number',         // Update timestamp
    active: 'boolean'            // Is this the active template?
  }
};

export default SystemPromptTemplateRecipe;
```

### Dependencies
None

### Verification
```typescript
import { SystemPromptTemplateRecipe } from './system-prompt-template.js';
console.log(SystemPromptTemplateRecipe.name); // 'SystemPromptTemplate'
```

---

## T005: Implement XML Validation Functions [Core Logic]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/services/xml-validator.ts`

### Description
Implement validation functions for XML query and response structures. This makes T002 tests pass (GREEN phase).

### Acceptance Criteria
- [ ] `validateQueryStructure(parsed)` validates query XML
- [ ] `validateResponseStructure(parsed)` validates response XML
- [ ] Throws descriptive errors for invalid structures
- [ ] Validates confidence range 0.0-1.0
- [ ] Validates required elements
- [ ] All T002 tests pass

### Implementation
Create `/main/services/xml-validator.ts`:

```typescript
/**
 * XML Schema Validation
 * Validates parsed XML against schema contracts
 */

export function validateQueryStructure(parsed: any): void {
  if (!parsed.llmQuery) {
    throw new Error('Missing root element: llmQuery');
  }

  const query = parsed.llmQuery;

  if (!query.userMessage || typeof query.userMessage !== 'string' || query.userMessage.trim() === '') {
    throw new Error('Missing required element: userMessage');
  }

  if (!query.context) {
    throw new Error('Missing required element: context');
  }

  if (!query.context.topicId || typeof query.context.topicId !== 'string') {
    throw new Error('Missing required attribute: context.topicId');
  }

  if (typeof query.context.messageCount !== 'number') {
    throw new Error('Missing required attribute: context.messageCount');
  }
}

export function validateResponseStructure(parsed: any): void {
  if (!parsed.llmResponse) {
    throw new Error('Missing root element: llmResponse');
  }

  const response = parsed.llmResponse;

  if (!response.response || typeof response.response !== 'string' || response.response.trim() === '') {
    throw new Error('Missing required element: response');
  }

  if (!response.analysis) {
    throw new Error('Missing required element: analysis');
  }

  // Validate subjects
  if (response.analysis.subject) {
    const subjects = Array.isArray(response.analysis.subject)
      ? response.analysis.subject
      : [response.analysis.subject];

    for (const subject of subjects) {
      if (!subject.name || typeof subject.name !== 'string') {
        throw new Error('Missing required attribute: subject.name');
      }

      if (!subject.description || typeof subject.description !== 'string') {
        throw new Error('Missing required attribute: subject.description');
      }

      if (subject.isNew !== 'true' && subject.isNew !== 'false') {
        throw new Error('Invalid attribute value: subject.isNew must be "true" or "false"');
      }

      // Validate keywords
      if (subject.keyword) {
        const keywords = Array.isArray(subject.keyword)
          ? subject.keyword
          : [subject.keyword];

        for (const kw of keywords) {
          if (!kw.term || typeof kw.term !== 'string') {
            throw new Error('Missing required attribute: keyword.term');
          }

          const confidence = parseFloat(kw.confidence);
          if (isNaN(confidence) || confidence < 0.0 || confidence > 1.0) {
            throw new Error('Confidence must be between 0.0 and 1.0');
          }
        }
      }
    }
  }

  if (!response.analysis.summaryUpdate) {
    throw new Error('Missing required element: summaryUpdate');
  }
}
```

### Dependencies
- T002 (contract tests exist)

### Verification
```bash
npm test -- tests/contract/xml-schema.test.ts
# All tests should PASS (GREEN phase)
```

---

## T006: Implement XML Formatting Service [Core Logic]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/services/xml-formatter.ts`

### Description
Implement functions to format LLM queries as XML.

### Acceptance Criteria
- [ ] `formatQueryAsXML(message, context)` generates valid query XML
- [ ] Uses XMLBuilder from fast-xml-parser
- [ ] Properly escapes special characters
- [ ] Includes context (topicId, messageCount, subjects, keywords)
- [ ] Output passes T002 contract tests

### Implementation
Create `/main/services/xml-formatter.ts`:

```typescript
import { XMLBuilder } from 'fast-xml-parser';

export interface QueryContext {
  topicId: string;
  messageCount: number;
  activeSubjects?: string[];
  recentKeywords?: string[];
}

export function formatQueryAsXML(message: string, context: QueryContext): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  '
  });

  const xmlObj = {
    llmQuery: {
      userMessage: message,
      context: {
        '@_topicId': context.topicId,
        '@_messageCount': context.messageCount,
        activeSubjects: context.activeSubjects?.join(', ') || '',
        recentKeywords: context.recentKeywords?.join(', ') || ''
      }
    }
  };

  return builder.build(xmlObj);
}
```

### Dependencies
- T001 (fast-xml-parser installed)
- T005 (validation functions)

### Verification
```typescript
import { formatQueryAsXML } from './xml-formatter.js';
import { XMLParser } from 'fast-xml-parser';
import { validateQueryStructure } from './xml-validator.js';

const xml = formatQueryAsXML('Test message', {
  topicId: 'test-topic',
  messageCount: 5,
  activeSubjects: ['subject1'],
  recentKeywords: ['keyword1']
});

const parser = new XMLParser({ ignoreAttributes: false });
const parsed = parser.parse(xml);
validateQueryStructure(parsed); // Should not throw
```

---

## T007: Implement XML Parsing Service [Core Logic]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/services/xml-parser.ts`

### Description
Implement functions to parse LLM XML responses.

### Acceptance Criteria
- [ ] `parseXMLResponse(xmlString)` parses response XML
- [ ] Returns structured object with text and analysis
- [ ] Handles single or multiple subjects
- [ ] Handles single or multiple keywords per subject
- [ ] Throws error on malformed XML (fail fast)
- [ ] Output validated by T002 tests

### Implementation
Create `/main/services/xml-parser.ts`:

```typescript
import { XMLParser } from 'fast-xml-parser';
import { validateResponseStructure } from './xml-validator.js';

export interface ParsedKeyword {
  term: string;
  confidence: number;
}

export interface ParsedSubject {
  name: string;
  description: string;
  isNew: boolean;
  keywords: ParsedKeyword[];
}

export interface ParsedResponse {
  text: string;
  analysis: {
    subjects: ParsedSubject[];
    summaryUpdate: string;
  };
}

export function parseXMLResponse(xmlString: string): ParsedResponse {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
    trimValues: true,
    removeNSPrefix: true
  });

  let parsed;
  try {
    parsed = parser.parse(xmlString);
  } catch (error) {
    throw new Error(`Invalid XML: ${error.message}`);
  }

  // Validate structure
  validateResponseStructure(parsed);

  const response = parsed.llmResponse;

  // Normalize subjects to array
  const subjects = response.analysis.subject
    ? (Array.isArray(response.analysis.subject)
        ? response.analysis.subject
        : [response.analysis.subject])
    : [];

  // Parse subjects and keywords
  const parsedSubjects: ParsedSubject[] = subjects.map((subject: any) => {
    const keywords = subject.keyword
      ? (Array.isArray(subject.keyword)
          ? subject.keyword
          : [subject.keyword])
      : [];

    return {
      name: subject.name,
      description: subject.description,
      isNew: subject.isNew === 'true',
      keywords: keywords.map((kw: any) => ({
        term: kw.term,
        confidence: parseFloat(kw.confidence)
      }))
    };
  });

  return {
    text: response.response,
    analysis: {
      subjects: parsedSubjects,
      summaryUpdate: response.analysis.summaryUpdate || ''
    }
  };
}
```

### Dependencies
- T001 (fast-xml-parser installed)
- T005 (validation functions)

### Verification
```typescript
import { parseXMLResponse } from './xml-parser.js';

const xml = `
  <llmResponse>
    <response>Test response</response>
    <analysis>
      <subject name="test" description="Test subject" isNew="true">
        <keyword term="test" confidence="0.9" />
      </subject>
      <summaryUpdate>Test summary</summaryUpdate>
    </analysis>
  </llmResponse>
`;

const parsed = parseXMLResponse(xml);
console.log(parsed.text); // 'Test response'
console.log(parsed.analysis.subjects[0].name); // 'test'
```

---

## T008: Implement XML Attachment Storage [Storage]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/services/attachment-service.ts` (modify)

### Description
Add methods to attachment service for storing and retrieving XML attachments.

### Acceptance Criteria
- [ ] `storeXMLAttachment()` stores XML as BLOB (>1KB) or inline (≤1KB)
- [ ] `retrieveXMLAttachment()` retrieves XML content
- [ ] Uses ONE.core `createBlob()` and `retrieveBlob()`
- [ ] Creates XMLMessageAttachment versioned object
- [ ] Returns attachment hash

### Implementation
Modify `/main/services/attachment-service.ts`:

```typescript
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { createBlob, retrieveBlob } from '@refinio/one.core/lib/storage-blob.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

export async function storeXMLAttachment(
  topicId: string,
  messageId: string,
  xmlString: string,
  format: 'llm-query' | 'llm-response'
): Promise<SHA256IdHash> {
  const size = Buffer.byteLength(xmlString, 'utf8');

  if (size <= 1024) {
    // Inline storage for small XML
    const attachment = {
      $type$: 'XMLMessageAttachment',
      topicId,
      messageId,
      xmlContent: xmlString,
      format,
      version: 1,
      createdAt: Date.now(),
      size
    };

    return await storeVersionedObject(attachment);
  } else {
    // BLOB storage for large XML
    const blobHash = await createBlob(Buffer.from(xmlString, 'utf8'));
    const attachment = {
      $type$: 'XMLMessageAttachment',
      topicId,
      messageId,
      xmlBlob: blobHash,
      format,
      version: 1,
      createdAt: Date.now(),
      size
    };

    return await storeVersionedObject(attachment);
  }
}

export async function retrieveXMLAttachment(attachmentHash: SHA256IdHash): Promise<string> {
  const attachment = await retrieveVersionedObject(attachmentHash);

  if (attachment.xmlContent) {
    // Inline storage
    return attachment.xmlContent;
  } else if (attachment.xmlBlob) {
    // BLOB storage
    const blobData = await retrieveBlob(attachment.xmlBlob);
    return blobData.toString('utf8');
  } else {
    throw new Error('XMLMessageAttachment has no content (neither xmlContent nor xmlBlob)');
  }
}
```

### Dependencies
- T003 (XMLMessageAttachment recipe)

### Verification
```typescript
const hash = await storeXMLAttachment('topic1', 'msg1', '<test>XML</test>', 'llm-response');
const retrieved = await retrieveXMLAttachment(hash);
console.log(retrieved); // '<test>XML</test>'
```

---

## T009: Create Integration Test for XML Attachment Storage [Integration Test]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/tests/integration/xml-attachment.test.ts`

### Description
Integration test for XML attachment storage with real ONE.core instance.

### Acceptance Criteria
- [ ] Test stores small XML (inline)
- [ ] Test stores large XML (BLOB)
- [ ] Test retrieves both types correctly
- [ ] Uses real ONE.core instance (no mocks)
- [ ] Tests MUST FAIL before T008 implementation (TDD)

### Implementation
Create `/tests/integration/xml-attachment.test.ts`:

```typescript
import { storeXMLAttachment, retrieveXMLAttachment } from '../../main/services/attachment-service.js';
import { initOneCore, shutdownOneCore } from '../helpers/one-core-helper.js';

describe('XML Attachment Storage Integration', () => {
  beforeAll(async () => {
    await initOneCore();
  });

  afterAll(async () => {
    await shutdownOneCore();
  });

  test('should store and retrieve small XML inline', async () => {
    const smallXml = '<test>Small XML content</test>';

    const hash = await storeXMLAttachment('topic1', 'msg1', smallXml, 'llm-response');
    expect(hash).toBeDefined();

    const retrieved = await retrieveXMLAttachment(hash);
    expect(retrieved).toBe(smallXml);
  });

  test('should store and retrieve large XML as BLOB', async () => {
    // Generate >1KB XML
    const largeXml = `<llmResponse>${'x'.repeat(2000)}</llmResponse>`;

    const hash = await storeXMLAttachment('topic1', 'msg2', largeXml, 'llm-response');
    expect(hash).toBeDefined();

    const retrieved = await retrieveXMLAttachment(hash);
    expect(retrieved).toBe(largeXml);
  });

  test('should preserve UTF-8 encoding', async () => {
    const utf8Xml = '<test>Unicode: 你好世界 🌍</test>';

    const hash = await storeXMLAttachment('topic1', 'msg3', utf8Xml, 'llm-query');
    const retrieved = await retrieveXMLAttachment(hash);

    expect(retrieved).toBe(utf8Xml);
  });
});
```

### Dependencies
- T003 (XMLMessageAttachment recipe)
- T008 (storage implementation)

### Verification
```bash
npm test -- tests/integration/xml-attachment.test.ts
# Should FAIL before T008, PASS after T008
```

---

## T010: Modify LLM Manager - Add XML Methods [Core Logic]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/services/llm-manager.ts` (modify)

### Description
Add XML formatting and parsing methods to existing LLM Manager.

### Acceptance Criteria
- [ ] Import xml-formatter and xml-parser services
- [ ] Add `formatQueryAsXML(message, context)` method
- [ ] Add `parseXMLResponse(xmlString)` method
- [ ] Methods use existing services (T006, T007)
- [ ] No changes to existing methods

### Implementation
Modify `/main/services/llm-manager.ts`:

```typescript
// Add imports at top
import { formatQueryAsXML, QueryContext } from './xml-formatter.js';
import { parseXMLResponse, ParsedResponse } from './xml-parser.js';

// Add to LLMManager class
export class LLMManager {
  // ... existing methods ...

  /**
   * Format user message as XML query
   */
  formatQueryAsXML(message: string, context: QueryContext): string {
    return formatQueryAsXML(message, context);
  }

  /**
   * Parse LLM XML response
   */
  parseXMLResponse(xmlString: string): ParsedResponse {
    return parseXMLResponse(xmlString);
  }
}
```

### Dependencies
- T006 (xml-formatter)
- T007 (xml-parser)

### Verification
```typescript
const llmManager = new LLMManager();
const xml = llmManager.formatQueryAsXML('Test', {
  topicId: 'topic1',
  messageCount: 1
});
console.log(xml); // Should be valid XML
```

---

## T011: Create SystemPromptTemplate Management [Core Logic]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/services/system-prompt-manager.ts` (new)

### Description
Create service to manage SystemPromptTemplate objects.

### Acceptance Criteria
- [ ] `createSystemPrompt(modelId, promptText)` creates template
- [ ] `getActiveSystemPrompt(modelId)` retrieves active template
- [ ] `updateSystemPrompt(modelId, promptText)` creates new version
- [ ] Deactivates old versions when updating
- [ ] Uses ONE.core storage

### Implementation
Create `/main/services/system-prompt-manager.ts`:

```typescript
import { storeVersionedObject, queryVersionedObjects } from '@refinio/one.core/lib/storage-versioned-objects.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

const DEFAULT_XML_SYSTEM_PROMPT = `You are an AI assistant. Always respond using this XML format:

<llmResponse>
  <response>[Your natural language response]</response>
  <analysis>
    <subject name="topic-name" description="brief explanation" isNew="true|false">
      <keyword term="keyword-term" confidence="0.8" />
    </subject>
    <summaryUpdate>[Brief summary of this exchange]</summaryUpdate>
  </analysis>
</llmResponse>

Rules:
- Extract 1-3 subjects (main themes)
- Mark isNew="true" for new subjects, isNew="false" for existing
- Include 3-7 keywords per subject with confidence 0.6-1.0
- Provide incremental summary (2-3 sentences)
- Use lowercase, hyphenated names (e.g., "college-savings")`;

export async function createSystemPrompt(
  modelId: string,
  promptText: string = DEFAULT_XML_SYSTEM_PROMPT
): Promise<SHA256IdHash> {
  const template = {
    $type$: 'SystemPromptTemplate',
    modelId,
    promptText,
    xmlSchemaVersion: 1,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true
  };

  return await storeVersionedObject(template);
}

export async function getActiveSystemPrompt(modelId: string): Promise<string> {
  const templates = await queryVersionedObjects({
    $type$: 'SystemPromptTemplate',
    modelId,
    active: true
  });

  if (templates.length > 0) {
    return templates[0].promptText;
  }

  // Return default if no active template
  return DEFAULT_XML_SYSTEM_PROMPT;
}

export async function updateSystemPrompt(
  modelId: string,
  promptText: string
): Promise<SHA256IdHash> {
  // Deactivate old templates
  const oldTemplates = await queryVersionedObjects({
    $type$: 'SystemPromptTemplate',
    modelId,
    active: true
  });

  for (const old of oldTemplates) {
    old.active = false;
    await storeVersionedObject(old);
  }

  // Create new version
  const newVersion = oldTemplates.length > 0 ? oldTemplates[0].version + 1 : 1;
  const template = {
    $type$: 'SystemPromptTemplate',
    modelId,
    promptText,
    xmlSchemaVersion: 1,
    version: newVersion,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true
  };

  return await storeVersionedObject(template);
}
```

### Dependencies
- T004 (SystemPromptTemplate recipe)

### Verification
```typescript
await createSystemPrompt('gpt-4');
const prompt = await getActiveSystemPrompt('gpt-4');
console.log(prompt); // Should contain XML format instructions
```

---

## T012: Enhance Keyword/Subject Models with sourceXmlHash [Data Model]

**Priority**: P1
**Process**: Node.js (main)
**Files**: `/main/core/one-ai/models/Keyword.ts`, `/main/core/one-ai/models/Subject.ts` (modify)

### Description
Add optional `sourceXmlHash` field to Keyword and Subject models.

### Acceptance Criteria
- [ ] Keyword recipe includes `sourceXmlHash?: SHA256IdHash`
- [ ] Subject recipe includes `sourceXmlHash?: SHA256IdHash`
- [ ] `createKeyword()` accepts optional sourceXmlHash parameter
- [ ] `createSubject()` accepts optional sourceXmlHash parameter
- [ ] Backward compatible (field is optional)

### Implementation
Modify `/main/core/one-ai/models/Keyword.ts`:

```typescript
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

export async function createKeyword(
  term: string,
  frequency = 1,
  score?: number,
  subjects: SHA256IdHash[] = [],
  sourceXmlHash?: SHA256IdHash  // NEW
) {
  const keyword = {
    $type$: 'Keyword',
    term: term.toLowerCase().trim(),
    frequency,
    subjects,
    score,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    sourceXmlHash  // NEW - will be undefined if not provided
  };

  return await storeVersionedObject(keyword);
}
```

Modify `/main/core/one-ai/models/Subject.ts`:

```typescript
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

export async function createSubject(
  topicId: string,
  keywords: string[],
  keywordCombination: string,
  description: string,
  confidence: number,
  sourceXmlHash?: SHA256IdHash  // NEW
) {
  const subject = {
    $type$: 'Subject',
    id: keywordCombination,
    topic: topicId,
    keywords: keywords || [],
    timeRanges: [{
      start: Date.now(),
      end: Date.now()
    }],
    messageCount: 1,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    archived: false,
    sourceXmlHash  // NEW - will be undefined if not provided
  };

  return await storeVersionedObject(subject);
}
```

### Dependencies
None

### Verification
```typescript
const keyword = await createKeyword('test', 1, 0.9, [], 'sha256://abc...');
console.log(keyword.sourceXmlHash); // Should be defined
```

---

## T013: Integrate XML Protocol into AI Assistant Model [Core Logic]

**Priority**: P1
**Process**: Node.js (main)
**Files**: `/main/core/ai-assistant-model.ts` (modify)

### Description
Update AI Assistant Model to use XML protocol when sending messages to LLM.

### Acceptance Criteria
- [ ] Get active system prompt from SystemPromptManager
- [ ] Format query as XML using LLMManager
- [ ] Store query XML as attachment
- [ ] Parse LLM response XML
- [ ] Store response XML as attachment
- [ ] Set `sourceXmlHash` when creating Keywords/Subjects
- [ ] Background processing uses `setImmediate()`

### Implementation
Modify `/main/core/ai-assistant-model.ts`:

```typescript
// Add imports
import { getActiveSystemPrompt } from '../services/system-prompt-manager.js';
import { storeXMLAttachment } from '../services/attachment-service.js';

// In sendMessage or chatWithAnalysis method:
async sendMessageWithXML(topicId: string, message: string, contactId: string) {
  // 1. Get context for query
  const subjects = await this.topicAnalysisModel.getSubjects(topicId);
  const keywords = await this.topicAnalysisModel.getKeywords(topicId);

  const context = {
    topicId,
    messageCount: await getMessageCount(topicId),
    activeSubjects: subjects.filter(s => !s.archived).map(s => s.id),
    recentKeywords: keywords.slice(0, 20).map(k => k.term)
  };

  // 2. Format query as XML
  const xmlQuery = this.llmManager.formatQueryAsXML(message, context);

  // 3. Store query XML (optional)
  const queryMessageId = generateMessageId();
  const queryXmlHash = await storeXMLAttachment(
    topicId,
    queryMessageId,
    xmlQuery,
    'llm-query'
  );

  // 4. Get system prompt
  const systemPrompt = await getActiveSystemPrompt(this.llmModelId);

  // 5. Send to LLM
  const llmResponse = await this.llmManager.sendToLLM(systemPrompt, xmlQuery);

  // 6. Parse response
  const parsed = this.llmManager.parseXMLResponse(llmResponse);

  // 7. Store response XML
  const responseMessageId = generateMessageId();
  const responseXmlHash = await storeXMLAttachment(
    topicId,
    responseMessageId,
    llmResponse,
    'llm-response'
  );

  // 8. Background: Create keywords, subjects with sourceXmlHash
  setImmediate(async () => {
    try {
      for (const subject of parsed.analysis.subjects) {
        // Create subject with sourceXmlHash
        const subjectObj = await this.topicAnalysisModel.createSubject(
          topicId,
          subject.keywords.map(k => k.term),
          subject.name,
          subject.description,
          0.8,
          responseXmlHash  // Link to source XML
        );

        // Link keywords to subject with sourceXmlHash
        for (const kw of subject.keywords) {
          await this.topicAnalysisModel.addKeywordToSubject(
            topicId,
            kw.term,
            subjectObj.id,
            responseXmlHash  // Link to source XML
          );
        }
      }

      // Update summary
      if (parsed.analysis.summaryUpdate) {
        await this.topicAnalysisModel.updateSummary(
          topicId,
          parsed.analysis.summaryUpdate,
          0.8,
          responseXmlHash  // Link to source XML
        );
      }
    } catch (error) {
      console.error('[AIAssistantModel] Background analysis failed:', error);
    }
  });

  // 9. Return to UI immediately
  return {
    text: parsed.text,
    xmlAttachmentId: responseXmlHash,
    analysis: {
      subjects: parsed.analysis.subjects.map(s => ({
        name: s.name,
        keywords: s.keywords.map(k => k.term)
      })),
      keywords: parsed.analysis.subjects.flatMap(s =>
        s.keywords.map(k => k.term)
      ),
      summary: parsed.analysis.summaryUpdate
    }
  };
}
```

### Dependencies
- T010 (LLM Manager XML methods)
- T011 (SystemPromptManager)
- T012 (sourceXmlHash fields)

### Verification
Send test message and verify Keywords/Subjects have sourceXmlHash set.

---

## T014: Update TopicAnalysisModel - Add sourceXmlHash Parameter [Data Model]

**Priority**: P1
**Process**: Node.js (main)
**Files**: `/main/core/one-ai/models/TopicAnalysisModel.ts` (modify)

### Description
Update `addKeywordToSubject()` to accept optional sourceXmlHash parameter.

### Acceptance Criteria
- [ ] `addKeywordToSubject()` has optional sourceXmlHash parameter
- [ ] Parameter is passed through to keyword creation
- [ ] Backward compatible (parameter is optional)

### Implementation
Modify `/main/core/one-ai/models/TopicAnalysisModel.ts`:

```typescript
async addKeywordToSubject(
  topicId: string,
  term: string,
  subjectIdHash: SHA256IdHash,
  sourceXmlHash?: SHA256IdHash  // NEW parameter
) {
  this.state.assertCurrentState('Initialised');

  if (!subjectIdHash) {
    throw new Error('Subject ID hash is required');
  }

  // Check if keyword exists
  const room = new TopicAnalysisRoom(topicId, this.channelManager);
  const existingKeywords = await room.retrieveAllKeywords();
  const normalizedTerm = term.toLowerCase().trim();
  const existing = existingKeywords.find((k) => k.term === normalizedTerm);

  if (existing) {
    // Update existing keyword
    existing.frequency = (existing.frequency || 0) + 1;
    existing.lastSeen = Date.now();
    if (!existing.subjects) {
      existing.subjects = [];
    }
    if (!existing.subjects.includes(subjectIdHash)) {
      existing.subjects.push(subjectIdHash);
    }
    // Update sourceXmlHash if provided
    if (sourceXmlHash) {
      existing.sourceXmlHash = sourceXmlHash;
    }
    await this.channelManager.postToChannel(topicId, existing);
    return existing;
  }

  // Create new keyword with sourceXmlHash
  const keywordObj = {
    $type$: 'Keyword',
    term: normalizedTerm,
    frequency: 1,
    subjects: [subjectIdHash],
    score: 1.0,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    sourceXmlHash  // NEW - will be undefined if not provided
  };

  await this.channelManager.postToChannel(topicId, keywordObj);
  return keywordObj;
}
```

### Dependencies
- T012 (sourceXmlHash fields)

### Verification
```typescript
await topicAnalysisModel.addKeywordToSubject('topic1', 'test', subjectHash, xmlHash);
const keyword = await topicAnalysisModel.getKeywordByTerm('topic1', 'test');
console.log(keyword.sourceXmlHash); // Should equal xmlHash
```

---

## T015: Create End-to-End Integration Test [Integration Test]

**Priority**: P1
**Process**: Node.js (main)
**Files**: `/tests/integration/xml-llm-workflow.test.ts`

### Description
End-to-end test for complete XML LLM communication workflow.

### Acceptance Criteria
- [ ] Test formats query as XML
- [ ] Test mocks LLM response with valid XML
- [ ] Test parses response correctly
- [ ] Test stores XML attachments
- [ ] Test creates Keywords/Subjects with sourceXmlHash
- [ ] Uses real ONE.core instance

### Implementation
Create `/tests/integration/xml-llm-workflow.test.ts`:

```typescript
import { AIAssistantModel } from '../../main/core/ai-assistant-model.js';
import { TopicAnalysisModel } from '../../main/core/one-ai/models/TopicAnalysisModel.js';
import { initOneCore, shutdownOneCore } from '../helpers/one-core-helper.js';

describe('XML LLM Communication Workflow', () => {
  let aiModel: AIAssistantModel;
  let analysisModel: TopicAnalysisModel;

  beforeAll(async () => {
    await initOneCore();
    // Initialize models
  });

  afterAll(async () => {
    await shutdownOneCore();
  });

  test('should complete full XML message flow', async () => {
    const topicId = 'test-topic-xml';
    const message = 'How much should we save for college?';

    // Mock LLM response
    const mockXmlResponse = `
      <llmResponse>
        <response>For college savings, consider 529 plans.</response>
        <analysis>
          <subject name="college-savings" description="Saving for education" isNew="true">
            <keyword term="529-plan" confidence="0.95" />
            <keyword term="education" confidence="0.85" />
          </subject>
          <summaryUpdate>User asked about college savings amounts.</summaryUpdate>
        </analysis>
      </llmResponse>
    `;

    // Send message (with mocked LLM)
    const response = await aiModel.sendMessageWithXML(topicId, message, 'ai-1');

    // Verify response structure
    expect(response.text).toContain('529 plans');
    expect(response.xmlAttachmentId).toBeDefined();
    expect(response.analysis.keywords).toContain('529-plan');

    // Wait for background processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify keywords created with sourceXmlHash
    const keywords = await analysisModel.getKeywords(topicId);
    const fiveTwentyNinePlan = keywords.find(k => k.term === '529-plan');
    expect(fiveTwentyNinePlan).toBeDefined();
    expect(fiveTwentyNinePlan.sourceXmlHash).toBe(response.xmlAttachmentId);

    // Verify subjects created
    const subjects = await analysisModel.getSubjects(topicId);
    const collegeSavings = subjects.find(s => s.id === 'college-savings');
    expect(collegeSavings).toBeDefined();
    expect(collegeSavings.sourceXmlHash).toBe(response.xmlAttachmentId);

    // Verify keywords linked to subjects
    expect(fiveTwentyNinePlan.subjects).toContain(collegeSavings.id);
  });
});
```

### Dependencies
- T013 (AI Assistant Model integration)
- T014 (TopicAnalysisModel with sourceXmlHash)

### Verification
```bash
npm test -- tests/integration/xml-llm-workflow.test.ts
# Should pass end-to-end
```

---

## T016: Update IPC Handler for llm:chat [IPC]

**Priority**: P1
**Process**: Node.js (main)
**Files**: `/main/ipc/handlers/llm.ts` (modify)

### Description
Update existing `llm:chat` IPC handler to use XML protocol.

### Acceptance Criteria
- [ ] Handler calls `sendMessageWithXML()` instead of old method
- [ ] Returns `{text, xmlAttachmentId, analysis}` structure
- [ ] Error handling for XML parse failures
- [ ] Backward compatible (can coexist with old path)

### Implementation
Modify `/main/ipc/handlers/llm.ts`:

```typescript
ipcMain.handle('llm:chat', async (_event, { topicId, message, contactId }) => {
  try {
    console.log('[IPC] llm:chat called with XML protocol:', {
      topicId,
      messageLength: message.length,
      contactId
    });

    const response = await aiAssistantModel.sendMessageWithXML(
      topicId,
      message,
      contactId
    );

    return {
      success: true,
      data: response
    };
  } catch (error) {
    console.error('[IPC] llm:chat error:', error);

    // Fail fast on XML errors
    if (error.message.includes('Invalid XML')) {
      return {
        success: false,
        error: `LLM returned malformed XML: ${error.message}`
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
});
```

### Dependencies
- T013 (AI Assistant Model with XML)

### Verification
Test via browser:
```typescript
const result = await window.electronAPI.invoke('llm:chat', {
  topicId: 'test-topic',
  message: 'Test message',
  contactId: 'ai-1'
});
console.log(result.data.xmlAttachmentId); // Should be defined
```

---

## T017: Recipe Registration [Setup]

**Priority**: P0 (Blocking)
**Process**: Node.js (main)
**Files**: `/main/core/one-ai/recipes/index.ts` (modify)

### Description
Register new recipes with ONE.core.

### Acceptance Criteria
- [ ] XMLMessageAttachment recipe registered
- [ ] SystemPromptTemplate recipe registered
- [ ] Recipes loaded at startup
- [ ] No registration errors

### Implementation
Modify `/main/core/one-ai/recipes/index.ts`:

```typescript
import { XMLMessageAttachmentRecipe } from './xml-message-attachment.js';
import { SystemPromptTemplateRecipe } from './system-prompt-template.js';
// ... existing imports ...

export const recipes = {
  XMLMessageAttachment: XMLMessageAttachmentRecipe,
  SystemPromptTemplate: SystemPromptTemplateRecipe,
  // ... existing recipes ...
};

// Register all recipes
export function registerRecipes() {
  for (const recipe of Object.values(recipes)) {
    registerRecipe(recipe);
  }
}
```

### Dependencies
- T003 (XMLMessageAttachment recipe)
- T004 (SystemPromptTemplate recipe)

### Verification
```bash
# Start app and check logs
npm run electron
# Should see "Registered recipe: XMLMessageAttachment"
# Should see "Registered recipe: SystemPromptTemplate"
```

---

## Parallel Tasks Section

The following tasks can be executed in parallel using Task agents:

---

## T018 [P]: Add UI Display for XML Attachment Link [UI]

**Priority**: P2
**Process**: Browser (renderer)
**Files**: `/electron-ui/src/components/Chat/MessageItem.tsx` (modify)

### Description
Add optional UI indicator that message has XML attachment (for debugging).

### Acceptance Criteria
- [ ] Show small icon/badge if `xmlAttachmentId` is present
- [ ] Click opens dev tools with attachment hash
- [ ] Only visible in development mode
- [ ] No ONE.core imports in browser code

### Implementation
```typescript
// In MessageItem component
{message.xmlAttachmentId && process.env.NODE_ENV === 'development' && (
  <div className="text-xs text-gray-500 mt-1">
    <button
      onClick={() => {
        console.log('XML Attachment:', message.xmlAttachmentId);
      }}
      className="hover:underline"
    >
      [XML]
    </button>
  </div>
)}
```

### Dependencies
- T016 (IPC returns xmlAttachmentId)

### Parallel Execution
Can run in parallel with other UI tasks (T019, T020).

---

## T019 [P]: Update Chat Component Types [UI]

**Priority**: P2
**Process**: Browser (renderer)
**Files**: `/electron-ui/src/types/chat.ts` (modify)

### Description
Update TypeScript types for message responses to include xmlAttachmentId.

### Acceptance Criteria
- [ ] Add `xmlAttachmentId?: string` to LLMResponse type
- [ ] Add `analysis` field with subjects/keywords
- [ ] No breaking changes to existing types

### Implementation
```typescript
export interface LLMResponse {
  text: string;
  xmlAttachmentId?: string;  // NEW
  analysis?: {               // NEW
    subjects: Array<{
      name: string;
      keywords: string[];
    }>;
    keywords: string[];
    summary: string;
  };
}
```

### Dependencies
None

### Parallel Execution
Can run in parallel with T018, T020.

---

## T020 [P]: Add Keywords Display in Topic Summary [UI]

**Priority**: P2
**Process**: Browser (renderer)
**Files**: `/electron-ui/src/components/TopicSummary/KeywordCloud.tsx` (modify)

### Description
Update KeywordCloud to show sourceXmlHash link (dev mode only).

### Acceptance Criteria
- [ ] Display keyword term and confidence
- [ ] Show XML attachment link in dev mode
- [ ] Click logs sourceXmlHash to console
- [ ] No ONE.core imports

### Implementation
```typescript
// In KeywordCloud component
{keywords.map(keyword => (
  <div key={keyword.term} className="keyword-badge">
    <span>{keyword.term}</span>
    {keyword.sourceXmlHash && process.env.NODE_ENV === 'development' && (
      <button
        onClick={() => console.log('Source XML:', keyword.sourceXmlHash)}
        className="ml-1 text-xs opacity-50 hover:opacity-100"
      >
        [src]
      </button>
    )}
  </div>
))}
```

### Dependencies
None

### Parallel Execution
Can run in parallel with T018, T019.

---

## Polish Tasks (Execute in Parallel)

---

## T021 [P]: TypeScript Type Checking [Polish]

**Priority**: P3
**Process**: Build
**Files**: All TypeScript files

### Description
Run TypeScript compiler to check for type errors.

### Acceptance Criteria
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] All XML service types correct
- [ ] All recipe types correct

### Implementation
```bash
npx tsc --noEmit
```

### Dependencies
All implementation tasks complete

### Parallel Execution
Can run with T022, T023.

---

## T022 [P]: ESLint Check [Polish]

**Priority**: P3
**Process**: Build
**Files**: All TypeScript/JavaScript files

### Description
Run ESLint to check code quality.

### Acceptance Criteria
- [ ] No ESLint errors
- [ ] Fix any warnings
- [ ] Code follows project conventions

### Implementation
```bash
npm run lint
```

### Dependencies
All implementation tasks complete

### Parallel Execution
Can run with T021, T023.

---

## T023 [P]: Run All Tests [Polish]

**Priority**: P3
**Process**: Test
**Files**: All test files

### Description
Run complete test suite to ensure everything works.

### Acceptance Criteria
- [ ] All contract tests pass
- [ ] All integration tests pass
- [ ] All unit tests pass
- [ ] No test failures

### Implementation
```bash
npm test
```

### Dependencies
All implementation tasks complete

### Parallel Execution
Can run with T021, T022.

---

## Summary

**Total Tasks**: 23
**Parallel Tasks**: 6 (T018-T020, T021-T023)
**Estimated Completion**: Sequential execution ~8-12 hours

### Execution Strategy

1. **Setup & Foundation** (T001-T005): Install dependencies, create contracts, recipes, validation
2. **Core Services** (T006-T011): XML formatting, parsing, storage, system prompts
3. **Data Models** (T012): Enhance with sourceXmlHash
4. **Integration** (T013-T016): AI Assistant Model, IPC handlers
5. **Testing** (T002, T009, T015): Contract, storage, E2E tests
6. **Parallel UI** (T018-T020): Browser components
7. **Parallel Polish** (T021-T023): Type checking, linting, tests

### Parallel Execution Example

```bash
# After T017 complete, run UI tasks in parallel:
# Terminal 1:
claude-code "Execute T018: Add UI Display for XML Attachment Link"

# Terminal 2:
claude-code "Execute T019: Update Chat Component Types"

# Terminal 3:
claude-code "Execute T020: Add Keywords Display in Topic Summary"

# After all implementation complete, run polish tasks in parallel:
# Terminal 1:
npx tsc --noEmit

# Terminal 2:
npm run lint

# Terminal 3:
npm test
```

---

*Tasks generated from plan.md, data-model.md, contracts/xml-schema.md, quickstart.md*
*Following TDD: Contract → Integration → Implementation → Unit tests*
*LAMA Architecture: Node.js = ALL logic, Browser = UI ONLY*
