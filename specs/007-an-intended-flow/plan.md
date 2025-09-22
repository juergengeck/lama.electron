# Planning Document: Third-Party Message Audit Flow

**Feature Branch**: `007-an-intended-flow`
**Created**: 2025-09-21
**Status**: Planning
**Spec**: [spec.md](./spec.md)

## Implementation Decisions

### 1. QR Code Scanning Interface
- **Decision**: Implement scanning in `reference/lama`
- **Rationale**: Keeps audit functionality in reference implementation
- **Impact**: Need to add QR scanning capability to reference/lama app

### 2. Auditor Identity & Accounts
- **Decision**: Auditors use local ONE.core accounts (no special auditor accounts)
- **Rationale**: Consistent with ONE.core's local-first architecture
- **Impact**: Standard LAMA account creation/provisioning for auditors

### 3. Topic Sharing Mechanism
- **Decision**: Topic export with structured data + ONE.core invite/connection
- **Approach**:
  - Export topic as structured data package
  - Use ONE.core invite system for initial connection
  - Grant Access objects for topic content
- **Impact**: Leverage existing invite/access infrastructure

### 4. Attestation Storage
- **Decision**: Attestations stored as part of Topic, shared via ONE.core sync
- **Approach**:
  - Attestations are Topic objects
  - All data remains local (ONE.core principle)
  - Sync through existing Topic sharing mechanisms
- **Impact**: Attestations automatically available to all Topic participants

### 5. QR Code Data Structure
- **Decision**: Message hash as QR content
- **Format**: Compatible with ONE.core invite format
- **Structure**:
  ```
  one://audit/{messageHash}
  ```
- **Impact**: Simple, scannable, compatible with existing invite parsing

### 6. Version Identification & Attestation
- **Decision**: Attestations link to specific version hash
- **Approach**:
  - Versions identified by SHA256 hash
  - Auditor uses lama.electron or lama to read/store/view
  - Attestation confirms both content AND hash
- **Impact**: Version-specific attestations, immutable references

### 7. Incomplete Signatures Display
- **Decision**: UI indicates when attestation availability is incomplete
- **States**:
  - ✅ Fully attested (all signatures present)
  - ⚠️ Partially attested (some signatures missing)
  - 🔄 Attestation pending sync
- **Impact**: Clear visual feedback on attestation completeness

### 8. Audit Trail Access & Export
- **Decision**: Full access for auditors and participants
- **Export Format**: HTML with structured markup (microdata)
- **Consistency**: Microdata format must align with shared audit data
- **Features**:
  - Export includes all attestations
  - Structured data for machine processing
  - Human-readable HTML presentation
- **Impact**: Dual-purpose export for compliance and verification

## Technical Components

### Core Modules

1. **QR Generation Service** (`/main/core/qr-generation.js`)
   - Generate QR codes for message hashes
   - ONE.core invite-compatible format
   - Version-aware generation

2. **Attestation Manager** (`/main/core/attestation-manager.js`)
   - Create attestation objects
   - Link to message versions via hash
   - Store in Topic structure
   - Handle sync state

3. **Topic Export Service** (`/main/core/topic-export.js`)
   - Export topics with structured data
   - Include all messages and existing attestations
   - Microdata-formatted HTML output
   - Preserve version chains

4. **Audit View Component** (`/electron-ui/src/components/audit/`)
   - Display attestation status per message
   - Show auditor identities
   - Indicate signature completeness
   - QR code display for each version

### Reference Implementation

5. **QR Scanner** (`/reference/lama/qr-scanner.js`)
   - Camera-based QR scanning
   - Parse ONE.core audit URLs
   - Retrieve message by hash
   - Display for verification

### Data Models

6. **Attestation Object**
   ```javascript
   {
     $type$: 'MessageAttestation',
     messageHash: SHA256,
     messageVersion: number,
     attestedContent: string,
     auditorId: personId,
     timestamp: ISO8601,
     signature: SignatureObject
   }
   ```

7. **Topic Export Structure**
   ```html
   <div itemscope itemtype="https://one.core/Topic">
     <div itemprop="message" itemscope itemtype="https://one.core/Message">
       <meta itemprop="hash" content="{SHA256}">
       <meta itemprop="version" content="{number}">
       <div itemprop="attestation" itemscope itemtype="https://one.core/Attestation">
         <!-- Attestation microdata -->
       </div>
     </div>
   </div>
   ```

## Integration Points

### Existing Systems
- ✅ Message versioning system (already implemented)
- ✅ AffirmationCertificate infrastructure
- ✅ ONE.core invite system
- ✅ Access control (person-based)
- ✅ Topic sync via ChannelManager
- ✅ HTML export with structured markup

### New Additions
- 🆕 QR generation for message references
- 🆕 QR scanning in reference/lama
- 🆕 Attestation objects in Topic
- 🆕 Audit view UI components
- 🆕 Microdata consistency for audit exports

## Implementation Phases

### Phase 1: Core Infrastructure
1. Attestation data model
2. Attestation manager
3. Storage in Topic structure

### Phase 2: QR System
1. QR generation service
2. Message hash encoding
3. QR display in UI

### Phase 3: Reference Scanner
1. QR scanner in reference/lama
2. Message retrieval by hash
3. Verification interface

### Phase 4: UI Integration
1. Audit view components
2. Attestation status display
3. Signature completeness indicators

### Phase 5: Export & Import
1. Topic export with attestations
2. Microdata formatting
3. Import verification

## Success Criteria
- Auditors can scan QR codes and view exact message versions
- Attestations are cryptographically signed and immutable
- All participants see attestation status
- Export includes full audit trail in structured format
- System handles version-specific attestations correctly

## Next Steps
1. Review planning with team
2. Create implementation tasks
3. Begin Phase 1 development
4. Set up test scenarios for audit flow