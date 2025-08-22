// Mock implementation of lama-bridge
import { type Message, type Peer } from '../../src/bridge/lama-bridge'

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    senderId: 'ai-assistant',
    content: 'Hello! I\'m your local AI assistant.',
    timestamp: new Date('2024-01-01T10:00:00'),
    encrypted: true
  },
  {
    id: 'msg-2',
    senderId: 'user-1',
    content: 'Hi there!',
    timestamp: new Date('2024-01-01T10:01:00'),
    encrypted: true
  }
]

export const mockPeers: Peer[] = [
  {
    id: 'peer-1',
    name: 'Alice',
    address: '192.168.1.100:8080',
    status: 'connected',
    lastSeen: new Date()
  },
  {
    id: 'peer-2',
    name: 'Bob',
    address: '192.168.1.101:8080',
    status: 'disconnected',
    lastSeen: new Date()
  }
]

export const lamaBridge = {
  createIdentity: jest.fn().mockResolvedValue('new-identity-id'),
  login: jest.fn().mockResolvedValue(true),
  logout: jest.fn().mockResolvedValue(undefined),
  getCurrentUser: jest.fn().mockResolvedValue({ id: 'user-1', name: 'Test User' }),
  sendMessage: jest.fn().mockResolvedValue('msg-sent-id'),
  getMessages: jest.fn().mockResolvedValue(mockMessages),
  createChannel: jest.fn().mockResolvedValue('channel-id'),
  connectToPeer: jest.fn().mockResolvedValue(true),
  getPeerList: jest.fn().mockResolvedValue(mockPeers),
  queryLocalAI: jest.fn().mockResolvedValue('AI response'),
  loadModel: jest.fn().mockResolvedValue(true),
  createUdpSocket: jest.fn().mockResolvedValue('socket-id'),
  sendUdpMessage: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn()
}

export default lamaBridge