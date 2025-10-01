/**
 * ONE.core Recipe for Subject objects
 *
 * Subject represents a distinct discussion topic within a conversation
 * Identified by topic + keyword combination
 */
export const SubjectRecipe = {
    $type$: 'Recipe',
    name: 'Subject',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^Subject$/ }
        },
        {
            itemprop: 'id',
            itemtype: { type: 'string' },
            isId: true // This makes Subject a versioned object
        },
        {
            itemprop: 'topic',
            itemtype: { type: 'string' } // Hash reference to parent Topic
        },
        {
            itemprop: 'keywords',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            }
        },
        {
            itemprop: 'messageCount',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'timestamp',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'archived',
            itemtype: { type: 'boolean' },
            optional: true
        },
        {
            itemprop: '$versionHash$',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};