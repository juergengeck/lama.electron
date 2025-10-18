# Code Signing for macOS

This guide covers how to sign and notarize your LAMA app for macOS distribution.

## Why Sign Your App?

Without signing:
- macOS Gatekeeper blocks the app by default
- Users see "App cannot be opened because it is from an unidentified developer"
- Users must right-click → Open to bypass (first time only)

With signing:
- App opens normally without warnings
- Professional appearance
- Required for distribution outside direct downloads

With notarization (signing + Apple verification):
- No warnings at all
- Required for macOS 10.15+ (Catalina and later)
- Best user experience

## Prerequisites

### 1. Apple Developer Account
- Enroll at https://developer.apple.com/programs/
- Cost: $99/year
- Provides Developer ID certificates for distribution outside the App Store

### 2. Install Xcode Command Line Tools
```bash
xcode-select --install
```

### 3. Developer ID Certificates

You need TWO certificates:
1. **Developer ID Application** - For signing the app
2. **Developer ID Installer** - For signing .pkg installers (optional)

#### Get Certificates

**Option A: Using Xcode (Recommended)**
1. Open Xcode
2. Preferences → Accounts
3. Add your Apple ID
4. Select your team → Manage Certificates
5. Click "+" → "Developer ID Application"
6. The certificate is automatically installed in Keychain

**Option B: Manual from Apple Developer Portal**
1. Go to https://developer.apple.com/account/resources/certificates
2. Create new certificate → "Developer ID Application"
3. Download and double-click to install in Keychain

#### Verify Installation
```bash
# List all Developer ID certificates
security find-identity -v -p codesigning

# You should see something like:
# 1) 1234567890ABCDEF "Developer ID Application: Your Name (TEAMID)"
```

## Configuration

### Step 1: Update electron-builder.yml

Edit `electron-builder.yml` and update the `mac` section:

```yaml
mac:
  category: public.app-category.productivity
  icon: assets/icons/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: assets/entitlements.mac.plist
  entitlementsInherit: assets/entitlements.mac.plist

  # Add these lines for signing:
  identity: "Developer ID Application: Your Name (TEAM_ID)"

  # For notarization (optional but recommended):
  notarize: true

  target:
    - dmg
    - zip
```

**Find your identity string:**
```bash
security find-identity -v -p codesigning
```

Copy the full string in quotes, e.g., `"Developer ID Application: John Doe (ABC123XYZ)"`

### Step 2: Set Up Environment Variables (for Notarization)

Notarization requires your Apple ID credentials. **NEVER commit these to git.**

Create a `.env` file in your project root:
```bash
# .env (add to .gitignore!)
APPLE_ID=your-apple-id@example.com
APPLE_APP_SPECIFIC_PASSWORD=your-app-specific-password
APPLE_TEAM_ID=YOUR_TEAM_ID
```

**Get App-Specific Password:**
1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Security → App-Specific Passwords → Generate Password
4. Label it "electron-builder notarization"
5. Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)

**Find your Team ID:**
1. Go to https://developer.apple.com/account
2. Membership → Team ID

### Step 3: Update .gitignore

Ensure `.env` is ignored:
```bash
echo ".env" >> .gitignore
```

### Step 4: Configure Notarization in electron-builder.yml

```yaml
mac:
  # ... existing config ...
  notarize: {
    teamId: "${APPLE_TEAM_ID}"
  }

afterSign: "scripts/notarize.js"  # Optional custom notarization script
```

Or use automatic notarization (simpler):
```yaml
mac:
  # ... existing config ...
  notarize: true  # electron-builder handles it automatically
```

## Building Signed App

### Without Notarization (Quick)

Just build normally. electron-builder will sign automatically if you've configured the identity:

```bash
npm run dist:mac
```

The app will be signed with your Developer ID certificate.

### With Notarization (Recommended for Distribution)

Update `electron-builder.yml`:
```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
  notarize: {
    teamId: "${APPLE_TEAM_ID}"
  }
```

Set environment variables and build:
```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABC123XYZ"

npm run dist:mac
```

**Note:** Notarization can take 5-15 minutes. electron-builder will:
1. Build the app
2. Sign it
3. Upload to Apple for notarization
4. Wait for Apple's response
5. Staple the notarization ticket to the app

## Verify Signing

### Check if App is Signed
```bash
codesign -dv --verbose=4 release/mac/LAMA.app
```

Should show:
- `Authority=Developer ID Application: Your Name (TEAMID)`
- `Signature=adhoc` means NOT properly signed (wrong!)
- No errors = properly signed

### Check Entitlements
```bash
codesign -d --entitlements - release/mac/LAMA.app
```

### Verify Notarization
```bash
spctl -a -vv release/mac/LAMA.app
```

Should show:
- `accepted` = notarized and will open without warnings
- `rejected` = not notarized, Gatekeeper will block

### Check Gatekeeper Assessment
```bash
spctl --assess --verbose=4 release/mac/LAMA.app
```

## Troubleshooting

### "No identity found"

