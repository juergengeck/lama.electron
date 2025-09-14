/**
 * Pending Contact Recipe
 * 
 * ONE object for storing pending contact requests
 * that haven't been accepted or rejected yet
 */

import { Recipe } from '@refinio/one.core/lib/recipes.js'

/**
 * PendingContact object in the ONE architecture.
 * 
 * This is a versioned ONE object for storing pending contact requests.
 * The owner field serves as the isID field (who received this request).
 */
export const PendingContactRecipe = {
  $type$: 'Recipe',
  name: 'PendingContact',
  rule: [
    // Identity fields (used for idHash calculation)
    { 
      itemprop: 'owner', 
      isId: true, 
      itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) } 
    },
    { 
      itemprop: 'fromPersonId', 
      isId: true, 
      itemtype: { type: 'string' } 
    },
    
    // Credential data
    { 
      itemprop: 'credential', 
      itemtype: { type: 'object' }  // The full VC object
    },
    
    // Connection info
    { 
      itemprop: 'peerId', 
      itemtype: { type: 'string' } 
    },
    { 
      itemprop: 'connectionInfo', 
      itemtype: { type: 'object' }, 
      optional: true 
    },
    
    // Status tracking
    { 
      itemprop: 'status', 
      itemtype: { 
        type: 'string',
        enum: ['pending', 'accepted', 'rejected', 'expired']
      } 
    },
    { 
      itemprop: 'receivedAt', 
      itemtype: { type: 'number' } 
    },
    { 
      itemprop: 'processedAt', 
      itemtype: { type: 'number' }, 
      optional: true 
    },
    { 
      itemprop: 'rejectionReason', 
      itemtype: { type: 'string' }, 
      optional: true 
    },
    
    // Display info (denormalized for quick access)
    { 
      itemprop: 'displayName', 
      itemtype: { type: 'string' } 
    },
    { 
      itemprop: 'instanceName', 
      itemtype: { type: 'string' }, 
      optional: true 
    },
    { 
      itemprop: 'capabilities', 
      itemtype: { type: 'array', item: { type: 'string' } } 
    }
  ]
}

/**
 * PendingContactList object for tracking all pending contacts
 */
export const PendingContactListRecipe = {
  $type$: 'Recipe',
  name: 'PendingContactList',
  rule: [
    { 
      itemprop: 'owner', 
      isId: true, 
      itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) } 
    },
    { 
      itemprop: 'pendingContacts', 
      itemtype: { 
        type: 'array', 
        item: { type: 'referenceToId', allowedTypes: new Set(['PendingContact']) } 
      } 
    },
    { 
      itemprop: 'lastUpdated', 
      itemtype: { type: 'number' } 
    }
  ]
}

// TypeScript interfaces
export interface PendingContact {
  $type$: 'PendingContact'
  owner: string // SHA256IdHash<Person> - who received this request
  fromPersonId: string // The person ID from the credential
  credential: any // The full VC object
  peerId: string
  connectionInfo?: any
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  receivedAt: number
  processedAt?: number
  rejectionReason?: string
  displayName: string
  instanceName?: string
  capabilities: string[]
}

export interface PendingContactList {
  $type$: 'PendingContactList'
  owner: string // SHA256IdHash<Person>
  pendingContacts: string[] // SHA256IdHash<PendingContact>[]
  lastUpdated: number
}