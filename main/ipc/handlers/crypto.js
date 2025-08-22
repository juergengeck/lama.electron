/**
 * Cryptographic Objects Handlers
 * Provides access to keys, certificates, and other crypto objects
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Get available keys from ONE.CORE
 */
async function getKeys(event) {
  try {
    const keys = [];
    
    // Check for ONE.CORE data directory
    const dataPath = path.join(process.cwd(), 'one-data-node');
    const keysPath = path.join(dataPath, 'keys');
    
    // Try to read actual key files if directory exists
    try {
      await fs.access(keysPath);
      const keyFiles = await fs.readdir(keysPath);
      
      for (const file of keyFiles) {
        if (file.endsWith('.key') || file.endsWith('.pub')) {
          const filePath = path.join(keysPath, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Parse key type from filename or content
          const isPrivate = file.endsWith('.key');
          const keyType = file.includes('sign') ? 'Signing' : 
                         file.includes('encrypt') ? 'Encryption' : 
                         file.includes('identity') ? 'Identity' : 'General';
          
          keys.push({
            id: file,
            type: `${keyType} ${isPrivate ? 'Private Key' : 'Public Key'}`,
            filename: file,
            algorithm: detectKeyAlgorithm(content),
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            fingerprint: generateFingerprint(content),
            isPrivate,
            path: filePath
          });
        }
      }
    } catch (e) {
      // Directory doesn't exist, use default keys
      console.log('Keys directory not found, using defaults');
    }
    
    // If no real keys found, provide example keys
    if (keys.length === 0) {
      // Generate example keys to show the interface
      const identityKeyPair = crypto.generateKeyPairSync('ed25519');
      const encryptionKeyPair = crypto.generateKeyPairSync('x25519');
      
      keys.push(
        {
          id: 'identity-private',
          type: 'Identity Private Key',
          filename: 'identity.key',
          algorithm: 'Ed25519',
          size: 64,
          created: new Date(),
          modified: new Date(),
          fingerprint: generateFingerprint(identityKeyPair.privateKey.toString('hex')),
          isPrivate: true,
          pemData: identityKeyPair.privateKey.toString('hex').substring(0, 64) + '...'
        },
        {
          id: 'identity-public',
          type: 'Identity Public Key',
          filename: 'identity.pub',
          algorithm: 'Ed25519',
          size: 32,
          created: new Date(),
          modified: new Date(),
          fingerprint: generateFingerprint(identityKeyPair.publicKey.toString('hex')),
          isPrivate: false,
          pemData: identityKeyPair.publicKey.toString('hex')
        },
        {
          id: 'encryption-private',
          type: 'Encryption Private Key',
          filename: 'encryption.key',
          algorithm: 'X25519',
          size: 32,
          created: new Date(),
          modified: new Date(),
          fingerprint: generateFingerprint(encryptionKeyPair.privateKey.toString('hex')),
          isPrivate: true,
          pemData: encryptionKeyPair.privateKey.toString('hex').substring(0, 64) + '...'
        },
        {
          id: 'encryption-public',
          type: 'Encryption Public Key',
          filename: 'encryption.pub',
          algorithm: 'X25519',
          size: 32,
          created: new Date(),
          modified: new Date(),
          fingerprint: generateFingerprint(encryptionKeyPair.publicKey.toString('hex')),
          isPrivate: false,
          pemData: encryptionKeyPair.publicKey.toString('hex')
        }
      );
    }
    
    console.log('[Crypto] Returning keys:', keys.length)
    return keys;
  } catch (error) {
    console.error('[Crypto] Failed to get keys:', error);
    throw error;
  }
}

/**
 * Get available certificates
 */
async function getCertificates(event) {
  try {
    const certificates = [];
    
    // Check for certificates directory
    const dataPath = path.join(process.cwd(), 'one-data-node');
    const certsPath = path.join(dataPath, 'certs');
    
    try {
      await fs.access(certsPath);
      const certFiles = await fs.readdir(certsPath);
      
      for (const file of certFiles) {
        if (file.endsWith('.crt') || file.endsWith('.pem') || file.endsWith('.cert')) {
          const filePath = path.join(certsPath, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf8');
          
          certificates.push({
            id: file,
            type: 'X.509 Certificate',
            filename: file,
            subject: extractCertSubject(content),
            issuer: extractCertIssuer(content),
            validFrom: stats.birthtime,
            validTo: new Date(stats.birthtime.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
            size: stats.size,
            fingerprint: generateFingerprint(content),
            path: filePath
          });
        }
      }
    } catch (e) {
      console.log('Certs directory not found, using defaults');
    }
    
    // If no real certificates found, provide examples
    if (certificates.length === 0) {
      certificates.push(
        {
          id: 'self-signed-identity',
          type: 'Self-Signed Identity Certificate',
          filename: 'identity.crt',
          subject: 'CN=User Identity, O=LAMA, C=US',
          issuer: 'CN=User Identity, O=LAMA, C=US',
          validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          validTo: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
          size: 1024,
          fingerprint: 'SHA256:' + crypto.randomBytes(32).toString('hex').substring(0, 47),
          serialNumber: crypto.randomBytes(8).toString('hex').toUpperCase()
        },
        {
          id: 'device-cert',
          type: 'Device Certificate',
          filename: 'device.crt',
          subject: 'CN=Desktop Device, O=LAMA IoM, C=US',
          issuer: 'CN=User Identity, O=LAMA, C=US',
          validFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          validTo: new Date(Date.now() + 358 * 24 * 60 * 60 * 1000),
          size: 1024,
          fingerprint: 'SHA256:' + crypto.randomBytes(32).toString('hex').substring(0, 47),
          serialNumber: crypto.randomBytes(8).toString('hex').toUpperCase()
        }
      );
    }
    
    console.log('[Crypto] Returning certificates:', certificates.length)
    return certificates;
  } catch (error) {
    console.error('[Crypto] Failed to get certificates:', error);
    throw error;
  }
}

/**
 * Export a key or certificate
 */
async function exportCryptoObject(event, { type, id, format }) {
  try {
    // In a real implementation, this would export the actual key/cert
    // For now, return a placeholder response
    const exportData = {
      type,
      id,
      format,
      data: `-----BEGIN ${type.toUpperCase()}-----\n` +
            crypto.randomBytes(48).toString('base64') + '\n' +
            `-----END ${type.toUpperCase()}-----`,
      filename: `${id}.${format || 'pem'}`
    };
    
    return exportData;
  } catch (error) {
    console.error('[Crypto] Failed to export:', error);
    throw error;
  }
}

/**
 * Helper functions
 */

function detectKeyAlgorithm(content) {
  if (content.includes('RSA')) return 'RSA';
  if (content.includes('EC') || content.includes('ECDSA')) return 'ECDSA';
  if (content.includes('Ed25519')) return 'Ed25519';
  if (content.includes('X25519')) return 'X25519';
  return 'Unknown';
}

function generateFingerprint(content) {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  const digest = hash.digest('hex');
  // Format as fingerprint (XX:XX:XX:...)
  return 'SHA256:' + digest.substring(0, 47);
}

function extractCertSubject(content) {
  // In a real implementation, parse the certificate
  // For now, return a placeholder
  const match = content.match(/Subject: (.+)/);
  return match ? match[1] : 'CN=Unknown';
}

function extractCertIssuer(content) {
  // In a real implementation, parse the certificate
  // For now, return a placeholder
  const match = content.match(/Issuer: (.+)/);
  return match ? match[1] : 'CN=Unknown Issuer';
}

module.exports = {
  getKeys,
  getCertificates,
  exportCryptoObject
};