/**
 * System Prompt Manager
 * Manages SystemPromptTemplate objects for LLM models
 */

const DEFAULT_XML_SYSTEM_PROMPT = `You are an AI assistant. Always respond using this XML format:

<llmResponse>
  <response>[Your natural language response here]</response>
  <analysis>
    <subject name="topic-name" description="brief explanation" isNew="true|false">
      <keyword term="keyword-term" confidence="0.8" />
    </subject>
    <summaryUpdate>[Brief 2-3 sentence summary of this exchange]</summaryUpdate>
  </analysis>
</llmResponse>

Rules:
- Extract 1-3 subjects (main themes)
- Mark isNew="true" for new subjects, isNew="false" for continuing existing subjects
- Include 3-7 keywords per subject with confidence 0.6-1.0
- Provide incremental summary (focus on new information)
- Use lowercase, hyphenated names (e.g., "college-savings")`;

export async function createSystemPrompt(
  modelId: string,
  promptText: string = DEFAULT_XML_SYSTEM_PROMPT
): Promise<any> {
  // Load Node.js platform first
  await import('@refinio/one.core/lib/system/load-nodejs.js');

  // Import ONE.core functions
  const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');

  const template = {
    $type$: 'SystemPromptTemplate' as const,
    modelId,
    promptText,
    xmlSchemaVersion: 1,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true
  };

  const result = await storeVersionedObject(template);
  return result.hash;
}

export async function getActiveSystemPrompt(modelId: string): Promise<string> {
  try {
    // Load Node.js platform first
    await import('@refinio/one.core/lib/system/load-nodejs.js');

    // Import ONE.core functions
    const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');
    const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');

    // Calculate ID hash for this modelId
    const idHash = await calculateIdHashOfObj({
      $type$: 'SystemPromptTemplate' as const,
      modelId
    });

    const template = await getObjectByIdHash(idHash);
    if (template && template.obj.active) {
      return template.obj.promptText;
    }

    // Return default if no active template
    return DEFAULT_XML_SYSTEM_PROMPT;
  } catch (error) {
    console.warn('[SystemPromptManager] Error retrieving prompt, using default:', error);
    return DEFAULT_XML_SYSTEM_PROMPT;
  }
}

export async function updateSystemPrompt(
  modelId: string,
  promptText: string
): Promise<any> {
  // Load Node.js platform first
  await import('@refinio/one.core/lib/system/load-nodejs.js');

  // Import ONE.core functions
  const { storeVersionedObject, getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
  const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');

  // Try to get existing template
  let oldVersion = 0;
  try {
    const idHash = await calculateIdHashOfObj({
      $type$: 'SystemPromptTemplate' as const,
      modelId
    });
    const existing = await getObjectByIdHash(idHash);
    if (existing) {
      oldVersion = existing.obj.version;
    }
  } catch (err) {
    // No existing template, start at version 1
  }

  // Create new version
  const template = {
    $type$: 'SystemPromptTemplate' as const,
    modelId,
    promptText,
    xmlSchemaVersion: 1,
    version: oldVersion + 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true
  };

  const result = await storeVersionedObject(template);
  return result.hash;
}

export default {
  createSystemPrompt,
  getActiveSystemPrompt,
  updateSystemPrompt,
  DEFAULT_XML_SYSTEM_PROMPT
};
