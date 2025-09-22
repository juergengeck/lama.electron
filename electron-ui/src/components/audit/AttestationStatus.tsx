/**
 * Attestation Status Indicator Component
 *
 * Shows the attestation state for messages:
 * - Fully attested (2+ attestations)
 * - Partially attested (1 attestation)
 * - Not attested
 * - Pending sync
 */

import React, { useState, useEffect } from 'react';
import './AttestationStatus.css';

interface AttestationStatusProps {
  messageHash: string;
  messageId?: string;
  showDetails?: boolean;
  onViewAttestations?: () => void;
  refreshTrigger?: number;
}

interface StatusData {
  hasAttestations: boolean;
  attestationCount: number;
  fullyAttested: boolean;
  partiallyAttested: boolean;
  pendingSync: boolean;
  auditors: Array<{
    id: string;
    name: string;
    attestedAt: string;
    trustLevel: number;
  }>;
  signaturesComplete: boolean;
  missingSignatures: string[];
}

export const AttestationStatus: React.FC<AttestationStatusProps> = ({
  messageHash,
  messageId,
  showDetails = false,
  onViewAttestations,
  refreshTrigger = 0
}) => {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, [messageHash, refreshTrigger]);

  const fetchStatus = async () => {
    if (!messageHash) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke('audit:getAttestationStatus', {
        messageHash
      });

      if (result.success && result.status) {
        setStatus(result.status);
      } else {
        setError(result.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError('Error fetching attestation status');
      console.error('Attestation status error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (loading) return '⏳';
    if (!status) return '⚪';
    if (status.pendingSync) return '🔄';
    if (status.fullyAttested) return '✅';
    if (status.partiallyAttested) return '🟡';
    return '⚪';
  };

  const getStatusText = () => {
    if (loading) return 'Loading...';
    if (!status) return 'Not attested';
    if (status.pendingSync) return 'Syncing attestations...';
    if (status.fullyAttested) return `Fully attested (${status.attestationCount})`;
    if (status.partiallyAttested) return `Partially attested (${status.attestationCount})`;
    return 'Not attested';
  };

  const getStatusClass = () => {
    if (!status) return 'status-none';
    if (status.pendingSync) return 'status-pending';
    if (status.fullyAttested) return 'status-full';
    if (status.partiallyAttested) return 'status-partial';
    return 'status-none';
  };

  const getTrustIndicator = (level: number) => {
    if (level >= 4) return '🛡️'; // Highly trusted
    if (level >= 3) return '✓'; // Trusted
    if (level >= 2) return '○'; // Known
    return '?'; // Unknown
  };

  return (
    <div className={`attestation-status ${getStatusClass()}`}>
      <div 
        className="status-indicator"
        onClick={onViewAttestations}
        title={getStatusText()}
      >
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
      </div>

      {showDetails && status && status.hasAttestations && (
        <div className="attestation-details">
          <div className="auditor-list">
            {status.auditors.map((auditor, index) => (
              <div key={auditor.id} className="auditor-item">
                <span className="trust-indicator">
                  {getTrustIndicator(auditor.trustLevel)}
                </span>
                <span className="auditor-name">{auditor.name}</span>
                <span className="attestation-time">
                  {new Date(auditor.attestedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>

          {!status.signaturesComplete && (
            <div className="signature-warning">
              ⚠️ Some signatures missing
              {status.missingSignatures.length > 0 && (
                <span className="missing-count">
                  ({status.missingSignatures.length})
                </span>
              )}
            </div>
          )}

          {status.pendingSync && (
            <div className="sync-indicator">
              🔄 Checking for new attestations...
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="status-error" title={error}>
          ⚠️
        </div>
      )}
    </div>
  );
};

// Compact version for inline display
export const AttestationBadge: React.FC<{
  messageHash: string;
  onClick?: () => void;
}> = ({ messageHash, onClick }) => {
  const [count, setCount] = useState<number>(0);
  const [isFullyAttested, setIsFullyAttested] = useState(false);

  useEffect(() => {
    fetchBadgeStatus();
  }, [messageHash]);

  const fetchBadgeStatus = async () => {
    try {
      const result = await window.electronAPI.invoke('audit:getAttestationStatus', {
        messageHash
      });

      if (result.success && result.status) {
        setCount(result.status.attestationCount);
        setIsFullyAttested(result.status.fullyAttested);
      }
    } catch (err) {
      console.error('Badge status error:', err);
    }
  };

  if (count === 0) return null;

  return (
    <span 
      className={`attestation-badge ${isFullyAttested ? 'badge-full' : 'badge-partial'}`}
      onClick={onClick}
      title={`${count} attestation${count !== 1 ? 's' : ''}`}
    >
      {isFullyAttested ? '✅' : '🟡'} {count}
    </span>
  );
};