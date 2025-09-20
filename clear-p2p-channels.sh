#!/bin/bash

# Clear the P2P channel with owner (we should only have null-owner channel)
# This removes the incorrectly created channel with owner

P2P_CHANNEL="650f45cb60c75bf0e41df3d7ea78540e123bee27fc31f7e36e6f4e4085a5d1d3<->a7d32c245ff4770ba84bb83217aa45d9bb89fd7c5a29ac1f33429f3f7cf30e54"
OWNER="a7d32c24"

echo "Clearing P2P channel with owner..."

# Find and remove channel info objects with owner
find OneDB -name "*.Object.ChannelInfo" -type f | while read file; do
  if grep -q "$P2P_CHANNEL" "$file" && grep -q "$OWNER" "$file"; then
    echo "Removing: $file"
    rm -f "$file"
  fi
done

echo "Done. The P2P channel should now only have null-owner channel."