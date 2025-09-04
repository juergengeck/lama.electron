#!/bin/bash

# LAMA CLI - Wrapper for refinio.cli with LAMA commands
# Usage: ./lama-cli.sh <command>
# Example: ./lama-cli.sh lama start

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONFIG_FILE="$SCRIPT_DIR/refinio-cli.config.json"
CLI_PATH="$SCRIPT_DIR/packages/refinio.cli"

# Check if refinio.cli is built
if [ ! -d "$CLI_PATH/dist" ]; then
  echo "Building refinio.cli..."
  cd "$CLI_PATH" || exit 1
  npm install
  npm run build
  cd "$SCRIPT_DIR" || exit 1
fi

# Export config path
export REFINIO_CONFIG="$CONFIG_FILE"

# Run refinio.cli with our config
# This is equivalent to running: refinio lama <subcommand>
node "$CLI_PATH/dist/cli.js" "$@"