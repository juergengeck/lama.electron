#!/usr/bin/env node

// Test recipe loading without running full app

import('@refinio/one.core/lib/system/load-nodejs.js').then(async () => {
  const { CORE_RECIPES } = await import('@refinio/one.core/lib/recipes.js')
  const ModelsRecipesStableModule = await import('@refinio/one.models/lib/recipes/recipes-stable.js')
  const ModelsRecipesExperimentalModule = await import('@refinio/one.models/lib/recipes/recipes-experimental.js')
  const { LamaRecipes } = await import('./main/recipes/index.js')
  
  const ModelsRecipesStable = ModelsRecipesStableModule.default
  const ModelsRecipesExperimental = ModelsRecipesExperimentalModule.default
  
  const allRecipes = [
    ...(CORE_RECIPES || []),
    ...(ModelsRecipesStable || []),
    ...(ModelsRecipesExperimental || []),
    ...(LamaRecipes || [])
  ].filter(r => r && typeof r === 'object' && r.name)
  
  console.log('Total recipes:', allRecipes.length)
  
  const llmRecipes = allRecipes.filter(r => r.name === 'LLM')
  console.log('Found', llmRecipes.length, 'LLM recipe(s)')
  
  if (llmRecipes.length > 0) {
    llmRecipes.forEach((recipe, index) => {
      const idField = recipe.rule?.find(r => r.isId === true)
      console.log(`LLM Recipe #${index + 1} ID field:`, idField?.itemprop || 'NO ID FIELD')
      console.log(`LLM Recipe #${index + 1} first 3 fields:`)
      recipe.rule?.slice(0, 3).forEach(r => {
        console.log(`  - ${r.itemprop}${r.isId ? ' (ID)' : ''}`)
      })
    })
  }
  
  // Check recipes from each source
  console.log('\nRecipes from LAMA:', LamaRecipes?.map(r => r.name).join(', '))
  
  // Check if there's an LLM recipe in models
  const modelsLLM = [...(ModelsRecipesStable || []), ...(ModelsRecipesExperimental || [])].find(r => r.name === 'LLM')
  if (modelsLLM) {
    console.log('\nFound LLM recipe in one.models!')
    const idField = modelsLLM.rule?.find(r => r.isId === true)
    console.log('Models LLM ID field:', idField?.itemprop)
  }
  
  process.exit(0)
})