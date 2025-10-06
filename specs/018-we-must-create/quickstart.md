# Quickstart: XML-Based LLM Communication

**Feature**: 018-we-must-create | **Version**: 1.0.0 | **Date**: 2025-10-06

---

## Purpose

This quickstart demonstrates how to use the XML-based LLM communication system for structured queries and responses with automatic keyword/subject extraction.

---

## Prerequisites

- LAMA Electron app running (Node.js ONE.core initialized)
- LLM model configured (e.g., GPT-4, Claude 3)
- User authenticated and logged in

---

## 1. Send a Message with XML Query

### From UI (Renderer Process)

```typescript
// electron-ui/src/components/Chat.tsx
const sendMessage = async () => {
  const response = await window.electronAPI.invoke('llm:chat', {
    topicId: 'family-planning-2025',
    message: 'How much should we save for college?',
    contactId: 'ai-assistant-1'
  });

  // response contains:
  // {
  //   text: "For college savings, financial advisors...",
  //   xmlAttachmentId: "sha256://abc123...",
  //   analysis: {
  //     subjects: [{name: "college-savings", keywords: [...]}],
  //     keywords: ["529-plan", "tax-advantages", ...],
  //     summary: "User asked about college savings..."
  //   }
  // }

  console.log('LLM Response:', response.text);
  console.log('Extracted Keywords:', response.analysis.keywords);
};
```

### What Happens Internally

1. **IPC Handler** (`/main/ipc/handlers/llm.ts`):
   - Receives message from UI
   - Calls `llmManager.chatWithAnalysis()`

2. **LLM Manager** (`/main/services/llm-manager.ts`):
   - Formats query as XML with context
   - Sends to LLM with system prompt
   - Parses XML response
   - Stores XML as attachment
   - Extracts analysis data

3. **Background Processing** (`ai-assistant-model.ts`):
   - Creates Keywords with `sourceXmlHash`
   - Creates Subjects with `sourceXmlHash`
   - Updates Summary with `sourceXmlHash`

---

## 2. Configure System Prompt for LLM

### Create Template (One-time Setup)

```typescript
// main/services/llm-manager.ts
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';

async function createSystemPromptTemplate(modelId: string) {
  const template = {
    $type$: 'SystemPromptTemplate',
    modelId,
    promptText: `You are an AI assistant. Always respond using this XML format:

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
- Use lowercase, hyphenated names (e.g., "college-savings")`,
    xmlSchemaVersion: 1,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true
  };

  return await storeVersionedObject(template);
}
```

### Retrieve Active Template

```typescript
// main/services/llm-manager.ts
import { queryVersionedObjects } from '@refinio/one.core/lib/storage-versioned-objects.js';

async function getActiveSystemPrompt(modelId: string) {
  const templates = await queryVersionedObjects({
    $type$: 'SystemPromptTemplate',
    modelId,
    active: true
  });

  return templates[0]?.promptText || DEFAULT_SYSTEM_PROMPT;
}
```

---

## 3. Format XML Query

### Create Query with Context

```typescript
// main/services/llm-manager.ts
import { XMLBuilder } from 'fast-xml-parser';

async function formatQueryAsXML(message: string, context: {
  topicId: string,
  activeSubjects: string[],
  recentKeywords: string[]
}) {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true
  });

  const xmlObj = {
    llmQuery: {
      userMessage: message,
      context: {
        '@_topicId': context.topicId,
        '@_messageCount': context.messageCount,
        activeSubjects: context.activeSubjects.join(', '),
        recentKeywords: context.recentKeywords.join(', ')
      }
    }
  };

  return builder.build(xmlObj);
}

// Example output:
// <llmQuery>
//   <userMessage>How much should we save for college?</userMessage>
//   <context topicId="family-planning-2025" messageCount="12">
//     <activeSubjects>family planning, education costs</activeSubjects>
//     <recentKeywords>children, university, tuition</recentKeywords>
//   </context>
// </llmQuery>
```

---

## 4. Parse XML Response

### Extract Text and Analysis

