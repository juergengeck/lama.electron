/**
 * Feed-Forward Training Infrastructure Recipes for ONE.core
 * Defines object types for Supply/Demand knowledge sharing, trust scoring, and capability assemblies
 */

const SupplyRecipe = {
    $type$: 'Recipe' as const,
    name: 'Supply',
    rule: [
        {
            itemprop: 'id',
            itemtype: { type: 'string' },
            isId: true
        },
        {
            itemprop: 'keywords',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            }
        },
        {
            itemprop: 'contextLevel',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'conversationId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'creatorId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'trustScore',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'created',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'metadata',
            itemtype: { type: 'object' },
            optional: true
        },
        {
            itemprop: 'isRecursive',
            itemtype: { type: 'boolean' }
        }
    ]
};

const DemandRecipe = {
    $type$: 'Recipe' as const,
    name: 'Demand',
    rule: [
        {
            itemprop: 'id',
            itemtype: { type: 'string' },
            isId: true
        },
        {
            itemprop: 'keywords',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            }
        },
        {
            itemprop: 'urgency',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'context',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'criteria',
            itemtype: { type: 'object' },
            optional: true
        },
        {
            itemprop: 'requesterId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'created',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'expires',
            itemtype: { type: 'integer' },
            optional: true
        },
        {
            itemprop: 'maxResults',
            itemtype: { type: 'integer' },
            optional: true
        }
    ]
};

const SupplyDemandMatchRecipe = {
    $type$: 'Recipe' as const,
    name: 'SupplyDemandMatch',
    rule: [
        {
            itemprop: 'demandHash',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'supplyHash',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'matchScore',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'matchedKeywords',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            }
        },
        {
            itemprop: 'trustWeight',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'created',
            itemtype: { type: 'integer' }
        }
    ]
};

const TrustScoreRecipe = {
    $type$: 'Recipe' as const,
    name: 'TrustScore',
    rule: [
        {
            itemprop: 'participantId',
            itemtype: { type: 'string' },
            isId: true
        },
        {
            itemprop: 'score',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'components',
            itemtype: { type: 'object' }
        },
        {
            itemprop: 'history',
            itemtype: {
                type: 'array',
                item: { type: 'object' }
            }
        },
        {
            itemprop: 'lastUpdated',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'endorsers',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            },
            optional: true
        }
    ]
};

const TrainingCorpusEntryRecipe = {
    $type$: 'Recipe' as const,
    name: 'TrainingCorpusEntry',
    rule: [
        {
            itemprop: 'conversationId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'messages',
            itemtype: {
                type: 'array',
                item: { type: 'object' }
            }
        },
        {
            itemprop: 'keywords',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            }
        },
        {
            itemprop: 'participants',
            itemtype: {
                type: 'array',
                item: { type: 'object' }
            }
        },
        {
            itemprop: 'qualityScore',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'created',
            itemtype: { type: 'integer' }
        },
        {
            itemprop: 'consumerAccess',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            },
            optional: true
        }
    ]
};

const AssemblyRecipe = {
    $type$: 'Recipe' as const,
    name: 'Assembly',
    rule: [
        {
            // What capability is offered - THIS IS THE ID
            itemprop: 'supply',
            itemtype: {
                type: 'referenceToId',
                allowedTypes: new Set(['Supply'])
            },
            isId: true
        },
        {
            // SPECIFIC VERSION of the instance (version hash, not ID hash)
            itemprop: 'instance',
            itemtype: {
                type: 'referenceToObj',
                allowedTypes: new Set(['Instance'])
            }
        },
        {
            // What constraints must be satisfied
            itemprop: 'demand',
            itemtype: {
                type: 'referenceToId',
                allowedTypes: new Set(['Demand'])
            }
        },
        {
            itemprop: 'created',
            itemtype: { type: 'integer' }
        }
    ]
};

const FeedForwardRecipes = [
    SupplyRecipe,
    DemandRecipe,
    SupplyDemandMatchRecipe,
    TrustScoreRecipe,
    TrainingCorpusEntryRecipe,
    AssemblyRecipe
];

export { FeedForwardRecipes };