/**
 * Recipe registration for LAMA Electron Browser
 * These recipes match the Node.js recipes to ensure compatibility
 */
import { LLMRecipe } from './llm.js';
import { LLMSettingsRecipe } from './LLMSettingsRecipe.js';
import { GlobalLLMSettingsRecipe } from './GlobalLLMSettingsRecipe.js';

// Export as array for SingleUserNoAuth
export const LamaRecipes = [
    LLMRecipe,
    LLMSettingsRecipe,
    GlobalLLMSettingsRecipe
];

// Export individual recipes for direct import
export { LLMRecipe } from './llm.js';
export { LLMSettingsRecipe } from './LLMSettingsRecipe.js';
export { GlobalLLMSettingsRecipe } from './GlobalLLMSettingsRecipe.js';