```typescript
// main/services/llm-manager.ts
import { XMLParser } from 'fast-xml-parser';

async function parseXMLResponse(xmlString: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
    trimValues: true
  });

  const parsed = parser.parse(xmlString);

  if (!parsed.llmResponse) {
    throw new Error('Invalid XML: missing <llmResponse> root');
  }

  const response = parsed.llmResponse;

  return {
    text: response.response,
    analysis: {
      subjects: Array.isArray(response.analysis.subject)
        ? response.analysis.subject
        : [response.analysis.subject],
      summaryUpdate: response.analysis.summaryUpdate
    }
  };
}

// Example parsed result:
// {
//   text: "For college savings, financial advisors often recommend...",
//   analysis: {
//     subjects: [
//       {
//         name: "college-savings",
//         description: "Discussion of saving strategies...",
//         isNew: "true",
//         keyword: [
//           { term: "529-plan", confidence: "0.95" },
//           { term: "tax-advantages", confidence: "0.85" }
//         ]
//       }
//     ],
//     summaryUpdate: "User asked about college savings amounts..."
//   }
// }
```

---

## 5. Store XML Attachment

### Save to BLOB or Inline

```typescript
// main/services/attachment-service.ts
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { createBlob } from '@refinio/one.core/lib/storage-blob.js';

async function storeXMLAttachment(
  topicId: string,
  messageId: string,
  xmlString: string,
  format: 'llm-query' | 'llm-response'
) {
  const size = Buffer.byteLength(xmlString, 'utf8');

  if (size <= 1024) {
    // Inline storage for small XML
    return await storeVersionedObject({
      $type$: 'XMLMessageAttachment',
      topicId,
      messageId,
      xmlContent: xmlString,
      format,
      version: 1,
      createdAt: Date.now(),
      size
    });
  } else {
    // BLOB storage for large XML
    const blobHash = await createBlob(Buffer.from(xmlString, 'utf8'));
    return await storeVersionedObject({
      $type$: 'XMLMessageAttachment',
      topicId,
      messageId,
      xmlBlob: blobHash,
      format,
      version: 1,
      createdAt: Date.now(),
      size
    });
  }
}
```

---

## 6. Retrieve XML Attachment

### Load from Storage

```typescript
// main/services/attachment-service.ts
import { retrieveVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { retrieveBlob } from '@refinio/one.core/lib/storage-blob.js';

async function retrieveXMLAttachment(attachmentHash: SHA256IdHash) {
  const attachment = await retrieveVersionedObject(attachmentHash);

  if (attachment.xmlContent) {
    // Inline storage
    return attachment.xmlContent;
  } else if (attachment.xmlBlob) {
    // BLOB storage
    const blobData = await retrieveBlob(attachment.xmlBlob);
    return blobData.toString('utf8');
  } else {
    throw new Error('XMLMessageAttachment has no content');
  }
}
```

---

## 7. Complete Message Flow

### End-to-End Example

```typescript
// main/services/llm-manager.ts

async function chatWithAnalysis(topicId: string, message: string, contactId: string) {
  // 1. Get conversation context
  const subjects = await topicAnalysisModel.getSubjects(topicId);
  const keywords = await topicAnalysisModel.getKeywords(topicId);

  const context = {
    topicId,
    messageCount: await getMessageCount(topicId),
    activeSubjects: subjects.filter(s => !s.archived).map(s => s.id),
    recentKeywords: keywords.slice(0, 20).map(k => k.term)
  };

  // 2. Format query as XML
  const xmlQuery = await formatQueryAsXML(message, context);

  // 3. Store query as attachment (optional)
  const queryMessageId = generateMessageId();
  await attachmentService.storeXMLAttachment(
    topicId,
    queryMessageId,
    xmlQuery,
    'llm-query'
  );

  // 4. Get system prompt
  const systemPrompt = await getActiveSystemPrompt('gpt-4');

  // 5. Send to LLM
  const llmResponse = await sendToLLM(systemPrompt, xmlQuery);

  // 6. Parse response
  const parsed = await parseXMLResponse(llmResponse);

  // 7. Store response as attachment
  const responseMessageId = generateMessageId();
  const xmlAttachmentHash = await attachmentService.storeXMLAttachment(
    topicId,
    responseMessageId,
    llmResponse,
    'llm-response'
  );

  // 8. Background: Create keywords, subjects, summary
  setImmediate(async () => {
    for (const subject of parsed.analysis.subjects) {
      // Create subject
      const subjectObj = await topicAnalysisModel.createSubject(
        topicId,
        subject.keyword.map(k => k.term),
        subject.name,
        subject.description,
        0.8
      );

      // Link keywords to subject
      for (const kw of subject.keyword) {
        await topicAnalysisModel.addKeywordToSubject(
          topicId,
          kw.term,
          subjectObj.id
        );
      }
    }

    // Update summary
    if (parsed.analysis.summaryUpdate) {
      await topicAnalysisModel.updateSummary(
        topicId,
        parsed.analysis.summaryUpdate,
        0.8
      );
    }
  });

  // 9. Return to UI immediately
  return {
    text: parsed.text,
    xmlAttachmentId: xmlAttachmentHash,
    analysis: {
      subjects: parsed.analysis.subjects.map(s => ({
        name: s.name,
        keywords: s.keyword.map(k => k.term)
      })),
      keywords: parsed.analysis.subjects.flatMap(s =>
        s.keyword.map(k => k.term)
      ),
      summary: parsed.analysis.summaryUpdate
    }
  };
}
```

