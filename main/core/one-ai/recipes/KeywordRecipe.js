/**
 * ONE.core Recipe for Keyword objects
 *
 * Keyword extracted from message content with frequency and relationships
 */
export const KeywordRecipe = {
    $type$: 'Recipe',
    name: 'Keyword',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^Keyword$/ }
        },
        {
            itemprop: 'id',
            itemtype: { type: 'string' },
            isId: true // This makes Keyword a versioned object
        },
        {
            itemprop: 'text',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'frequency',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'subjects',
            itemtype: {
                type: 'array',
                item: { type: 'string' } // Subject IDs this keyword belongs to
            }
        },
        {
            itemprop: 'score',
            itemtype: { type: 'number' },
            optional: true
        },
        {
            itemprop: 'createdAt',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'lastSeen',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: '$versionHash$',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};