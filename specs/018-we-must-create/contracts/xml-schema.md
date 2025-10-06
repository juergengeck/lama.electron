# XML Schema Contract: LLM Communication Protocol

**Feature**: 018-we-must-create | **Version**: 1.0.0 | **Date**: 2025-10-06

---

## Purpose

Define the XML format for structured LLM queries and responses. This contract ensures:
- LLMs receive consistent, parseable query structure
- LLM responses contain both human-readable text and structured analysis
- System can reliably extract keywords, subjects, and summaries

---

## 1. LLM Query Format

### Schema

```xml
<llmQuery>
  <userMessage>[User's natural language message]</userMessage>
  <context topicId="[topic-id]" messageCount="[number]">
    <activeSubjects>[comma-separated subject names]</activeSubjects>
    <recentKeywords>[comma-separated keyword terms]</recentKeywords>
  </context>
</llmQuery>
```

### Element Specifications

#### `<llmQuery>` (Root)
- **Required**: YES
- **Cardinality**: Exactly 1
- **Attributes**: None
- **Purpose**: Container for all query data

#### `<userMessage>`
- **Required**: YES
- **Cardinality**: Exactly 1
- **Attributes**: None
- **Content**: User's natural language message (UTF-8 text)
- **Constraints**:
  - Must not be empty
  - Special characters `<`, `>`, `&` must be escaped as `&lt;`, `&gt;`, `&amp;`
  - Maximum length: 10,000 characters

#### `<context>`
- **Required**: YES (may be empty)
- **Cardinality**: Exactly 1
- **Attributes**:
  - `topicId` (string, required): Topic/conversation identifier
  - `messageCount` (integer, required): Total messages in conversation
- **Purpose**: Provide conversation history context to LLM

#### `<activeSubjects>`
- **Required**: NO
- **Cardinality**: 0 or 1
- **Attributes**: None
- **Content**: Comma-separated list of current subject names
- **Example**: `"family planning, education costs, college savings"`
- **Constraints**:
  - May be empty if no active subjects
  - Maximum 20 subjects

#### `<recentKeywords>`
- **Required**: NO
- **Cardinality**: 0 or 1
- **Attributes**: None
- **Content**: Comma-separated list of recent keyword terms
- **Example**: `"children, university, tuition, 529 plan"`
- **Constraints**:
  - May be empty if no recent keywords
  - Maximum 50 keywords

### Example

```xml
<llmQuery>
  <userMessage>How much should we save for college?</userMessage>
  <context topicId="family-planning-2025" messageCount="12">
    <activeSubjects>family planning, education costs</activeSubjects>
    <recentKeywords>children, university, tuition, savings</recentKeywords>
  </context>
</llmQuery>
```

---

## 2. LLM Response Format

### Schema

```xml
<llmResponse>
  <response>[Natural language response to user]</response>
  <analysis>
    <subject name="[subject name]" description="[brief explanation]" isNew="true|false">
      <keyword term="[keyword term]" confidence="0.0-1.0" />
      <!-- Repeat <keyword> 3-7 times -->
    </subject>
    <!-- Repeat <subject> 1-3 times -->
    <summaryUpdate>[Incremental summary of this exchange]</summaryUpdate>
  </analysis>
</llmResponse>
```

### Element Specifications

#### `<llmResponse>` (Root)
- **Required**: YES
- **Cardinality**: Exactly 1
- **Attributes**: None
- **Purpose**: Container for response and analysis

#### `<response>`
- **Required**: YES
- **Cardinality**: Exactly 1
- **Attributes**: None
- **Content**: Natural language response to user (UTF-8 text)
- **Constraints**:
  - Must not be empty
  - Special characters must be XML-escaped
  - Typical length: 100-2000 characters

#### `<analysis>`
- **Required**: YES
- **Cardinality**: Exactly 1
- **Attributes**: None
- **Purpose**: Container for structured extraction data
- **Note**: May contain empty elements if no analysis extracted

#### `<subject>`
- **Required**: NO (but recommended - at least 1)
- **Cardinality**: 0 to 3
- **Attributes**:
  - `name` (string, required): Subject identifier (e.g., "college-savings")
  - `description` (string, required): Brief explanation (50-200 chars)
  - `isNew` (boolean, required): "true" if new subject, "false" if continuing existing
- **Purpose**: Identify main themes discussed in this exchange
- **Constraints**:
  - `name` should be hyphen-separated lowercase (e.g., "family-planning")
  - `description` should be 1-2 sentences
  - Maximum 3 subjects per response

#### `<keyword>`
- **Required**: NO (but recommended - 3-7 per subject)
- **Cardinality**: 0 to 10 per subject
- **Attributes**:
  - `term` (string, required): Normalized keyword (lowercase, no special chars)
  - `confidence` (float, required): Extraction confidence 0.0-1.0
- **Purpose**: Key concepts associated with this subject
- **Constraints**:
  - `term` should be lowercase, hyphenated for multi-word (e.g., "529-plan")
  - `confidence` typical range: 0.6-1.0 (below 0.6 should be omitted)
  - Recommended: 3-7 keywords per subject

