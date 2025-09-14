import { useState, useEffect, useCallback } from 'react';
import { lamaBridge } from '@/bridge/lama-bridge';
// Main hook to access the bridge
export function useLama() {
    return {
        bridge: lamaBridge
    };
}
export function useLamaMessages(conversationId) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    useEffect(() => {
        // Reset initial load flag when conversation changes
        setIsInitialLoad(true);
        let debounceTimer = null;
        let mounted = true;
        const loadMessages = async () => {
            if (!mounted)
                return;
            try {
                // Only show loading spinner on initial load, not on updates
                if (isInitialLoad && mounted) {
                    setLoading(true);
                }
                const msgs = await lamaBridge.getMessages(conversationId);
                if (mounted) {
                    setMessages(msgs);
                    setIsInitialLoad(false);
                }
            }
            catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load messages');
                }
            }
            finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };
        loadMessages();
        // Listen for topic updates - only for this specific conversation
        const handleTopicUpdate = (data) => {
            // Always reload for default conversation or if conversationId matches
            if (!data || data?.conversationId === conversationId || conversationId === 'default') {
                // Debounce multiple rapid updates
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                debounceTimer = setTimeout(() => {
                    if (mounted) {
                        loadMessages();
                    }
                }, 100);
            } else {
            }
        };
        lamaBridge.on('message:updated', handleTopicUpdate);
        return () => {
            mounted = false;
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            lamaBridge.off('message:updated', handleTopicUpdate);
        };
    }, [conversationId]);
    const sendMessage = useCallback(async (topicId, content, attachments) => {
        try {
            
            // Optimistically add the message to the UI immediately
            const optimisticMessage = {
                id: `temp-${Date.now()}`,
                conversationId: topicId,
                content: content,
                senderId: 'user',
                isAI: false,
                timestamp: new Date(), // Use Date object, not string
                status: 'sending',
                attachments: attachments
            };
            
            // Add to local state immediately for instant UI feedback
            setMessages(prev => {
                return [...(prev || []), optimisticMessage];
            });
            
            // Send the actual message
            const messageId = await lamaBridge.sendMessage(topicId, content, attachments);
            
            // Update the temp message with the real ID
            setMessages(prev => prev.map(msg => 
                msg.id === optimisticMessage.id 
                    ? { ...msg, id: messageId, status: 'sent' }
                    : msg
            ));
            
            return messageId;
        }
        catch (err) {
            console.error('[useLama] sendMessage error:', err);
            // Remove the optimistic message on error
            setMessages(prev => prev.filter(msg => msg.id !== `temp-${Date.now()}`));
            setError(err instanceof Error ? err.message : 'Failed to send message');
            throw err;
        }
    }, [conversationId]);
    return { messages, loading, error, sendMessage };
}
export function useLamaPeers() {
    const [peers, setPeers] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const loadPeers = async () => {
            try {
                setLoading(true);
                const peerList = await lamaBridge.getPeerList();
                setPeers(peerList);
            }
            catch (err) {
                console.error('Failed to load peers:', err);
            }
            finally {
                setLoading(false);
            }
        };
        loadPeers();
        // Listen for peer updates
        const handlePeerUpdate = () => {
            loadPeers();
        };
        lamaBridge.on('peer:connected', handlePeerUpdate);
        lamaBridge.on('peer:disconnected', handlePeerUpdate);
        return () => {
            lamaBridge.off('peer:connected', handlePeerUpdate);
            lamaBridge.off('peer:disconnected', handlePeerUpdate);
        };
    }, []);
    const connectToPeer = useCallback(async (peerId) => {
        return await lamaBridge.connectToPeer(peerId);
    }, []);
    return { peers, loading, connectToPeer };
}
export function useLamaAI() {
    const [processing, setProcessing] = useState(false);
    const [response, setResponse] = useState(null);
    useEffect(() => {
        const handleProcessing = () => setProcessing(true);
        const handleComplete = () => setProcessing(false);
        lamaBridge.on('ai:processing', handleProcessing);
        lamaBridge.on('ai:complete', handleComplete);
        return () => {
            lamaBridge.off('ai:processing', handleProcessing);
            lamaBridge.off('ai:complete', handleComplete);
        };
    }, []);
    const query = useCallback(async (prompt) => {
        try {
            setProcessing(true);
            const result = await lamaBridge.queryLocalAI(prompt);
            setResponse(result);
            return result;
        }
        finally {
            setProcessing(false);
        }
    }, []);
    return { query, processing, response };
}
export function useLamaAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const currentUser = await lamaBridge.getCurrentUser();
                setUser(currentUser);
            }
            catch (err) {
                console.error('Failed to get current user:', err);
            }
            finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);
    const login = useCallback(async (id, password) => {
        const success = await lamaBridge.login(id, password);
        if (success) {
            const currentUser = await lamaBridge.getCurrentUser();
            setUser(currentUser);
        }
        return success;
    }, []);
    const logout = useCallback(async () => {
        await lamaBridge.logout();
        setUser(null);
    }, []);
    const createIdentity = useCallback(async (name, password) => {
        return await lamaBridge.createIdentity(name, password);
    }, []);
    return { user, loading, login, logout, createIdentity };
}
