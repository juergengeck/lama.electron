/**
 * Direct Access Rights Granting
 * Simply grants access to key objects for sync
 */

async function grantAccessRights(nodeOneCore, targetPersonId) {
  console.log('[GrantAccess] Granting access rights to:', targetPersonId?.substring(0, 8) + '...')
  
  const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
  const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
  const { calculateIdHashOfObj } = await import('../../node_modules/@refinio/one.core/lib/util/object.js')
  
  // 1. Grant access to the Leute object itself
  try {
    const leuteId = await calculateIdHashOfObj({
      $type$: 'Leute',
      appId: 'one.leute'
    })
    
    await createAccess([{
      id: leuteId,
      person: [targetPersonId],
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }])
    
    console.log('[GrantAccess] ✅ Granted access to Leute object')
  } catch (error) {
    console.warn('[GrantAccess] Failed to grant Leute access:', error.message)
  }
  
  // 2. Grant access to all Someone objects (contacts)
  if (nodeOneCore.leuteModel) {
    try {
      const others = await nodeOneCore.leuteModel.others()
      console.log(`[GrantAccess] Granting access to ${others.length} Someone objects...`)
      
      for (const someone of others) {
        await createAccess([{
          id: someone.idHash,
          person: [targetPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }])
      }
      
      console.log('[GrantAccess] ✅ Granted access to Someone objects')
    } catch (error) {
      console.warn('[GrantAccess] Failed to grant Someone access:', error.message)
    }
  }
  
  // 3. Grant access to all channels
  if (nodeOneCore.channelManager) {
    try {
      const channels = await nodeOneCore.channelManager.getAllChannelInfos()
      console.log(`[GrantAccess] Granting access to ${channels.length} channels...`)
      
      for (const channel of channels) {
        const channelId = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: channel.id,
          owner: channel.owner || nodeOneCore.ownerId
        })
        
        await createAccess([{
          id: channelId,
          person: [targetPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }])
      }
      
      console.log('[GrantAccess] ✅ Granted access to channels')
    } catch (error) {
      console.warn('[GrantAccess] Failed to grant channel access:', error.message)
    }
  }
  
  // 4. Grant access to our MAIN profile only (not all profiles!)
  if (nodeOneCore.leuteModel) {
    try {
      const me = await nodeOneCore.leuteModel.me()
      const mainProfile = await me.mainProfile()

      if (mainProfile && mainProfile.idHash) {
        await createAccess([{
          id: mainProfile.idHash,
          person: [targetPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }])
        console.log('[GrantAccess] ✅ Granted access to main Profile object')
      }
    } catch (error) {
      console.warn('[GrantAccess] Failed to grant Profile access:', error.message)
    }
  }
  
  console.log('[GrantAccess] ✅ Access rights granted')
}

export default { grantAccessRights }