#### `<summaryUpdate>`
- **Required**: YES
- **Cardinality**: Exactly 1
- **Attributes**: None
- **Content**: 2-3 sentence incremental summary of this exchange
- **Purpose**: Accumulate conversation summary over time
- **Constraints**:
  - Should focus on new information, not repeat prior context
  - Typical length: 50-300 characters

### Example

```xml
<llmResponse>
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

## 3. Validation Rules

### Query Validation
1. Must be well-formed XML (pass XML parser)
2. Root element must be `<llmQuery>`
3. Must contain exactly one `<userMessage>` with non-empty content
4. Must contain exactly one `<context>` with `topicId` and `messageCount` attributes
5. `<context>` may contain zero or one `<activeSubjects>` and `<recentKeywords>`

### Response Validation
1. Must be well-formed XML (pass XML parser)
2. Root element must be `<llmResponse>`
3. Must contain exactly one `<response>` with non-empty content
4. Must contain exactly one `<analysis>`
5. `<analysis>` may contain 0-3 `<subject>` elements
6. Each `<subject>` must have `name`, `description`, and `isNew` attributes
7. Each `<subject>` may contain 0-10 `<keyword>` elements
8. Each `<keyword>` must have `term` and `confidence` attributes
9. `confidence` must be parseable as float 0.0-1.0
10. Must contain exactly one `<summaryUpdate>` (may be empty)

### Error Handling
- **Malformed XML**: Throw parse error, fail fast (no fallback)
- **Missing required elements**: Throw validation error
- **Invalid attribute values**: Throw validation error
- **Empty response**: Throw validation error
- **No fallbacks or mitigation**: Fix LLM prompt or model configuration

---

## 4. Encoding & Special Characters

### Character Encoding
- **Encoding**: UTF-8 only
- **BOM**: Not required (but accepted)

### XML Escaping (Required)
| Character | Escaped Form | Context |
|-----------|--------------|---------|
| `<` | `&lt;` | Always |
| `>` | `&gt;` | Always |
| `&` | `&amp;` | Always |
| `"` | `&quot;` | Inside attributes |
| `'` | `&apos;` | Inside attributes |

### CDATA Sections (Optional)
For response text with heavy markup:
```xml
<response><![CDATA[
You can use <angle brackets> and & symbols freely here.
]]></response>
```

---

## 5. Versioning

### Current Version: 1.0.0

### Version Field Location
- Stored in `XMLMessageAttachment` versioned object
- Field: `version: 1`
- Future: `version: 2`, etc.

### Breaking Changes Policy
- New required elements: Major version bump (1.x → 2.0)
- New optional elements: Minor version bump (1.0 → 1.1)
- New attributes: Minor version bump
- Attribute value changes: Patch version bump (1.0.0 → 1.0.1)

### Forward Compatibility
- Parsers should ignore unknown elements/attributes (lenient parsing)
- Validators should reject unknown required elements (strict validation)

---

## 6. Contract Tests

### Test Coverage Required
- ✅ Parse valid query XML
- ✅ Parse valid response XML
- ✅ Reject malformed XML
- ✅ Reject missing required elements
- ✅ Reject invalid attribute types
- ✅ Validate confidence range 0.0-1.0
- ✅ Handle empty optional elements
- ✅ Escape special characters correctly
- ✅ UTF-8 encoding preservation

### Test Files
- `/tests/contract/xml-schema.test.ts` - Schema validation tests
- `/tests/integration/xml-parsing.test.ts` - Parser integration tests

---

## 7. System Prompt Template

LLMs must be instructed with this format in their system prompt:

```
You are an AI assistant. Always respond using this XML format:

<llmResponse>
  <response>[Your natural language response here]</response>
  <analysis>
    <subject name="topic-name" description="brief explanation" isNew="true|false">
      <keyword term="keyword-term" confidence="0.8" />
      <!-- Include 3-7 keywords per subject -->
    </subject>
    <!-- Include 1-3 subjects when relevant -->
    <summaryUpdate>[Brief 2-3 sentence summary of this exchange]</summaryUpdate>
  </analysis>
</llmResponse>

Rules:
- Always extract 1-3 subjects (main themes)
- Mark isNew="true" for new subjects, isNew="false" for continuing existing subjects
- Extract 3-7 keywords per subject with confidence 0.6-1.0
- Provide incremental summary (focus on new information)
- Use lowercase, hyphenated terms for names (e.g., "college-savings")
```

---

## 8. Performance Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Parse time (10KB response) | <10ms | 3-5ms (fast-xml-parser) |
| Validation time | <5ms | TBD |
| Average response size | <5KB | TBD |
| XML overhead vs plain text | <30% | TBD |

---

## 9. References

- **Feature Spec**: `/specs/018-we-must-create/spec.md`
- **Implementation Plan**: `/specs/018-we-must-create/plan.md`
- **Research**: `/specs/018-we-must-create/research.md`
- **Parser Library**: fast-xml-parser v4.x (https://github.com/NaturalIntelligence/fast-xml-parser)

---

*Contract v1.0.0 - Enforces structured LLM communication with fail-fast validation*
