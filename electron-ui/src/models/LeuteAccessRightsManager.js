/**
 * Access Rights Manager for LAMA Electron
 * Based on one.leute LeuteAccessRightsManager pattern
 */
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import { serializeWithType } from '@refinio/one.core/lib/util/promise.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { createAccess } from '@refinio/one.core/lib/access.js';
/**
 * Access Rights Manager for LAMA Electron
 * Handles proper access rights setup for channel sharing between instances
 */
export default class LeuteAccessRightsManager {
    constructor(channelManager, connectionsModel, leuteModel) {
        Object.defineProperty(this, "channelManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "leuteModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "connectionsModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "groupConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        this.channelManager = channelManager;
        this.leuteModel = leuteModel;
        this.connectionsModel = connectionsModel;
        // Set up automatic access rights for new channels
        this.channelManager.onUpdated((channelInfoIdHash, _channelId, _channelOwner, _timeOfEarliestChange, _data) => {
            // Grant access to federation group for all new channels
            createAccess([
                {
                    id: channelInfoIdHash,
                    person: [],
                    group: this.groups('federation', 'replicant', 'everyone'),
                    mode: SET_ACCESS_MODE.ADD
                }
            ]).catch(console.error);
        });
        // Grant access to main profile when identity changes
        this.leuteModel.afterMainIdSwitch(() => {
            this.giveAccessToMainProfileForEverybody().catch(console.error);
        });
    }
    /**
     * Initialize the access rights manager with group configuration
     */
    async init(groups) {
        if (groups) {
            this.groupConfig = groups;
        }
        console.log('[AccessRights] Initializing with groups:', Object.keys(this.groupConfig));
        await this.giveAccessToChannels();
        await this.giveAccessToMainProfileForEverybody();
        console.log('[AccessRights] ✅ Initialized successfully');
    }
    /**
     * Shutdown the access rights manager
     */
    async shutdown() {
        this.groupConfig = {};
    }
    /**
     * Get group IDs by name
     */
    groups(...groupNames) {
        const groups = [];
        for (const groupName of groupNames) {
            const groupConfigEntry = this.groupConfig[groupName];
            if (groupConfigEntry !== undefined) {
                groups.push(groupConfigEntry);
            }
        }
        return groups;
    }
    /**
     * Give access to main profile for everybody
     */
    async giveAccessToMainProfileForEverybody() {
        try {
            const me = await this.leuteModel.me();
            const mainProfile = me.mainProfileLazyLoad();
            await serializeWithType('Share', async () => {
                const setAccessParam = {
                    id: mainProfile.idHash,
                    person: [],
                    group: this.groups('everyone', 'federation', 'replicant'),
                    mode: SET_ACCESS_MODE.ADD
                };
                await createAccess([setAccessParam]);
            });
            console.log('[AccessRights] ✅ Granted access to main profile');
        }
        catch (error) {
            console.error('[AccessRights] Failed to grant access to main profile:', error);
        }
    }
    /**
     * Set up access rights for channels
     */
    async giveAccessToChannels() {
        try {
            const me = await this.leuteModel.me();
            const mainId = await me.mainIdentity();
            // Get all existing channels and grant access
            const channels = await this.channelManager.channels();
            console.log(`[AccessRights] Setting up access for ${channels.length} channels`);
            // Build access rights for all channels
            const channelAccessRights = [
                {
                    owner: mainId,
                    persons: [],
                    groups: this.groups('federation', 'replicant', 'everyone'),
                    channels: channels.map(ch => ch.id)
                }
            ];
            await this.applyAccessRights(channelAccessRights);
            console.log('[AccessRights] ✅ Channel access rights configured');
        }
        catch (error) {
            console.error('[AccessRights] Failed to setup channel access:', error);
        }
    }
    /**
     * Apply channel access rights
     */
    async applyAccessRights(channelAccessRights) {
        await serializeWithType('IdAccess', async () => {
            // Transform to single-channel access rights
            const accessRights = [];
            for (const accessRight of channelAccessRights) {
                const { channels, ...accessRightWithoutChannels } = accessRight;
                for (const channel of channels) {
                    accessRights.push({
                        ...accessRightWithoutChannels,
                        channel
                    });
                }
            }
            // Apply all access rights
            await Promise.all(accessRights.map(async (accessInfo) => {
                // Ensure channel exists
                await this.channelManager.createChannel(accessInfo.channel, accessInfo.owner);
                // Calculate channel info hash
                const channelIdHash = await calculateIdHashOfObj({
                    $type$: 'ChannelInfo',
                    id: accessInfo.channel,
                    owner: accessInfo.owner === null ? undefined : accessInfo.owner
                });
                // Grant access
                await createAccess([
                    {
                        id: channelIdHash,
                        person: accessInfo.persons,
                        group: accessInfo.groups,
                        mode: SET_ACCESS_MODE.ADD
                    }
                ]);
            }));
        });
    }
    /**
     * Grant access to a specific channel for federation
     */
    async grantChannelAccess(channelId, owner) {
        try {
            const channelIdHash = await calculateIdHashOfObj({
                $type$: 'ChannelInfo',
                id: channelId,
                owner: owner
            });
            await createAccess([
                {
                    id: channelIdHash,
                    person: [],
                    group: this.groups('federation', 'replicant', 'everyone'),
                    mode: SET_ACCESS_MODE.ADD
                }
            ]);
            console.log(`[AccessRights] ✅ Granted federation access to channel: ${channelId}`);
        }
        catch (error) {
            console.error(`[AccessRights] Failed to grant channel access for ${channelId}:`, error);
        }
    }
}
