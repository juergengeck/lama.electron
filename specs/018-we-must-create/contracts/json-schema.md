# JSON Schema Contract: LLM Communication Protocol (Ollama Structured Outputs)

**Feature**: 018-we-must-create | **Version**: 1.0.0 | **Date**: 2025-10-06

---

## Purpose

Define JSON schemas for Ollama's structured output `format` parameter. This contract ensures:
- LLMs generate guaranteed-valid JSON (enforced by Ollama, not prompt engineering)
- Responses contain both human-readable text and structured analysis
- System can reliably extract keywords, subjects, and summaries without parsing errors

**Key Difference from XML Approach**: Ollama validates structure at generation time, eliminating malformed responses. We convert validated JSON to XML only for storage/traceability.

---

## 1. Response Schema (for Ollama `format` parameter)

### JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["response", "analysis"],
  "properties": {
    "response": {
      "type": "string",
      "description": "Natural language response to user",
      "minLength": 1,
      "maxLength": 10000
    },
    "analysis": {
      "type": "object",
      "required": ["subjects", "summaryUpdate"],
      "properties": {
        "subjects": {
          "type": "array",
          "description": "Main themes discussed in this exchange",
          "minItems": 0,
          "maxItems": 3,
          "items": {
            "type": "object",
            "required": ["name", "description", "isNew", "keywords"],
            "properties": {
              "name": {
                "type": "string",
                "description": "Subject identifier (lowercase, hyphenated)",
                "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
                "minLength": 2,
                "maxLength": 50
              },
              "description": {
                "type": "string",
                "description": "Brief explanation of subject",
                "minLength": 10,
                "maxLength": 200
              },
              "isNew": {
                "type": "boolean",
                "description": "True if new subject, false if continuing existing"
              },
              "keywords": {
                "type": "array",
                "description": "Key concepts for this subject",
                "minItems": 0,
                "maxItems": 10,
                "items": {
                  "type": "object",
                  "required": ["term", "confidence"],
                  "properties": {
                    "term": {
                      "type": "string",
                      "description": "Normalized keyword (lowercase, hyphenated)",
                      "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
                      "minLength": 2,
                      "maxLength": 50
                    },
                    "confidence": {
                      "type": "number",
                      "description": "Extraction confidence",
                      "minimum": 0.0,
                      "maximum": 1.0
                    }
                  }
                }
              }
            }
          }
        },
        "summaryUpdate": {
          "type": "string",
          "description": "2-3 sentence incremental summary of this exchange",
          "minLength": 10,
          "maxLength": 500
        }
      }
    }
  }
}
```

### TypeScript Schema Definition (for code)

```typescript
// main/schemas/llm-response.schema.ts

export const LLM_RESPONSE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["response", "analysis"],
  properties: {
    response: {
      type: "string",
      description: "Natural language response to user",
      minLength: 1,
      maxLength: 10000
    },
    analysis: {
      type: "object",
      required: ["subjects", "summaryUpdate"],
      properties: {
        subjects: {
          type: "array",
          description: "Main themes discussed in this exchange",
          minItems: 0,
          maxItems: 3,
          items: {
            type: "object",
            required: ["name", "description", "isNew", "keywords"],
            properties: {
              name: {
                type: "string",
                description: "Subject identifier (lowercase, hyphenated)",
                pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
                minLength: 2,
                maxLength: 50
              },
              description: {
                type: "string",
                description: "Brief explanation of subject",
                minLength: 10,
                maxLength: 200
              },
              isNew: {
                type: "boolean",
                description: "True if new subject, false if continuing existing"
              },
              keywords: {
                type: "array",
                description: "Key concepts for this subject",
                minItems: 0,
                maxItems: 10,
                items: {
                  type: "object",
                  required: ["term", "confidence"],
                  properties: {
                    term: {
                      type: "string",
                      description: "Normalized keyword (lowercase, hyphenated)",
                      pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
                      minLength: 2,
                      maxLength: 50
                    },
                    confidence: {
                      type: "number",
                      description: "Extraction confidence",
                      minimum: 0.0,
                      maximum: 1.0
                    }
                  }
                }
              }
            }
          }
        },
        summaryUpdate: {
          type: "string",
          description: "2-3 sentence incremental summary of this exchange",
          minLength: 10,
          maxLength: 500
        }
      }
    }
  }
} as const;

