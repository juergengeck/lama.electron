/**
 * Message Utilities for AI Chat
 * Adapted from LAMA for Electron app
 */

import { ensureIdHash } from '@refinio/one.core/lib/util/type-checks.js';
import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { createCryptoHash } from '@refinio/one.core/lib/system/crypto-helpers.js';
import { Buffer } from 'buffer';

/**
 * Certificate types for different message categories
 */
const MessageCertificateTypes = {
  SYSTEM: 'system-message-authentication',
  USER: 'user-message-authentication',
  AI: 'ai-message-authentication'
};

/**
 * Helper to calculate SHA256 hash of an object
 */
async function sha256Hash(data) {
  const jsonStr = JSON.stringify(data);
  const base64Hash = await createCryptoHash(jsonStr);
  const buffer = Buffer.from(base64Hash, 'base64');
  return buffer.toString('hex');
}

/**
 * Creates an AI message with proper identity
 * 
 * @param {string} text - Message text
 * @param {string} senderId - AI sender ID (personId)
 * @param {string} [previousMessageHash] - Optional hash of previous message
 * @param {string} [channelIdHash] - Optional channel ID
 * @param {string} [topicIdHash] - Optional topic ID
 * @param {string} [modelId] - Optional model ID for metadata
 * @returns {Promise<Object>} ChatMessage object
 */
async function createAIMessage(
  text,
  senderId,
  previousMessageHash,
  channelIdHash,
  topicIdHash,
  modelId
) {
  if (!text) {
    throw new Error('AI message text cannot be empty');
  }
  
  if (!senderId) {
    throw new Error('AI message sender ID cannot be empty');
  }
  
  const senderIdHash = ensureIdHash(senderId);
  
  // Extract <think> … </think> content if present
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const attachments = [];
  
  // Remove thinking tags from visible text
  let visibleText = text.replace(thinkRegex, '').trim();
  
  // Fallback if no visible text remains
  if (!visibleText) {
    visibleText = 'I apologize, something went wrong with my previous response.';
  }
  
  // Create AI message
  const message = {
    $type$: 'ChatMessage',
    text: visibleText,
    sender: senderIdHash,
    attachments: attachments.length > 0 ? attachments : undefined
  };
  
  console.log(`[messageUtils] Created AI message with sender: ${senderIdHash.toString().substring(0, 8)}...`);
  
  return message;
}

/**
 * Create a user message
 */
function createUserMessage(text, sender, attachments = []) {
  return {
    $type$: 'ChatMessage',
    text,
    sender,
    attachments
  };
}

/**
 * Check if a message is from an AI
 */
function isAIMessage(message, aiPersonIds) {
  if (!message || !message.sender) return false;
  const senderId = message.sender.toString();
  return aiPersonIds.some(aiId => aiId.toString() === senderId);
}

export {
  MessageCertificateTypes,
  createAIMessage,
  createUserMessage,
  isAIMessage,
  sha256Hash
};