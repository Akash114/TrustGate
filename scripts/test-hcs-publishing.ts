#!/usr/bin/env tsx
/**
 * Test HCS publishing functionality
 */

import { config } from 'dotenv'
config()

import HcsRepository from '../src/hcs.js'

async function testHcsPublishing() {
  console.log('\n=== Testing HCS Publishing ===\n')

  const repo = new HcsRepository('testnet', 'trustgate-payments')

  // Test 1: Check if operator credentials are available
  if (process.env.OPERATOR_PRIVATE_KEY) {
    console.log('✅ Operator credentials configured')
  } else {
    console.log('❌ No operator credentials - HCS publishing not available')
    return false
  }

  // Test 2: Try to get topic info or create topic
  console.log('\n--- Attempting to create/get HCS topic ---')

  const topicExists = await repo.getTopicInfo()
  if (topicExists) {
    console.log('✅ Topic exists:', topicExists.topicID.toString())
  } else {
    console.log('ℹ️  Topic not found, attempting to create...')

    const created = await repo.createTopic()
    if (created) {
      console.log('✅ Topic created successfully')
    } else {
      console.log('⚠️  Could not create topic (may need account balance or permissions)')
    }
  }

  // Test 3: Try to publish a test payment record
  const testRecord = {
    transactionId: '0.0.testpayer@1234567890',
    payerAccountId: '0.0.testpayer.demo',
    recipientAccountId: '0.0.10464166',
    amount: '1',
    asset: 'HBAR',
    network: 'testnet',
    status: 'SUCCESS',
    timestamp: Date.now()
  }

  console.log('\n--- Attempting to publish test record ---')
  const success = await repo.publishRecord(testRecord)

  if (success) {
    console.log('✅ HCS publishing working!')
  } else {
    console.log('⚠️  Could not publish record - check operator account balance and permissions')
  }

  return success
}

testHcsPublishing()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