---

## 8. Verify Stored Data

### Check Keywords Linked to Subjects

```typescript
// main/core/one-ai/models/TopicAnalysisModel.ts

async function verifyKeywordSubjectLinks(topicId: string) {
  const keywords = await this.getKeywords(topicId);

  for (const keyword of keywords) {
    console.log('Keyword:', keyword.term);
    console.log('  Linked subjects:', keyword.subjects?.length || 0);
    console.log('  Source XML:', keyword.sourceXmlHash);

    // Retrieve source XML
    if (keyword.sourceXmlHash) {
      const xmlContent = await attachmentService.retrieveXMLAttachment(
        keyword.sourceXmlHash
      );
      console.log('  XML length:', xmlContent.length);
    }
  }
}
```

---

## 9. Error Handling

### Graceful Degradation

```typescript
// main/services/llm-manager.ts

async function chatWithAnalysis(topicId: string, message: string, contactId: string) {
  try {
    // Attempt XML flow
    const xmlResponse = await sendToLLM(systemPrompt, xmlQuery);
    const parsed = await parseXMLResponse(xmlResponse);
    return { text: parsed.text, analysis: parsed.analysis };

  } catch (error) {
    if (error.message.includes('Invalid XML')) {
      // XML parsing failed - FAIL FAST
      console.error('[LLM Manager] XML parse error:', error);
      throw new Error(`LLM returned malformed XML: ${error.message}`);
    }
    throw error;  // Re-throw other errors
  }
}
```

**NO FALLBACKS**: If XML parsing fails, operation fails. Fix the LLM prompt or model configuration.

---

## 10. Testing

### Integration Test Example

```typescript
// tests/integration/xml-workflow.test.ts

describe('XML LLM Communication Workflow', () => {
  it('should complete full message flow with XML', async () => {
    // 1. Setup
    const topicId = 'test-topic';
    const message = 'How much for college?';

    // 2. Send message
    const response = await llmManager.chatWithAnalysis(topicId, message, 'ai-1');

    // 3. Verify response
    expect(response.text).toBeTruthy();
    expect(response.xmlAttachmentId).toBeTruthy();
    expect(response.analysis.keywords.length).toBeGreaterThan(0);

    // 4. Wait for background processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // 5. Verify keywords created
    const keywords = await topicAnalysisModel.getKeywords(topicId);
    expect(keywords.length).toBeGreaterThan(0);

    // 6. Verify keywords linked to subjects
    const firstKeyword = keywords[0];
    expect(firstKeyword.subjects?.length).toBeGreaterThan(0);

    // 7. Verify sourceXmlHash set
    expect(firstKeyword.sourceXmlHash).toBe(response.xmlAttachmentId);
  });
});
```

---

## Common Issues

### Issue: Keywords have no subjects

**Symptom**: `keyword.subjects` array is empty

**Cause**: Using `createKeyword()` instead of `addKeywordToSubject()`

**Fix**: Always use `addKeywordToSubject()` to link keywords to subjects:
```typescript
await topicAnalysisModel.addKeywordToSubject(topicId, 'college', subjectId);
```

### Issue: XML parsing fails

**Symptom**: `Error: Invalid XML: missing <llmResponse> root`

**Cause**: LLM returned text instead of XML (model not following system prompt)

**Fix**:
1. Check system prompt template is active
2. Use higher-capability model (GPT-4, Claude 3)
3. Increase temperature to 0 (deterministic)

### Issue: BLOB storage fails

**Symptom**: `Error: Failed to create BLOB`

**Cause**: ONE.core not initialized or insufficient permissions

**Fix**: Ensure Node.js ONE.core is initialized before calling `storeXMLAttachment()`

---

## Performance Tips

1. **Cache System Prompts**: Load template once at startup, not per message
2. **Batch Keyword Creation**: Use `addKeywordToSubject()` in loop for all keywords
3. **Async Background**: Use `setImmediate()` for non-blocking analysis processing
4. **Monitor XML Size**: Log attachment sizes to catch unusually large responses

---

*Quickstart v1.0.0 - Demonstrates XML-based LLM communication with structured extraction*