**Problem:** electron-builder can't find your certificate

**Solutions:**
1. Verify certificate is installed: `security find-identity -v -p codesigning`
2. Check identity string in `electron-builder.yml` matches exactly
3. Ensure certificate is valid (not expired)
4. Try rebuilding Keychain:
   ```bash
   security delete-keychain ~/Library/Keychains/login.keychain-db
   # Restart Mac, login creates new keychain
   # Re-import certificates
   ```

### "errSecInternalComponent"

**Problem:** Keychain access issue

**Solution:**
```bash
# Unlock keychain
security unlock-keychain ~/Library/Keychains/login.keychain-db

# Or build with unlocked keychain
security unlock-keychain -p "your-mac-password" ~/Library/Keychains/login.keychain-db
npm run dist:mac
```

### Notarization Fails

**Problem:** Apple rejects notarization

**Debug:**
1. Check notarization log:
   ```bash
   xcrun notarytool log <submission-id> --apple-id your@email.com --password "xxxx-xxxx-xxxx-xxxx"
   ```

2. Common issues:
   - Missing hardened runtime: Set `hardenedRuntime: true`
   - Missing entitlements: Ensure `entitlements.mac.plist` exists
   - Unsigned dependencies: electron-builder should handle this

### "App is damaged and can't be opened"

**Problem:** macOS quarantine attribute on downloaded app

**Solution (for testing):**
```bash
xattr -cr /path/to/LAMA.app
```

**Proper fix:** Notarize the app. Notarized apps don't get quarantined.

### Signing Takes Forever

**Problem:** Waiting for user to unlock keychain

**Solution:** Unlock keychain before building:
```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

Or create a build-specific keychain (CI/CD):
```bash
security create-keychain -p password build.keychain
security import certificate.p12 -k build.keychain -P cert-password -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -s -k password build.keychain
security list-keychains -s build.keychain
security default-keychain -s build.keychain
security unlock-keychain -p password build.keychain
```

## Distribution Options

### 1. DMG (Recommended)
- Already configured in `electron-builder.yml`
- Users drag app to Applications folder
- Most common distribution method
- Output: `release/LAMA-1.0.0.dmg`

### 2. ZIP
- Also generated by default
- Smaller file size
- Less user-friendly (no visual installer)
- Output: `release/LAMA-1.0.0-mac.zip`

### 3. PKG Installer
- Requires additional configuration
- Allows custom install locations
- Requires "Developer ID Installer" certificate

Add to `electron-builder.yml`:
```yaml
mac:
  target:
    - dmg
    - pkg
```

## CI/CD Integration

For automated builds (GitHub Actions, etc.):

```yaml
name: Build and Sign macOS App

on: [push]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2

      - name: Install certificates
        env:
          CERTIFICATE_P12: ${{ secrets.CERTIFICATE_P12_BASE64 }}
          CERTIFICATE_PASSWORD: ${{ secrets.CERTIFICATE_PASSWORD }}
        run: |
          echo $CERTIFICATE_P12 | base64 --decode > certificate.p12
          security create-keychain -p actions build.keychain
          security import certificate.p12 -k build.keychain -P $CERTIFICATE_PASSWORD -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple: -s -k actions build.keychain
          security list-keychains -s build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p actions build.keychain

      - name: Install dependencies
        run: npm run install:all

      - name: Build and sign
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run dist:mac

      - name: Upload artifacts
        uses: actions/upload-artifact@v2
        with:
          name: macos-installer
          path: release/*.dmg
```

## Testing Signed App

### Local Testing
```bash
# Build signed app
npm run dist:mac

# Install to Applications (don't just run from release/)
cp -R "release/mac/LAMA.app" /Applications/

# Run from Applications
open /Applications/LAMA.app
```

### Test on Fresh Mac
- Copy DMG to another Mac (or VM)
- Double-click DMG
- Drag to Applications
- Try to open

Should open without warnings if properly signed and notarized.

## Summary

**Minimum for testing (no warnings on your Mac):**
1. Get Developer ID Application certificate
2. Add `identity` to `electron-builder.yml`
3. Build: `npm run dist:mac`

**Recommended for distribution (no warnings anywhere):**
1. Get Developer ID Application certificate
2. Get App-Specific Password
3. Configure identity and notarization in `electron-builder.yml`
4. Set environment variables
5. Build: `npm run dist:mac` (waits for notarization)
6. Distribute the DMG

**Quick start script:**
```bash
#!/bin/bash
# build-signed-mac.sh

# Set these first!
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABC123XYZ"

# Unlock keychain to avoid password prompts
security unlock-keychain ~/Library/Keychains/login.keychain-db

# Build signed and notarized app
npm run dist:mac

echo "Build complete! DMG: release/LAMA-*.dmg"
```

Make it executable:
```bash
chmod +x build-signed-mac.sh
```

## Resources

- [Apple Developer Documentation](https://developer.apple.com/support/code-signing/)
- [electron-builder Code Signing Guide](https://www.electron.build/code-signing)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
