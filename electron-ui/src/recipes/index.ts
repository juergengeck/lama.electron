/**
 * Recipe registration for LAMA Electron
 * 
 * Recipes are registered in BOTH:
 * 1. Main Node.js process (electron/main.ts) - for LAMA app's ONE instance
 * 2. Renderer process (here) - for Electron UI's ONE instance
 * Each instance has different needs and manages its own recipes.
 */

import { addRecipeToRuntime, hasRecipe } from '@refinio/one.core/lib/object-recipes'
import { LLMRecipe } from './llm'
import { LLMSettingsRecipe } from './LLMSettingsRecipe'
import { GlobalLLMSettingsRecipe } from './GlobalLLMSettingsRecipe'

/**
 * Register all recipes with the ONE platform
 * This should be called during app initialization in the renderer process
 */
export async function registerLamaRecipes(): Promise<void> {
    console.log('[Recipes] Registering LAMA recipes in renderer process...')
    
    const recipes = [
        LLMRecipe,
        LLMSettingsRecipe,
        GlobalLLMSettingsRecipe
    ]
    
    let registeredCount = 0
    let alreadyExistsCount = 0
    
    for (const recipe of recipes) {
        try {
            if (hasRecipe(recipe.name)) {
                console.log(`[Recipes] Recipe already exists: ${recipe.name}`)
                alreadyExistsCount++
            } else {
                addRecipeToRuntime(recipe)
                console.log(`[Recipes] Registered recipe: ${recipe.name}`)
                registeredCount++
            }
        } catch (error: any) {
            if (error?.message?.includes('already exists')) {
                console.log(`[Recipes] Recipe already registered: ${recipe.name}`)
                alreadyExistsCount++
            } else {
                console.error(`[Recipes] Failed to register recipe ${recipe.name}:`, error)
            }
        }
    }
    
    console.log(`[Recipes] Registration complete: ${registeredCount} new, ${alreadyExistsCount} already existed`)
}

// Export individual recipes for direct import
export { LLMRecipe } from './llm'
export { LLMSettingsRecipe } from './LLMSettingsRecipe'
export { GlobalLLMSettingsRecipe } from './GlobalLLMSettingsRecipe'

// Export types from @OneObjectInterfaces
export type { LLM, LLMSettings, GlobalLLMSettings } from '../types/@OneObjectInterfaces'