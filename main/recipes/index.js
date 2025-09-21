/**
 * Recipe registration for Node.js ONE.core instance
 * Recipes must be added to initialRecipes during initInstance
 */

// No need to import hasRecipe - just define the recipes

// Import LAMA recipes from LAMA mobile app structure
import { LLMRecipe } from './LLM.js'
import { WordCloudSettingsRecipe } from '../core/one-ai/recipes/WordCloudSettingsRecipe.js'
import TopicAnalysisRecipes from '../core/one-ai/recipes/ai-recipes.js'

const LLMSettingsRecipe = {
    $type$: 'Recipe',
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
                type: 'array',
                item: {
                    type: 'string'
                }
            },
            optional: true
        },
        {
            itemprop: 'defaultSystemPrompt',
            itemtype: {
                type: 'string'
            },
            optional: true
        }
    ]
}

const GlobalLLMSettingsRecipe = {
    $type$: 'Recipe',
    name: 'GlobalLLMSettings',
    rule: [
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
    ...TopicAnalysisRecipes
]

export { LamaRecipes }