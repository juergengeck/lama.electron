#!/bin/bash

# Update vendor packages for ONE.CORE and ONE.Models
# This script builds and packs the packages from source and copies them to vendor

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PROJECT_ROOT/electron-ui/vendor"
TEMP_DIR="/tmp/one-packages-build"

echo "🚀 Starting vendor package update process..."

# Create vendor directory if it doesn't exist
mkdir -p "$VENDOR_DIR"

# Clean and create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

echo "📦 Building ONE.CORE package..."

# Check if we have local ONE.CORE source
ONE_CORE_SOURCE="${ONE_CORE_SOURCE:-$PROJECT_ROOT/../one-core}"
if [ -d "$ONE_CORE_SOURCE" ]; then
    echo "Found ONE.CORE source at: $ONE_CORE_SOURCE"
    
    # Copy source to temp directory
    cp -r "$ONE_CORE_SOURCE" "$TEMP_DIR/one-core"
    cd "$TEMP_DIR/one-core"
    
    # Install dependencies and build
    echo "Installing dependencies..."
    npm install --production
    
    # Pack the module
    echo "Packing ONE.CORE..."
    npm pack
    
    # Move to vendor with consistent naming
    mv refinio-one.core-*.tgz "$VENDOR_DIR/one-core-nodejs.tgz"
    echo "✅ ONE.CORE packed to vendor/one-core-nodejs.tgz"
else
    echo "⚠️  ONE.CORE source not found at $ONE_CORE_SOURCE"
    echo "   Set ONE_CORE_SOURCE environment variable to point to the source directory"
fi

echo "📦 Building ONE.Models package..."

# Check if we have local ONE.Models source
ONE_MODELS_SOURCE="${ONE_MODELS_SOURCE:-$PROJECT_ROOT/../one-models}"
if [ -d "$ONE_MODELS_SOURCE" ]; then
    echo "Found ONE.Models source at: $ONE_MODELS_SOURCE"
    
    # Copy source to temp directory
    cp -r "$ONE_MODELS_SOURCE" "$TEMP_DIR/one-models"
    cd "$TEMP_DIR/one-models"
    
    # Install dependencies and build
    echo "Installing dependencies..."
    npm install --production
    
    # Apply any necessary fixes
    echo "Applying platform-specific fixes..."
    # Add any necessary patches here
    # For example, fixing Node.js compatibility issues
    
    # Pack the module
    echo "Packing ONE.Models..."
    npm pack
    
    # Move to vendor with consistent naming
    mv refinio-one.models-*.tgz "$VENDOR_DIR/one-models-nodejs-fixed.tgz"
    echo "✅ ONE.Models packed to vendor/one-models-nodejs-fixed.tgz"
else
    echo "⚠️  ONE.Models source not found at $ONE_MODELS_SOURCE"
    echo "   Set ONE_MODELS_SOURCE environment variable to point to the source directory"
fi

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo ""
echo "📋 Vendor packages updated successfully!"
echo "   Location: $VENDOR_DIR"
echo ""
echo "To use different source locations, set these environment variables:"
echo "  ONE_CORE_SOURCE=/path/to/one-core"
echo "  ONE_MODELS_SOURCE=/path/to/one-models"
echo ""
echo "Next steps:"
echo "  1. Run 'npm install' in electron-ui to install from vendor packages"
echo "  2. Commit the updated .tgz files in vendor/"
echo "  3. The node_modules/@refinio folders will be gitignored"