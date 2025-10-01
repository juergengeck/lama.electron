/**
 * Peer Message Listener for Node.js instance
 *
 * Listens for ALL channel updates (not just AI) and notifies
 * the UI when new messages arrive from peers via CHUM sync.
 */
class PeerMessageListener {
    channelManager;
    topicModel;
    unsubscribe;
    debounceTimers;
    DEBOUNCE_MS;
    mainWindow;
    ownerId;
    lastMessageCounts;
    constructor(channelManager, topicModel) {
        this.channelManager = channelManager;
        this.topicModel = topicModel;
        this.unsubscribe = null;
        this.debounceTimers = new Map();
        this.DEBOUNCE_MS = 100; // Faster than AI listener
        this.mainWindow = null;
        this.ownerId = null;
        this.lastMessageCounts = new Map(); // Track message counts per channel
    }
    /**
     * Set the main window for IPC communication
     */
    setMainWindow(mainWindow) {
        this.mainWindow = mainWindow;
        console.log('[PeerMessageListener] Main window reference set');
    }
    /**
     * Set the owner ID to filter out our own messages
     */
    setOwnerId(ownerId) {
        this.ownerId = ownerId;
        console.log(`[PeerMessageListener] Owner ID set: ${ownerId?.substring(0, 8)}`);
    }
    /**
     * Start listening for peer messages
     */
    async start() {
        console.log('[PeerMessageListener] Starting peer message listener...');
        if (!this.channelManager) {
            console.error('[PeerMessageListener] Cannot start - channelManager is undefined');
            return;
        }
        if (!this.channelManager.onUpdated) {
            console.error('[PeerMessageListener] Cannot start - channelManager.onUpdated is undefined');
            return;
        }
        console.log('[PeerMessageListener] 🎯 Setting up channel update listener for peer messages...');
        // Subscribe to ALL channel updates
        this.unsubscribe = this.channelManager.onUpdated(async (channelInfoIdHash, channelId, channelOwner, timeOfEarliestChange, data) => {
            // Debounce frequent updates
            const existingTimer = this.debounceTimers.get(channelId);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            const timerId = setTimeout(async () => {
                this.debounceTimers.delete(channelId);
                try {
                    await this.handleChannelUpdate(channelId, channelOwner, data);
                }
                catch (error) {
                    console.error(`[PeerMessageListener] Error processing channel update:`, error);
                }
            }, this.DEBOUNCE_MS);
            this.debounceTimers.set(channelId, timerId);
        });
        console.log('[PeerMessageListener] ✅ Peer message listener started successfully');
    }
    /**
     * Handle channel updates and detect new peer messages
     */
    async handleChannelUpdate(channelId, channelOwner, data) {
        // Skip if no main window to notify
        if (!this.mainWindow) {
            return;
        }
        console.log(`[PeerMessageListener] 📨 Channel update for: ${channelId}`);
        try {
            // Check if this is a topic/conversation channel
            if (!this.topicModel) {
                console.log('[PeerMessageListener] TopicModel not available yet');
                return;
            }
            // Try to get the topic room to check for new messages
            const topicRoom = await this.topicModel.enterTopicRoom(channelId);
            if (!topicRoom) {
                // Not a chat topic, skip
                return;
            }
            // Get all messages in the topic
            const messages = await topicRoom.retrieveAllMessages();
            const validMessages = messages.filter((msg) => msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== '');
            // Check if we have new messages
            const previousCount = this.lastMessageCounts.get(channelId) || 0;
            const currentCount = validMessages.length;
            if (currentCount > previousCount) {
                console.log(`[PeerMessageListener] 🆕 New messages detected in ${channelId}: ${currentCount - previousCount} new`);
                // Get the new messages
                const newMessages = validMessages.slice(previousCount);
                // Check if any new messages are from peers (not from us)
                const peerMessages = newMessages.filter((msg) => {
                    const senderId = msg.data?.sender || msg.data?.author || msg.author;
                    return senderId !== this.ownerId;
                });
                if (peerMessages.length > 0) {
                    console.log(`[PeerMessageListener] 📬 ${peerMessages.length} new peer messages in ${channelId}`);
                    // Notify the UI about new messages
                    this.notifyUI(channelId, peerMessages);
                }
                // Update the count
                this.lastMessageCounts.set(channelId, currentCount);
            }
        }
        catch (error) {
            // Silently skip non-topic channels
            if (!error.message?.includes('not found')) {
                console.error(`[PeerMessageListener] Error checking channel ${channelId}:`, error.message);
            }
        }
    }
    /**
     * Notify the UI about new peer messages
     */
    notifyUI(channelId, newMessages) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }
        // Normalize P2P channel IDs to match what the UI expects
        // The UI normalizes P2P IDs by sorting them alphabetically
        let normalizedChannelId = channelId;
        if (channelId.includes('<->')) {
            const parts = channelId.split('<->');
            normalizedChannelId = parts.sort().join('<->');
            console.log(`[PeerMessageListener] Normalized P2P channel ID: ${channelId} -> ${normalizedChannelId}`);
        }
        console.log(`[PeerMessageListener] 📤 Sending new message notification to UI for ${normalizedChannelId}`);
        // Ensure webContents is ready
        if (!this.mainWindow.webContents || this.mainWindow.webContents.isLoading()) {
            console.log('[PeerMessageListener] WebContents not ready, queuing notification');
            setTimeout(() => this.notifyUI(channelId, newMessages), 100);
            return;
        }
        // Send IPC event to renderer with normalized channel ID
        const eventData = {
            conversationId: normalizedChannelId,
            messages: newMessages.map((msg, index) => ({
                id: msg.id || msg.channelEntryHash || `msg-${Date.now()}-${index}`,
                conversationId: normalizedChannelId,
                text: msg.data?.text || '',
                sender: msg.data?.sender || msg.data?.author || msg.author,
                timestamp: msg.creationTime ? new Date(msg.creationTime).toISOString() : new Date().toISOString(),
                status: 'received',
                isAI: false
            }))
        };
        console.log(`[PeerMessageListener] 📤📤📤 Sending chat:newMessages event with conversationId: ${eventData.conversationId}`);
        this.mainWindow.webContents.send('chat:newMessages', eventData);
    }
    /**
     * Stop listening for messages
     */
    stop() {
        console.log('[PeerMessageListener] Stopping peer message listener...');
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        // Clear all timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear()(this.lastMessageCounts).clear();
        console.log('[PeerMessageListener] Peer message listener stopped');
    }
}
export default PeerMessageListener;
