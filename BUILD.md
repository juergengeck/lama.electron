# Building LAMA Installers

This document describes how to create installable packages for Windows and macOS.

## Prerequisites

- Node.js and npm installed
- All project dependencies installed (`npm run install:all`)
- For macOS builds: macOS machine (required for .dmg creation and code signing)
- For Windows builds: Can build on any platform, but recommended on Windows for testing

## Quick Start

Build installers for your current platform:
```bash
npm run dist
```

## Platform-Specific Builds

### Windows Installer (NSIS)
Creates a one-click installer for Windows:
```bash
npm run dist:win
```

Output: `release/LAMA-Setup-1.0.0.exe`
- One-click installation (no wizard)
- Installs for current user only (no admin rights needed)
- Creates desktop and start menu shortcuts
- ~100-200MB installer size

### Windows Portable
Creates a portable executable that doesn't require installation:
```bash
npm run dist:win-portable
```

Output: `release/LAMA-1.0.0-Portable.exe`
- No installation required
- Can run from USB drive or any folder
- Ideal for users without install permissions

### macOS DMG
Creates a macOS disk image installer:
```bash
npm run dist:mac
```

Outputs:
- `release/LAMA-1.0.0.dmg` - Disk image installer
- `release/LAMA-1.0.0-mac.zip` - ZIP archive

Note: Building on macOS is required for proper .dmg creation and code signing.

### Linux Packages
Creates Linux installers:
```bash
npm run dist:linux
```

Outputs:
- `release/LAMA-1.0.0.AppImage` - Universal Linux package
- `release/lama_1.0.0_amd64.deb` - Debian/Ubuntu package

### Build All Platforms
Build installers for all platforms (requires macOS for Mac builds):
```bash
npm run dist:all
```

## Build Process

The build process consists of:

1. **Compile TypeScript** (`npm run build:main`)
   - Compiles main process TypeScript to JavaScript
   - Copies preload script and MCP services

2. **Build React UI** (`npm run build:ui`)
   - Builds production React frontend
   - Outputs to `electron-ui/dist/`

3. **Package with electron-builder**
   - Bundles application with Electron
   - Creates platform-specific installers
   - Applies icons and metadata

## Build Output

All installers are created in the `release/` directory:

```
release/
├── LAMA-Setup-1.0.0.exe          # Windows NSIS installer
├── LAMA-1.0.0-Portable.exe       # Windows portable
├── LAMA-1.0.0.dmg                # macOS disk image
├── LAMA-1.0.0-mac.zip            # macOS ZIP
├── LAMA-1.0.0.AppImage           # Linux AppImage
└── lama_1.0.0_amd64.deb          # Debian package
```

## Configuration

Build configuration is in `electron-builder.yml`:

- **App ID**: `com.lama.app`
- **Product Name**: LAMA
- **Icons**: `assets/icons/` (auto-generated from `assets/icon.svg`)
- **Entitlements**: `assets/entitlements.mac.plist` (macOS permissions)

## Icon Generation

Icons are pre-generated from the SVG source. To regenerate:

```bash
npm run generate-icons
```

This creates:
- `icon.ico` - Windows icon (multi-size)
- `icon.icns` - macOS icon bundle
- `icon-{16,32,64,128,256,512,1024}.png` - PNG icons for Linux

## Code Signing

### macOS
To distribute outside the App Store, you'll need:
1. Apple Developer ID certificate
2. Update `electron-builder.yml` with your certificate identity

```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
```

### Windows
To avoid "Unknown Publisher" warnings:
1. Obtain a code signing certificate
2. Configure in `electron-builder.yml`:

```yaml
win:
  certificateFile: path/to/certificate.pfx
  certificatePassword: ${env.CERTIFICATE_PASSWORD}
```

## Troubleshooting

### Build fails with "Cannot find module"
- Run `npm run install:all` to install all dependencies
- Ensure both root and `electron-ui/` have node_modules

### macOS .icns file not created
- Requires macOS with `iconutil` command
- Run `npm run generate-icons` on macOS

### Windows .ico file is low quality
- Install ImageMagick for multi-size .ico generation
- Or use a third-party tool to create a proper multi-size .ico

### "Application cannot be opened" on macOS
- App needs to be code-signed for distribution
- Users can bypass with: Right-click → Open (first time only)

### Large installer size
- Normal for Electron apps (includes Chromium)
- Windows: ~100-150MB
- macOS: ~150-200MB
- Can be reduced with asar compression (already enabled)

## Distribution

### macOS
- Notarize with Apple for Gatekeeper approval
- Or instruct users to right-click → Open on first launch

### Windows
- Code sign to avoid SmartScreen warnings
- Or users must click "More info" → "Run anyway"

### Linux
- AppImage works on most distributions without installation
- .deb for Debian/Ubuntu systems

## CI/CD Integration

For automated builds, use GitHub Actions or similar:

```yaml
- name: Build installers
  run: npm run dist:all

- name: Upload artifacts
  uses: actions/upload-artifact@v2
  with:
    name: installers
    path: release/*
```

## Version Management

Update version in `package.json`:
```json
{
  "version": "1.0.0"
}
```

This version is automatically used in installer filenames.
