/**
 * Audit Panel Component
 *
 * Main panel for audit operations:
 * - View attestations
 * - Create new attestations
 * - Export with attestations
 * - Sync attestations
 */

import React, { useState, useEffect } from 'react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { AttestationStatus } from './AttestationStatus';
import './AuditPanel.css';

interface AuditPanelProps {
  topicId: string;
  messageHash?: string;
  messageId?: string;
  messageVersion?: number;
  onClose?: () => void;
}

interface Attestation {
  messageHash: string;
  auditorId: string;
  auditorName: string;
  timestamp: string;
  attestationType: string;
  attestationClaim: string;
  signature?: string;
}

export const AuditPanel: React.FC<AuditPanelProps> = ({
  topicId,
  messageHash,
  messageId,
  messageVersion = 1,
  onClose
}) => {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attestations' | 'create' | 'export'>('attestations');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'html' | 'json' | 'microdata'>('html');

  useEffect(() => {
    if (messageHash) {
      fetchAttestations();
    }
  }, [messageHash, refreshTrigger]);

  const fetchAttestations = async () => {
    if (!messageHash) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke('audit:getAttestations', {
        messageHash
      });

      if (result.success) {
        setAttestations(result.attestations || []);
      } else {
        setError(result.error || 'Failed to fetch attestations');
      }
    } catch (err) {
      setError('Error fetching attestations');
      console.error('Fetch attestations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createAttestation = async () => {
    if (!messageHash) return;

    setLoading(true);
    setError(null);

    try {
      // Get message content for attestation
      const messageContent = await getMessageContent();

      const result = await window.electronAPI.invoke('audit:createAttestation', {
        messageHash,
        messageVersion,
        attestedContent: messageContent,
        attestationType: 'reproduction-correct',
        attestationClaim: 'I attest this message reproduction is correct',
        topicId
      });

      if (result.success) {
        setRefreshTrigger(prev => prev + 1);
        setActiveTab('attestations');
        // Could show success toast
      } else {
        setError(result.error || 'Failed to create attestation');
      }
    } catch (err) {
      setError('Error creating attestation');
      console.error('Create attestation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncAttestations = async () => {
    setSyncing(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke('audit:syncAttestations', {
        topicId
      });

      if (result.success) {
        setRefreshTrigger(prev => prev + 1);
        // Could show success toast with count
      } else {
        setError(result.error || 'Failed to sync');
      }
    } catch (err) {
      setError('Error syncing attestations');
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const exportTopic = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke('audit:exportTopic', {
        topicId,
        includeAttestations: true,
        format: exportFormat
      });

      if (result.success && result.exportData) {
        // Create download
        const blob = new Blob([result.exportData], {
          type: exportFormat === 'html' ? 'text/html' : 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `topic-export-${topicId.substring(0, 8)}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Failed to export');
      }
    } catch (err) {
      setError('Error exporting topic');
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMessageContent = async (): Promise<string> => {
    // In real implementation, fetch from message store
    return 'Message content here';
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="audit-panel">
      <div className="panel-header">
        <h2>Message Audit</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>

      {messageHash && (
        <div className="message-info">
          <AttestationStatus
            messageHash={messageHash}
            messageId={messageId}
            showDetails={true}
            refreshTrigger={refreshTrigger}
          />
          <div className="message-details">
            <span className="hash-display">
              Hash: {messageHash.substring(0, 12)}...
            </span>
            <span className="version-display">v{messageVersion}</span>
          </div>
        </div>
      )}

      <div className="panel-tabs">
        <button
          className={`tab ${activeTab === 'attestations' ? 'active' : ''}`}
          onClick={() => setActiveTab('attestations')}
        >
          📜 Attestations ({attestations.length})
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Create
        </button>
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📤 Export
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'attestations' && (
          <div className="attestations-list">
            <div className="list-header">
              <h3>Attestations</h3>
              <button
                className="sync-button"
                onClick={syncAttestations}
                disabled={syncing}
              >
                {syncing ? '⏳' : '🔄'} Sync
              </button>
            </div>

            {loading && <div className="loading">⏳ Loading attestations...</div>}

            {!loading && attestations.length === 0 && (
              <div className="empty-state">
                <p>📜 No attestations yet</p>
                <p>Create one or share QR code with auditors</p>
              </div>
            )}

            {attestations.map((att, index) => (
              <div key={index} className="attestation-item">
                <div className="attestation-header">
                  <span className="auditor-name">{att.auditorName}</span>
                  <span className="attestation-type">{att.attestationType}</span>
                </div>
                <div className="attestation-claim">{att.attestationClaim}</div>
                <div className="attestation-meta">
                  <span className="timestamp">{formatDate(att.timestamp)}</span>
                  {att.signature && <span className="signed">✅ Signed</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="create-attestation">
            <h3>Create Attestation</h3>
            <p>Attest that this message reproduction is correct.</p>

            <div className="attestation-form">
              <div className="form-field">
                <label>Message Hash</label>
                <code>{messageHash?.substring(0, 32)}...</code>
              </div>

              <div className="form-field">
                <label>Version</label>
                <span>v{messageVersion}</span>
              </div>

              <div className="form-field">
                <label>Attestation Type</label>
                <select disabled>
                  <option>reproduction-correct</option>
                </select>
              </div>

              <button
                className="create-button"
                onClick={createAttestation}
                disabled={loading || !messageHash}
              >
                {loading ? '⏳ Creating...' : '✅ Create Attestation'}
              </button>
            </div>

            <div className="qr-section">
              <h4>Share for External Audit</h4>
              <QRCodeDisplay
                messageId={messageId || ''}
                messageHash={messageHash || ''}
                messageVersion={messageVersion}
                topicId={topicId}
              />
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="export-section">
            <h3>Export with Attestations</h3>
            <p>Export this topic including all attestations.</p>

            <div className="export-options">
              <div className="format-selector">
                <label>Format:</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                >
                  <option value="html">HTML with Microdata</option>
                  <option value="json">JSON</option>
                  <option value="microdata">Pure Microdata</option>
                </select>
              </div>

              <button
                className="export-button"
                onClick={exportTopic}
                disabled={loading}
              >
                {loading ? '⏳ Exporting...' : '📤 Export Topic'}
              </button>
            </div>

            <div className="export-info">
              <h4>Export includes:</h4>
              <ul>
                <li>✅ All messages in topic</li>
                <li>✅ All attestations</li>
                <li>✅ Structured microdata markup</li>
                <li>✅ W3C Verifiable Credentials compatible</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="panel-error">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};