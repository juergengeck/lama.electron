/**
 * LLM Recipe for ONE.core - matching LAMA mobile app structure
 * This must match the recipe from /Users/gecko/src/lama/src/recipes/llm.ts
 */
export const LLMRecipe = {
    $type$: 'Recipe',
    name: 'LLM',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^LLM$/ }
        },
        {
            itemprop: 'name',
            itemtype: { type: 'string' },
            isId: true
        },
        {
            itemprop: 'filename',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'modelType',
            itemtype: {
                type: 'string',
                regexp: /^(local|remote)$/
            }
        },
        {
            itemprop: 'active',
            itemtype: { type: 'boolean' }
        },
        {
            itemprop: 'deleted',
            itemtype: { type: 'boolean' }
        },
        {
            itemprop: 'creator',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'created',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'modified',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'createdAt',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'lastUsed',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'lastInitialized',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'usageCount',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'size',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'personId',
            itemtype: {
                type: 'referenceToId',
                allowedTypes: new Set(['Person'])
            },
            optional: true
        },
        {
            itemprop: 'capabilities',
            itemtype: {
                type: 'array',
                item: {
                    type: 'string',
                    regexp: /^(chat|inference)$/
                }
            },
            optional: true
        },
        // Model parameters
        {
            itemprop: 'temperature',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'maxTokens',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'contextSize',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'batchSize',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'threads',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'mirostat',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'topK',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'topP',
            itemtype: { type: 'number' },
            optional: true
        },
        // Optional properties
        {
            itemprop: 'architecture',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'contextLength',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'quantization',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'checksum',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'provider',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'downloadUrl',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};
