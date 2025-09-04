import { Model } from '@refinio/one.models/lib/models/Model.js';
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
    constructor() {
        super();
        Object.defineProperty(this, "blacklistGroup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "everyoneGroup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "disconnectListeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.disconnectListeners = [];
    }
    /**
     * Initialize the blacklist with the required groups
     */
    init(blacklistGroup, everyoneGroup) {
        this.blacklistGroup = blacklistGroup;
        this.everyoneGroup = everyoneGroup;
        // Listen for changes to the blacklist group
        this.disconnectListeners.push(this.blacklistGroup.onUpdated(async (added, removed) => {
            if (this.everyoneGroup === undefined) {
                throw Error('BlacklistModel not initialized');
            }
            // Remove added blacklist persons from everyone group
            if (added) {
                this.everyoneGroup.persons = this.everyoneGroup.persons.filter(personId => !added.includes(personId));
            }
            // Add removed blacklist persons back to everyone group
            if (removed) {
                this.everyoneGroup.persons.push(...removed);
            }
            if (added || removed) {
                await this.everyoneGroup.saveAndLoad();
            }
        }));
    }
    /**
     * Get the blacklist group model (required for ConnectionsModel.init)
     */
    get blacklistGroupModel() {
        if (this.blacklistGroup === undefined) {
            throw Error('BlacklistModel not initialized - must call init() first');
        }
        return this.blacklistGroup;
    }
    /**
     * Shutdown and cleanup
     */
    async shutdown() {
        for (const disconnectListener of this.disconnectListeners) {
            disconnectListener();
        }
        this.disconnectListeners = [];
    }
}
