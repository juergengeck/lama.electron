#!/usr/bin/env node

/**
 * Test script for group chat architecture
 * Verifies that messages are properly aggregated across all participant channels
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(message) {
  console.log(`[TEST] ${message}`);
}

async function testGroupChat() {
  log('=== Group Chat Architecture Test ===');
  log('');
  log('EXPECTED BEHAVIOR:');
  log('1. Each participant has their own channel with the same topic ID');
  log('2. Each participant writes ONLY to their own channel');
  log('3. retrieveAllMessages() aggregates from ALL channels');
  log('4. Remote participants create their channels when they discover the group');
  log('');
  log('TEST STEPS:');
  log('1. Start LAMA on Instance 1 (Gecko)');
  log('2. Start LAMA on Instance 2 (Edda)');
  log('3. Ensure both instances are connected via CHUM');
  log('4. Create a group conversation on Instance 1');
  log('5. Send a message from Instance 1');
  log('6. Wait for Instance 2 to discover the group and create its channel');
  log('7. Send a message from Instance 2');
  log('8. Verify both instances see BOTH messages');
  log('');
  log('KEY LOGS TO WATCH FOR:');
  log('- "Found membership in group for topic" - Instance discovers it\'s in a group');
  log('- "Created our channel for topic" - Instance creates its own channel');
  log('- "Granted group access to our channel" - Channel is accessible to group');
  log('- "Found X channels" - Shows how many channels are discovered');
  log('- "Retrieved X messages from TopicRoom" - Shows message aggregation');
  log('');
  log('DEBUGGING COMMANDS:');
  log('- Check channels: await nodeOneCore.channelManager.channels({channelId: topicId})');
  log('- Check messages: await topicRoom.retrieveAllMessages()');
  log('- Check group members: await getObjectsWithType("Group")');
  log('');

  rl.question('Press Enter to continue with manual testing...', () => {
    log('');
    log('MANUAL TEST CHECKLIST:');
    log('[ ] Both instances connected via CHUM');
    log('[ ] Group conversation created');
    log('[ ] Message sent from Instance 1 visible on Instance 1');
    log('[ ] Instance 2 discovered group membership');
    log('[ ] Instance 2 created its own channel');
    log('[ ] Message sent from Instance 2 visible on Instance 2');
    log('[ ] Instance 1 sees message from Instance 2');
    log('[ ] Instance 2 sees message from Instance 1');
    log('');
    log('If all checks pass, the group chat architecture is working correctly!');
    rl.close();
  });
}

testGroupChat().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});