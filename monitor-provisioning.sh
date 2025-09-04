#!/bin/bash

# Monitor provisioning time
echo "Monitoring Node provisioning..."
start_time=$(date +%s)

# Wait for provisioning to complete by checking logs
while true; do
    if pgrep -f "electron.*lama" > /dev/null; then
        # Check for completion markers in console output
        if ps aux | grep -q "Node instance provisioned successfully"; then
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            echo "✅ Provisioning completed in ${duration} seconds"
            break
        fi
    else
        echo "Electron app not running"
        break
    fi
    sleep 0.5
done

echo "Done monitoring"