// TypeScript types derived from schema
export interface LLMKeyword {
  term: string;
  confidence: number;
}

export interface LLMSubject {
  name: string;
  description: string;
  isNew: boolean;
  keywords: LLMKeyword[];
}

export interface LLMAnalysis {
  subjects: LLMSubject[];
  summaryUpdate: string;
}

export interface LLMResponse {
  response: string;
  analysis: LLMAnalysis;
}
```

---

## 2. Example Response

### Valid JSON (Ollama generates this)

```json
{
  "response": "For college savings, financial advisors often recommend 529 plans. They offer tax advantages and can be used for qualified education expenses. The amount to save depends on factors like current age of children, expected college costs, and your timeframe.",
  "analysis": {
    "subjects": [
      {
        "name": "college-savings",
        "description": "Discussion of saving strategies for children's higher education",
        "isNew": true,
        "keywords": [
          {"term": "529-plan", "confidence": 0.95},
          {"term": "tax-advantages", "confidence": 0.85},
          {"term": "education-expenses", "confidence": 0.90},
          {"term": "financial-planning", "confidence": 0.75}
        ]
      }
    ],
    "summaryUpdate": "User asked about college savings amounts. Assistant explained 529 plans and mentioned that savings targets depend on children's ages and expected costs."
  }
}
```

### XML Conversion (for storage)

After receiving valid JSON from Ollama, convert to XML for attachment storage:

```xml
<llmResponse version="1.0.0" format="ollama-structured">
  <response>For college savings, financial advisors often recommend 529 plans. They offer tax advantages and can be used for qualified education expenses. The amount to save depends on factors like current age of children, expected college costs, and your timeframe.</response>
  <analysis>
    <subject name="college-savings" description="Discussion of saving strategies for children's higher education" isNew="true">
      <keyword term="529-plan" confidence="0.95" />
      <keyword term="tax-advantages" confidence="0.85" />
      <keyword term="education-expenses" confidence="0.90" />
      <keyword term="financial-planning" confidence="0.75" />
    </subject>
    <summaryUpdate>User asked about college savings amounts. Assistant explained 529 plans and mentioned that savings targets depend on children's ages and expected costs.</summaryUpdate>
  </analysis>
</llmResponse>
```

---

## 3. Usage with Ollama API

### Example Code

```typescript
import { LLM_RESPONSE_SCHEMA } from './schemas/llm-response.schema.js';

// In chatWithAnalysis() or similar method
const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.1',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Extract subjects and keywords from conversations.'
      },
      {
        role: 'user',
        content: userMessage
      }
    ],
    format: LLM_RESPONSE_SCHEMA,  // Ollama enforces this schema
    stream: false,
    options: {
      temperature: 0  // Deterministic for structured output
    }
  })
});

const data = await response.json();
const llmResponse: LLMResponse = JSON.parse(data.message.content);

// llmResponse is GUARANTEED to match LLMResponse interface
// No need for try/catch on parsing - Ollama validates before returning
```

---

## 4. System Prompt Template

Even with structured outputs, provide clear instructions:

```
You are an AI assistant that helps analyze conversations.

For each response, you must:
1. Provide a natural language response to the user
2. Extract 1-3 main subjects (themes) from the conversation
3. For each subject, identify 3-7 key concepts with confidence scores
4. Generate a brief 2-3 sentence summary of this exchange

