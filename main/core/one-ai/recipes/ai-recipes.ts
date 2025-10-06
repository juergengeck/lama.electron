/**
 * Topic Analysis Recipes for ONE.core
 * Following one.leute patterns for proper object structure
 */

const SubjectRecipe = {
    $type$: 'Recipe',
    name: 'Subject',
    rule: [
        {
            itemprop: 'topicId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'keywords',
            itemtype: { type: 'array', item: { type: 'string' } }
        },
        {
            itemprop: 'keywordCombination',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'description',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'confidence',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'messageCount',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'firstSeen',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'lastSeen',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'archived',
            itemtype: { type: 'boolean' }
        }
    ]
};

const KeywordRecipe = {
    $type$: 'Recipe',
    name: 'Keyword',
    rule: [
        {
            itemprop: 'topicId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'term',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'category',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'frequency',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'score',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'extractedAt',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'lastSeen',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'subjects',
            itemtype: {
                type: 'array',
                item: {
                    type: 'referenceToObj',
                    allowedTypes: new Set(['Subject'])
                }
            }
        }
    ]
};

const SummaryRecipe = {
    $type$: 'Recipe',
    name: 'Summary',
    rule: [
        {
            itemprop: 'topicId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'version',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'content',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'generatedAt',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'changeReason',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'previousVersion',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'subjects',
            itemtype: {
                type: 'array',
                item: {
                    type: 'referenceToObj',
                    allowedTypes: new Set(['Subject'])
                }
            }
        }
    ]
};

import { KeywordAccessStateRecipe } from './KeywordAccessState.js';
import { XMLMessageAttachmentRecipe } from './xml-message-attachment.js';
import { SystemPromptTemplateRecipe } from './system-prompt-template.js';

const TopicAnalysisRecipes = [
    SubjectRecipe,
    KeywordRecipe,
    SummaryRecipe,
    KeywordAccessStateRecipe,
    XMLMessageAttachmentRecipe,
    SystemPromptTemplateRecipe
];

export default TopicAnalysisRecipes;
export { KeywordAccessStateRecipe, XMLMessageAttachmentRecipe, SystemPromptTemplateRecipe };