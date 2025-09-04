import type { Person } from '@refinio/one.core/lib/recipes'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks'
import type GroupModel from '@refinio/one.models/lib/models/Leute/GroupModel'
import { Model } from '@refinio/one.models/lib/models/Model.js'

/**
 * BlacklistModel - Manages blacklisted contacts
 * 
 * This model maintains a blacklist group and ensures that blacklisted
 * persons are removed from the everyone group. It's required for proper
 * ConnectionsModel initialization.
 * 
 * Based on one.leute implementation pattern.
 */
export default class BlacklistModel extends Model {
  private blacklistGroup: GroupModel | undefined
  private everyoneGroup: GroupModel | undefined
  private disconnectListeners: (() => void)[]

  constructor() {
    super()
    this.disconnectListeners = []
  }

  /**
   * Initialize the blacklist with the required groups
   */
  public init(blacklistGroup: GroupModel, everyoneGroup: GroupModel): void {
    this.blacklistGroup = blacklistGroup
    this.everyoneGroup = everyoneGroup

    // Listen for changes to the blacklist group
    this.disconnectListeners.push(
      this.blacklistGroup.onUpdated(
        async (added?: SHA256IdHash<Person>[], removed?: SHA256IdHash<Person>[]) => {
          if (this.everyoneGroup === undefined) {
            throw Error('BlacklistModel not initialized')
          }

          // Remove added blacklist persons from everyone group
          if (added) {
            this.everyoneGroup.persons = this.everyoneGroup.persons.filter(
              personId => !added.includes(personId)
            )
          }
          
          // Add removed blacklist persons back to everyone group
          if (removed) {
            this.everyoneGroup.persons.push(...removed)
          }
          
          if (added || removed) {
            await this.everyoneGroup.saveAndLoad()
          }
        }
      )
    )
  }

  /**
   * Get the blacklist group model (required for ConnectionsModel.init)
   */
  public get blacklistGroupModel(): GroupModel {
    if (this.blacklistGroup === undefined) {
      throw Error('BlacklistModel not initialized - must call init() first')
    }
    return this.blacklistGroup
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    for (const disconnectListener of this.disconnectListeners) {
      disconnectListener()
    }
    this.disconnectListeners = []
  }
}