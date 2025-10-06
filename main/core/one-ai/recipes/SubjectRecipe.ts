/**
 * ONE.core Recipe for Subject objects
 *
 * Subject represents a distinct discussion topic within a conversation
 * Identified by topic + keyword combination
 *
 * Tracks temporal spans when the subject was discussed via timeRanges array
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
            itemprop: 'timeRanges',
            itemtype: {
                type: 'array',
                item: {
                    type: 'object',
                    rules: [
                        {
                            itemprop: 'start',
                            itemtype: { type: 'integer' }
                        },
                        {
                            itemprop: 'end',
                            itemtype: { type: 'integer' }
                        }
                    ]
                }
            }
        },
        {
            itemprop: 'messageCount',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'createdAt',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'lastSeenAt',
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