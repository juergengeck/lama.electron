/**
 * MessageHistory Component
 *
 * Displays version history of edited and retracted messages
 */

import React, { useState, useEffect } from 'react';
import { EnhancedMessageData } from './EnhancedMessageBubble';
import './MessageHistory.css';

export interface MessageVersion extends EnhancedMessageData {
  hash?: string;
}

export interface MessageHistoryProps {
  messageId: string;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

export const MessageHistory: React.FC<MessageHistoryProps> = ({
  messageId,
  onClose,
  theme = 'dark'
}) => {
  const [versions, setVersions] = useState<MessageVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    loadVersionHistory();
  }, [messageId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call IPC to get version history
      const result = await window.electronAPI.invoke('chat:getMessageHistory', { messageId });

      if (result.success && result.data) {
        setVersions(result.data);
        // Select first and last version by default
        if (result.data.length > 1) {
          setSelectedVersions(new Set([1, result.data.length]));
        }
      } else {
        setError(result.error || 'Failed to load version history');
      }
    } catch (err) {
      setError('Error loading version history');
      console.error('Failed to load message history:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleVersionSelection = (version: number) => {
    const newSelection = new Set(selectedVersions);
    if (newSelection.has(version)) {
      // Don't allow deselecting if it's the only one selected
      if (newSelection.size > 1) {
        newSelection.delete(version);
      }
    } else {
      // Maximum 2 versions for comparison
      if (newSelection.size < 2) {
        newSelection.add(version);
      } else {
        // Replace oldest selection
        const minVersion = Math.min(...newSelection);
        newSelection.delete(minVersion);
        newSelection.add(version);
      }
    }
    setSelectedVersions(newSelection);
  };

  const formatTimestamp = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const renderVersion = (version: MessageVersion) => {
    const isSelected = selectedVersions.has(version.version || 1);

    return (
      <div
        key={version.versionId}
        className={`version-item ${isSelected ? 'selected' : ''} ${theme}`}
        onClick={() => toggleVersionSelection(version.version || 1)}
      >
        <div className="version-header">
          <div className="version-info">
            <span className="version-number">Version {version.version}</span>
            {version.version === 1 && <span className="version-badge original">Original</span>}
            {version.isRetracted && <span className="version-badge retracted">Retracted</span>}
            {version.version === versions.length && !version.isRetracted && (
              <span className="version-badge current">Current</span>
            )}
          </div>
          <div className="version-timestamp">
            {version.editedAt ?
              formatTimestamp(version.editedAt) :
              formatTimestamp(version.timestamp)}
          </div>
        </div>

        <div className="version-content">
          {version.isRetracted ? (
            <div className="retracted-content">
              [Message retracted{version.retractReason ? `: ${version.retractReason}` : ''}]
            </div>
          ) : (
            <div className="message-text">{version.text}</div>
          )}
        </div>

        {version.editReason && (
          <div className="edit-reason">
            <span className="reason-label">Edit reason:</span> {version.editReason}
          </div>
        )}

        {version.hash && (
          <div className="version-hash" title={version.hash}>
            SHA256: {version.hash.substring(0, 8)}...
          </div>
        )}
      </div>
    );
  };

  const renderComparison = () => {
    if (selectedVersions.size !== 2) return null;

    const [v1, v2] = Array.from(selectedVersions).sort();
    const version1 = versions.find(v => v.version === v1);
    const version2 = versions.find(v => v.version === v2);

    if (!version1 || !version2) return null;

    // Simple diff - highlight differences
    const getDiff = (oldText: string, newText: string) => {
      // This is a simple implementation - in production use a proper diff library
      if (oldText === newText) {
        return <span>{newText}</span>;
      }

      return (
        <div className="diff-container">
          <div className="diff-removed">
            <span className="diff-label">Version {v1}:</span>
            <span className="diff-text">{oldText}</span>
          </div>
          <div className="diff-added">
            <span className="diff-label">Version {v2}:</span>
            <span className="diff-text">{newText}</span>
          </div>
        </div>
      );
    };

    return (
      <div className="version-comparison">
        <h3>Comparing Version {v1} → Version {v2}</h3>
        {getDiff(version1.text || '', version2.text || '')}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`message-history-modal ${theme}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h2>Message History</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="loading">Loading version history...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`message-history-modal ${theme}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h2>Message History</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`message-history-modal ${theme}`}>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h2>Message History</h2>
          <span className="version-count">{versions.length} versions</span>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {selectedVersions.size === 2 && (
            <div className="comparison-hint">
              Click versions to compare (max 2)
            </div>
          )}

          <div className="versions-list">
            {versions.map(renderVersion)}
          </div>

          {renderComparison()}
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            Messages are immutable. Each edit creates a new version.
          </div>
        </div>
      </div>
    </div>
  );
};