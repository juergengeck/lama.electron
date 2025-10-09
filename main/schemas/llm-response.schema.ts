/**
 * JSON Schema for LLM Structured Outputs (Ollama format parameter)
 * Feature: 018-we-must-create
 *
 * This schema is passed to Ollama's `format` parameter to guarantee
 * valid JSON structure in responses. Eliminates need for XML prompt
 * engineering and error handling for malformed responses.
 */

export const LLM_RESPONSE_SCHEMA = {
  type: "object",
  required: ["subjects", "summary"],
  properties: {
    subjects: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "keyConcepts"],
        properties: {
          name: {
            type: "string"
          },
          isNew: {
            type: "boolean"
          },
          keyConcepts: {
            type: "array",
            items: {
              type: "object",
              required: ["keyword", "confidence"],
              properties: {
                keyword: { type: "string" },
                confidence: { type: "number" }
              }
            }
          }
        }
      }
    },
    summary: {
      type: "string"
    }
  }
} as const;

// TypeScript types derived from schema
export interface LLMConcept {
  keyword: string;
  confidence: number;
}

export interface LLMSubject {
  name: string;
  isNew?: boolean;
  keyConcepts: LLMConcept[];
}

export interface LLMAnalysis {
  subjects: LLMSubject[];
  summary: string;
}

/**
 * System prompt for structured output
 *
 * Note: Unlike XML approach, we don't need to teach format in prompt.
 * Ollama enforces schema automatically. Prompt just describes intent.
 */
export const STRUCTURED_OUTPUT_SYSTEM_PROMPT = `Extract subjects and concepts from conversations. Return JSON only.

Format:
{
  "subjects": [{
    "name": "subject-name",
    "isNew": true,
    "keyConcepts": [{"keyword": "keyword", "confidence": 0.8}]
  }],
  "summary": "brief summary"
}

Use lowercase hyphenated terms.`;

/**
 * Validate LLM response (business logic checks)
 */
export function validateLLMResponse(data: any): LLMAnalysis {
  if (!data.subjects) {
    throw new Error('Missing subjects');
  }
  return data as LLMAnalysis;
}

// No XML conversion needed - caller creates ONE.core objects directly from structured JSON
