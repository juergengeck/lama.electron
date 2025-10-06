/**
 * SystemPromptTemplate Recipe
 * Per-model system prompts with XML format instructions
 */
export const SystemPromptTemplateRecipe = {
    $type$: 'Recipe',
    name: 'SystemPromptTemplate',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^SystemPromptTemplate$/ }
        },
        {
            itemprop: 'modelId',
            itemtype: { type: 'string' },
            isId: true // modelId IS the ID - one template per model
        },
        {
            itemprop: 'promptText',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'xmlSchemaVersion',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'version',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'active',
            itemtype: { type: 'boolean' }
        },
        {
            itemprop: 'createdAt',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'updatedAt',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: '$versionHash$',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};

export default SystemPromptTemplateRecipe;
