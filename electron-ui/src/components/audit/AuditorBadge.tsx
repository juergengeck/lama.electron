/**
 * Auditor Badge Component
 *
 * Displays auditor identity with trust level
 * Shows badge for auditors who have attested messages
 */

import React, { useState, useEffect } from 'react';
import './AuditorBadge.css';

interface AuditorBadgeProps {
  auditorId: string;
  auditorName?: string;
  trustLevel?: number;
  attestationCount?: number;
  showDetails?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

interface AuditorDetails {
  name: string;
  trustLevel: number;
  totalAttestations: number;
  firstAttestation?: string;
  lastAttestation?: string;
  verifiedIdentity: boolean;
}

export const AuditorBadge: React.FC<AuditorBadgeProps> = ({
  auditorId,
  auditorName,
  trustLevel = 0,
  attestationCount = 0,
  showDetails = false,
  compact = false,
  onClick
}) => {
  const [details, setDetails] = useState<AuditorDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showDetails && !details) {
      fetchAuditorDetails();
    }
  }, [auditorId, showDetails]);

  const fetchAuditorDetails = async () => {
    setLoading(true);
    try {
      // Fetch auditor details
      const result = await window.electronAPI.invoke('audit:getAuditorDetails', {
        auditorId
      });

      if (result.success && result.details) {
        setDetails(result.details);
      }
    } catch (err) {
      console.error('Error fetching auditor details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTrustIcon = () => {
    if (trustLevel >= 4) return '🛡️'; // Shield - Highly trusted
    if (trustLevel >= 3) return '✅'; // Check - Trusted
    if (trustLevel >= 2) return '🔵'; // Blue circle - Known
    if (trustLevel >= 1) return '⚪'; // White circle - New
    return '❔'; // Question - Unknown
  };

  const getTrustLabel = () => {
    if (trustLevel >= 4) return 'Highly Trusted';
    if (trustLevel >= 3) return 'Trusted';
    if (trustLevel >= 2) return 'Known';
    if (trustLevel >= 1) return 'New';
    return 'Unknown';
  };

  const getBadgeClass = () => {
    const classes = ['auditor-badge'];
    
    if (compact) classes.push('compact');
    if (onClick) classes.push('clickable');
    
    if (trustLevel >= 4) classes.push('trust-high');
    else if (trustLevel >= 3) classes.push('trust-verified');
    else if (trustLevel >= 2) classes.push('trust-known');
    else if (trustLevel >= 1) classes.push('trust-new');
    else classes.push('trust-unknown');
    
    return classes.join(' ');
  };

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  if (compact) {
    return (
      <span
        className={getBadgeClass()}
        onClick={onClick}
        title={`${auditorName || 'Auditor'} - ${getTrustLabel()}`}
      >
        <span className="trust-icon">{getTrustIcon()}</span>
        <span className="auditor-name">{auditorName || 'Unknown'}</span>
        {attestationCount > 0 && (
          <span className="attestation-count">{attestationCount}</span>
        )}
      </span>
    );
  }

  return (
    <div className={getBadgeClass()} onClick={onClick}>
      <div className="badge-main">
        <span className="trust-icon" title={getTrustLabel()}>
          {getTrustIcon()}
        </span>
        <div className="badge-info">
          <div className="auditor-name">
            {auditorName || 'Unknown Auditor'}
          </div>
          <div className="trust-label">
            {getTrustLabel()}
            {attestationCount > 0 && (
              <span className="attestation-count">
                · {attestationCount} attestation{attestationCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {showDetails && details && (
        <div className="badge-details">
          {loading && (
            <div className="loading">⏳ Loading details...</div>
          )}
          
          {!loading && details && (
            <>
              <div className="detail-row">
                <span className="detail-label">Identity:</span>
                <span className="detail-value">
                  {details.verifiedIdentity ? '✅ Verified' : '🔄 Pending'}
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">First attestation:</span>
                <span className="detail-value">
                  {formatDate(details.firstAttestation)}
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Last attestation:</span>
                <span className="detail-value">
                  {formatDate(details.lastAttestation)}
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Total attestations:</span>
                <span className="detail-value">
                  {details.totalAttestations}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Group of auditor badges
export const AuditorGroup: React.FC<{
  auditors: Array<{
    id: string;
    name: string;
    trustLevel: number;
    attestationCount?: number;
  }>;
  maxDisplay?: number;
}> = ({ auditors, maxDisplay = 3 }) => {
  const [expanded, setExpanded] = useState(false);
  
  const displayAuditors = expanded ? auditors : auditors.slice(0, maxDisplay);
  const remaining = auditors.length - maxDisplay;
  
  return (
    <div className="auditor-group">
      {displayAuditors.map((auditor) => (
        <AuditorBadge
          key={auditor.id}
          auditorId={auditor.id}
          auditorName={auditor.name}
          trustLevel={auditor.trustLevel}
          attestationCount={auditor.attestationCount}
          compact={true}
        />
      ))}
      
      {!expanded && remaining > 0 && (
        <button
          className="more-auditors"
          onClick={() => setExpanded(true)}
        >
          +{remaining} more
        </button>
      )}
      
      {expanded && auditors.length > maxDisplay && (
        <button
          className="less-auditors"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      )}
    </div>
  );
};