Guidelines:
- Use lowercase, hyphenated terms (e.g., "college-savings", "529-plan")
- Set isNew=true for new subjects, isNew=false for continuing existing topics
- Only include keywords with confidence ≥ 0.6
- Focus summaries on new information, not repetition

The system will enforce the correct JSON structure automatically.
```

**Note**: Unlike the XML approach, we don't need to teach the format in the prompt - Ollama handles that.

---

## 5. Validation & Error Handling

### Ollama-Side Validation
- **Structure**: Ollama validates JSON schema before returning
- **Types**: Ollama ensures correct types (string, number, boolean, array)
- **Required fields**: Ollama ensures all required fields present
- **Patterns**: Ollama validates regex patterns for strings

### Application-Side Validation
```typescript
function validateLLMResponse(data: any): LLMResponse {
  // Ollama guarantees structure, but we can add business logic checks

  if (!data.response || data.response.trim().length === 0) {
    throw new Error('Empty response text');
  }

  if (!data.analysis || !data.analysis.subjects) {
    throw new Error('Missing analysis data');
  }

  // Business logic: Ensure at least one subject if summaryUpdate exists
  if (data.analysis.summaryUpdate && data.analysis.subjects.length === 0) {
    console.warn('Summary provided but no subjects extracted');
  }

  return data as LLMResponse;
}
```

### Error Handling
```typescript
try {
  const response = await ollamaChat(message, { format: LLM_RESPONSE_SCHEMA });
  const validated = validateLLMResponse(JSON.parse(response.message.content));

  // Convert to XML for storage
  const xml = convertToXML(validated);

  // Store as attachment
  await storeXMLAttachment(topicId, messageId, xml);

  return validated;
} catch (error) {
  // Fail fast - no fallback
  console.error('[LLM] Structured output failed:', error);
  throw new Error(`LLM response validation failed: ${error.message}`);
}
```

---

## 6. Benefits Over XML Prompt Engineering

| Aspect | XML (Prompt Engineering) | JSON (Ollama Structured) |
|--------|-------------------------|-------------------------|
| **Validation** | Parse-time (after generation) | Generation-time (before return) |
| **Malformed Responses** | Must handle with try/catch | Never happens - Ollama validates |
| **Prompt Complexity** | Must teach XML format in prompt | Just describe intent |
| **Token Overhead** | ~200-400 tokens for format examples | ~50-100 tokens for intent |
| **Error Recovery** | Need retry logic for bad XML | No retry needed - always valid |
| **Parsing Performance** | XML parsing ~5-10ms | JSON parsing ~1-2ms |
| **Type Safety** | Manual validation needed | Schema guarantees types |

---

## 7. Migration Path

### No Legacy Migration
- Old conversations stay as-is (text-based)
- New conversations use JSON schema from day 1
- No need to convert existing data

### Feature Flag (Optional)
```typescript
const USE_STRUCTURED_OUTPUT = true; // Enable Ollama structured outputs

async function chat(message: string, topicId: string) {
  if (USE_STRUCTURED_OUTPUT) {
    return await chatWithStructuredOutput(message, topicId);
  } else {
    return await chatLegacy(message, topicId);
  }
}
```

---

## 8. Performance Targets

| Metric | Target | Expected (Ollama Structured) |
|--------|--------|------------------------------|
| Schema validation | <5ms | 0ms (Ollama-side) |
| JSON parsing | <5ms | 1-2ms |
| XML conversion | <5ms | 2-3ms |
| Total overhead | <20ms | ~5ms |
| Malformed response rate | <1% | 0% (guaranteed) |

---

## 9. References

- **Ollama Structured Outputs**: https://ollama.com/blog/structured-outputs
- **JSON Schema Spec**: https://json-schema.org/draft-07/schema
- **Feature Spec**: `/specs/018-we-must-create/spec.md`
- **Implementation Plan**: `/specs/018-we-must-create/plan.md`

---

*Contract v1.0.0 - Leverages Ollama's native structured outputs for guaranteed valid JSON*
