/**
 * XMLMessageAttachment Recipe
 * Stores XML-formatted LLM messages as BLOB or inline
 */
export const XMLMessageAttachmentRecipe = {
    $type$: 'Recipe',
    name: 'XMLMessageAttachment',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^XMLMessageAttachment$/ }
        },
        {
            itemprop: 'topicId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'messageId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'xmlContent',
            itemtype: { type: 'string' },
            optional: true // Inline XML if ≤1KB
        },
        {
            itemprop: 'xmlBlob',
            itemtype: { type: 'referenceToBlob' },
            optional: true // BLOB hash if >1KB
        },
        {
            itemprop: 'format',
            itemtype: { type: 'string' } // 'llm-query' | 'llm-response'
        },
        {
            itemprop: 'version',
            itemtype: { type: 'integer' } // Schema version (1)
        },
        {
            itemprop: 'createdAt',
            itemtype: { type: 'integer' } // Unix timestamp
        },
        {
            itemprop: 'size',
            itemtype: { type: 'integer' } // Byte size
        }
    ]
};

export default XMLMessageAttachmentRecipe;
