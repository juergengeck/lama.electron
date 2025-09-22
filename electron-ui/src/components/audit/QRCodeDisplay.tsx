/**
 * QR Code Display Component
 *
 * Displays QR codes for message attestation
 * Compatible with ONE.core contact invite format
 */

import React, { useState, useEffect } from 'react';
import './QRCodeDisplay.css';

interface QRCodeDisplayProps {
  messageId: string;
  messageHash: string;
  messageVersion?: number;
  topicId?: string;
  attestationType?: 'message' | 'topic';
  onScanInfo?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  messageId,
  messageHash,
  messageVersion = 1,
  topicId,
  attestationType = 'message',
  onScanInfo
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const generateQRCode = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke('audit:generateQR', {
        messageHash,
        messageVersion,
        topicId,
        attestationType
      });

      if (result.success && result.qrDataUrl) {
        setQrDataUrl(result.qrDataUrl);
        setQrText(result.qrText);
        setShowQR(true);
      } else {
        setError(result.error || 'Failed to generate QR code');
      }
    } catch (err) {
      setError('Error generating QR code');
      console.error('QR generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyQRText = () => {
    if (qrText) {
      navigator.clipboard.writeText(qrText);
      // Could show a toast notification here
    }
  };

  const downloadQR = () => {
    if (qrDataUrl) {
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `attestation-qr-${messageId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="qr-code-display">
      {!showQR && (
        <button
          className="qr-trigger-button"
          onClick={generateQRCode}
          disabled={loading}
          title="Generate QR code for attestation"
        >
          {loading ? '⏳' : '📱'} QR
        </button>
      )}

      {showQR && qrDataUrl && (
        <div className="qr-modal">
          <div className="qr-modal-overlay" onClick={() => setShowQR(false)} />
          <div className="qr-modal-content">
            <div className="qr-header">
              <h3>Attestation QR Code</h3>
              <button className="close-button" onClick={() => setShowQR(false)}>×</button>
            </div>

            <div className="qr-image-container">
              <img src={qrDataUrl} alt="QR Code" className="qr-image" />
            </div>

            <div className="qr-info">
              <div className="qr-type-badge">
                {attestationType === 'topic' ? '📂 Topic' : '💬 Message'} v{messageVersion}
              </div>

              {qrText && (
                <div className="qr-text">
                  <code>{qrText}</code>
                  <button onClick={copyQRText} title="Copy QR text">📋</button>
                </div>
              )}

              <div className="qr-instructions">
                <p>🔍 Scan with LAMA to attest this {attestationType}</p>
                <p>✅ Compatible with ONE.core contact invites</p>
              </div>
            </div>

            <div className="qr-actions">
              <button onClick={downloadQR} className="action-button">
                💾 Download QR
              </button>
              {onScanInfo && (
                <button onClick={onScanInfo} className="action-button secondary">
                  ℹ️ How to Scan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="qr-error">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};