# Vendor Package Management

This document describes how LAMA manages the ONE.CORE and ONE.Models dependencies using local vendor packages.

## Overview

LAMA uses pre-built `.tgz` packages stored in the `electron-ui/vendor/` directory for ONE.CORE and ONE.Models dependencies. This approach provides:

- **Version Control**: Exact versions are committed to the repository
- **Build Consistency**: All developers use the same package builds
- **Offline Development**: No need to fetch from remote registries
- **Custom Patches**: Ability to apply platform-specific fixes

## Directory Structure

```
lama.electron/
├── scripts/
│   ├── update-vendor-packages.js    # Build script for vendor packages
│   └── update-vendor-packages.sh    # Bash alternative
├── electron-ui/
│   ├── vendor/                      # Vendor packages (committed to git)
│   │   ├── one-core-nodejs.tgz
│   │   └── one-models-nodejs-fixed.tgz
│   └── node_modules/
│       └── @refinio/                # Installed packages (gitignored)
│           ├── one.core/
│           └── one.models/
```

## Workflow

### 1. Initial Setup

When cloning the repository, the vendor packages are already included. Simply run:

```bash
npm install:all
```

This will:
- Install main dependencies
- Install electron-ui dependencies from vendor packages
- The `@refinio/one.core` and `@refinio/one.models` folders in node_modules are automatically gitignored

### 2. Updating Vendor Packages

If you need to update ONE.CORE or ONE.Models from source:

```bash
# Set source locations (optional, defaults to ../one-core and ../one-models)
export ONE_CORE_SOURCE=/path/to/one-core
export ONE_MODELS_SOURCE=/path/to/one-models

# Run the update script
npm run update-vendor
```

This will:
1. Build ONE.CORE from source
2. Build ONE.Models from source
3. Create `.tgz` packages
4. Copy them to `electron-ui/vendor/`
5. You can then commit the updated `.tgz` files

### 3. Package References

The packages are referenced in `electron-ui/package.json`:

```json
{
  "dependencies": {
    "@refinio/one.core": "file:vendor/one-core-nodejs.tgz",
    "@refinio/one.models": "file:vendor/one-models-nodejs-fixed.tgz"
  }
}
```

## Git Strategy

### What's Committed
- ✅ `electron-ui/vendor/*.tgz` - Pre-built package archives
- ✅ `scripts/update-vendor-packages.js` - Build automation
- ✅ `.gitignore` - Excludes installed packages

### What's Ignored
- ❌ `node_modules/@refinio/one.core/` - Installed from vendor
- ❌ `node_modules/@refinio/one.models/` - Installed from vendor
- ❌ All other node_modules

## Benefits

1. **Reproducible Builds**: Everyone uses the exact same package builds
2. **Faster CI/CD**: No need to build packages during deployment
3. **Version Pinning**: Exact control over dependency versions
4. **Custom Fixes**: The "fixed" versions can include platform-specific patches
5. **Offline First**: Works without internet connection after initial clone

## Troubleshooting

### Package Installation Issues

If packages aren't installing correctly:

```bash
# Clean and reinstall
rm -rf node_modules electron-ui/node_modules
npm run install:all
```

### Building from Source

If you need to build from source but don't have the source code:

1. Clone the ONE.CORE repository
2. Clone the ONE.Models repository
3. Set environment variables to point to them
4. Run `npm run update-vendor`

### Version Conflicts

If you see version conflicts:

1. Check that vendor packages match expected versions
2. Clear npm cache: `npm cache clean --force`
3. Reinstall: `npm run install:all`

## Development Tips

- Always commit `.tgz` files after updating vendor packages
- Document any patches applied in the "fixed" versions
- Test on all platforms after updating vendor packages
- Keep vendor packages as small as possible (production dependencies only)