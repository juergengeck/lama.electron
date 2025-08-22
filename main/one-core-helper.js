/**
 * ONE.CORE Initialization Helper
 * Based on one.leute.replicant/src/misc/OneCoreInit.ts
 */

const { initInstance, closeInstance } = require('@refinio/one.core/lib/instance.js')
const { SettingsStore } = require('@refinio/one.core/lib/system/settings-store.js')
const { setBaseDirOrName } = require('@refinio/one.core/lib/system/storage-base.js')
const { isString } = require('@refinio/one.core/lib/util/type-checks-basic.js')
const { createRandomString } = require('@refinio/one.core/lib/system/crypto-helpers.js')

const RecipesStable = require('@refinio/one.models/lib/recipes/recipes-stable.js').default
const RecipesExperimental = require('@refinio/one.models/lib/recipes/recipes-experimental.js').default
const {
  ReverseMapsStable,
  ReverseMapsForIdObjectsStable
} = require('@refinio/one.models/lib/recipes/reversemaps-stable.js')
const {
  ReverseMapsExperimental,
  ReverseMapsForIdObjectsExperimental
} = require('@refinio/one.models/lib/recipes/reversemaps-experimental.js')

/**
 * Initialize ONE.CORE instance
 */
async function initOneCoreInstance(secret, directory) {
  setBaseDirOrName(directory)
  
  const storedInstanceName = await SettingsStore.getItem('instance')
  const storedEmail = await SettingsStore.getItem('email')
  
  let instanceOptions
  
  if (isString(storedInstanceName) && isString(storedEmail)) {
    // Use existing instance
    instanceOptions = {
      name: storedInstanceName,
      email: storedEmail,
      secret
    }
  } else {
    // Create new instance with random credentials
    instanceOptions = {
      name: `lama-node-${await createRandomString(16)}`,
      email: `node@lama-${await createRandomString(16)}.local`,
      secret
    }
  }
  
  try {
    await initInstance({
      ...instanceOptions,
      directory: directory,
      initialRecipes: [...RecipesStable, ...RecipesExperimental],
      initiallyEnabledReverseMapTypes: new Map([
        ...ReverseMapsStable,
        ...ReverseMapsExperimental
      ]),
      initiallyEnabledReverseMapTypesForIdObjects: new Map([
        ...ReverseMapsForIdObjectsStable,
        ...ReverseMapsForIdObjectsExperimental
      ])
    })
    
    // Store credentials if new
    if (!isString(storedInstanceName) || !isString(storedEmail)) {
      await SettingsStore.setItem('instance', instanceOptions.name)
      await SettingsStore.setItem('email', instanceOptions.email)
    }
    
    console.log('[OneCoreHelper] Instance initialized:', instanceOptions.name)
  } catch (e) {
    if (e.code === 'CYENC-SYMDEC') {
      console.error('[OneCoreHelper] Invalid password')
      throw new Error('Invalid password')
    } else {
      throw e
    }
  }
}

/**
 * Shutdown ONE.CORE instance
 */
function shutdownOneCoreInstance() {
  closeInstance()
  console.log('[OneCoreHelper] Instance closed')
}

/**
 * Check if instance exists
 */
async function oneCoreInstanceExists(directory) {
  setBaseDirOrName(directory)
  
  const storedInstanceName = await SettingsStore.getItem('instance')
  const storedEmail = await SettingsStore.getItem('email')
  
  return isString(storedInstanceName) && isString(storedEmail)
}

module.exports = {
  initOneCoreInstance,
  shutdownOneCoreInstance,
  oneCoreInstanceExists
}