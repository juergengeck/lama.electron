/**
 * LAMA Recipes
 * Defines ONE.core object types for LAMA-specific features
 */

import { addRecipeToRuntime } from '@refinio/one.core/lib/object-recipes.js'
import { WordCloudSettingsRecipe } from '../core/one-ai/recipes/WordCloudSettingsRecipe.js'
import { KeywordRecipe } from '../core/one-ai/recipes/KeywordRecipe.js'
import { SubjectRecipe } from '../core/one-ai/recipes/SubjectRecipe.js'
import { SummaryRecipe } from '../core/one-ai/recipes/SummaryRecipe.js'
import { KeywordAccessStateRecipe } from '../core/one-ai/recipes/KeywordAccessState.js'
import { ProposalConfigRecipe } from './proposal-recipes.js'
import { MCPRecipes } from './mcp-recipes.js'
import { AvatarPreferenceRecipe } from './avatar-recipes.js'
// import { FeedForwardRecipes } from './feed-forward-recipes.js'

// LLM Recipe - represents an AI model/assistant
import { LLMRecipe } from './LLM.js'

const LLMSettingsRecipe = {
    $type$: 'Recipe' as const,
    name: 'LLMSettings',
    rule: [
        {
            itemprop: 'selectedLLMId',
            itemtype: {
                type: 'string'
            },
            optional: true
        },
        {
            itemprop: 'enabledLLMs',
            itemtype: {
                type: 'bag',
                item: { type: 'string' }
            },
            optional: true
        },
        {
            itemprop: 'disabledLLMs',
            itemtype: {
                type: 'bag',
                item: { type: 'string' }
            },
            optional: true
        }
    ]
}

const GlobalLLMSettingsRecipe = {
    $type$: 'Recipe' as const,
    name: 'GlobalLLMSettings',
    rule: [
        {
            itemprop: 'name',
            itemtype: {
                type: 'string'
            },
            isId: true
        },
        {
            itemprop: 'defaultProvider',
            itemtype: {
                type: 'string'
            },
            optional: true
        },
        {
            itemprop: 'autoSelectBestModel',
            itemtype: {
                type: 'boolean'
            },
            optional: true
        },
        {
            itemprop: 'preferredModelIds',
            itemtype: {
                type: 'array',
                item: { type: 'string' }
            },
            optional: true
        },
        {
            itemprop: 'defaultModelId',
            itemtype: {
                type: 'string'
            },
            optional: true
        },
        {
            itemprop: 'temperature',
            itemtype: {
                type: 'number'
            },
            optional: true
        },
        {
            itemprop: 'maxTokens',
            itemtype: {
                type: 'integer'
            },
            optional: true
        },
        {
            itemprop: 'systemPrompt',
            itemtype: {
                type: 'string'
            },
            optional: true
        },
        {
            itemprop: 'streamResponses',
            itemtype: {
                type: 'boolean'
            },
            optional: true
        },
        {
            itemprop: 'autoSummarize',
            itemtype: {
                type: 'boolean'
            },
            optional: true
        },
        {
            itemprop: 'enableMCP',
            itemtype: {
                type: 'boolean'
            },
            optional: true
        },
        {
            itemprop: 'maxConcurrentRequests',
            itemtype: {
                type: 'integer'
            },
            optional: true
        }
    ]
}

// Export recipes for use in initInstance
// Note: Group recipe is already in CORE_RECIPES, don't duplicate it
const LamaRecipes = [
    LLMRecipe,
    LLMSettingsRecipe,
    GlobalLLMSettingsRecipe,
    WordCloudSettingsRecipe,
    SubjectRecipe,
    KeywordRecipe,
    SummaryRecipe,
    KeywordAccessStateRecipe,
    ProposalConfigRecipe,
    AvatarPreferenceRecipe,
    ...MCPRecipes
    // ...FeedForwardRecipes
]

export { LamaRecipes }