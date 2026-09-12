#!/usr/bin/env tsx
/**
 * Story 3.2 — Demo Script: Publish Payment Record to HCS
 *
 * This script demonstrates:
 * 1. Creating an HCS topic on Hedera Testnet (if needed)
 * 2. Publishing a PaymentRecord as JSON to the HCS topic
 * 3. Logging the HCS transaction/consensus information
 */

import { config } from 'dotenv'
import HcsRepository from '../src/hcs.js'

config()

const NETWORK = process.env.HEDERA_NETWORK || 'testnet'
const HCS_TOPIC_NAME = process.env.HCS_TOPIC_NAME || 'trustgate-payments'
const OPERATOR_ID = process.env.OPERATOR_ID || ''
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY || ''

console.log('\n' + '='.repeat(70))
console.log('Story 3.2 — HCS Payment Record Publishing Demo')
console.log('='.repeat(70) + '\n')

console.log(`Network:      ${NETWORK}`)
console.log(`Topic Name:   ${HCS_TOPIC_NAME}`)
console.log(`Operator ID:  ${OPERATOR_ID || '***'}`)
console.log(`Private Key:  ${OPERATOR_PRIVATE_KEY ? '***SET***' : 'NOT CONFIGURED'}\n`)

/**
 * Sample PaymentRecord (created from Story 3.1)
 */
const samplePaymentRecord: any = {
  transactionId: '0.0.testpayer@1757600000000',
  payerAccountId: '0.0.xxxxx',
  recipientAccountId: '0.0.10464166',
  amount: '1',
  asset: 'HBAR',
  network: 'testnet',
  status: 'SUCCESS',
  timestamp: Date.now(),
}

console.log('Sample PaymentRecord:')
console.log(JSON.stringify(samplePaymentRecord, null, 2) + '\n')

/**
 * Initialize HCS Repository
 */
if (!OPERATOR_ID || !OPERATOR_PRIVATE_KEY) {
  console.log('\n⚠️  HCS Publishing: Operator credentials not configured.')
  console.log('   To enable HCS publishing, set the following in .env:')
  console.log('     OPERATOR_ID=<your-operator-account-id>')
  console.log('     OPERATOR_PRIVATE_KEY=<your-private-key>')
  process.exit(0)
}

// Create HCS repository for testnet
const hcsRepo = new HcsRepository(NETWORK, HCS_TOPIC_NAME) as any

/**
 * Step 1: Create or verify HCS Topic
 */
console.log('\n' + '='.repeat(70))
console.log('Step 1: Create or verify HCS Topic')
console.log('='.repeat(70))

const topicCreated = await hcsRepo.createTopic()
console.log(`\nTopic creation status: ${topicCreated ? 'SUCCESS' : 'FAILED'}\n`)

if (topicCreated) {
  // Get topic info
  const topicInfo = await hcsRepo.getTopicInfo()
  console.log('HCS Topic Information:')
  console.log(`  Topic ID:       ${topicInfo?.topicID?.toString()}#`)
  console.log(`  Topic Status:   ${topicInfo?.status}`)
  console.log(`  Admin Key:      ${topicInfo?.adminKey ? '***SET***' : 'null'}\n`)

  // If topic doesn't exist, try to create it
  if (!topicInfo) {
    console.log('\nHCS Topic does not exist. Attempting to create it...')
    const created = await hcsRepo.createTopic()
    if (created) {
      console.log('✅ HCS Topic created successfully!')
      const info = await hcsRepo.getTopicInfo()
      console.log(`  Topic ID:       ${info?.topicID?.toString()}#`)
      console.log(`  Status:         ${info?.status}\n`)
    } else {
      console.log('⚠️  Could not create HCS topic. Proceeding anyway.')
    }
  }
}

/**
 * Step 2: Publish PaymentRecord to HCS
 */
console.log('\n' + '='.repeat(70))
console.log('Step 2: Publish PaymentRecord to HCS')
console.log('='.repeat(70))

const publishResult = await hcsRepo.publishRecord(samplePaymentRecord)

if (publishResult) {
  console.log('\n✅ PaymentRecord published successfully!\n')
  console.log('HCS Submission Details:')

  // Get the transaction receipt if available
  try {
    const txIdStr = samplePaymentRecord.transactionId || `0.0.testpayer@${Date.now()}`
    const txReceipt = await hcsRepo.client?.getReceipt(
      new (await import('@hiero-ledger/sdk')).TransactionID.fromString(txIdStr)
    )

    console.log(`  Transaction ID:       ${txIdStr}`)
    if (txReceipt) {
      console.log(`  Status:               ${txReceipt.status?.toString()}`)
    }
  } catch (e) {
    // Ignore receipt errors
  }

  console.log('\n🔗 Verify on HashScan:')
  console.log('   Visit: https://hashscan.io/testnet/tx/' + samplePaymentRecord.transactionId)
} else {
  console.log('\n❌ Failed to publish PaymentRecord')
  console.log('   Check operator account balance and HCS topic configuration.')
}

/**
 * Step 3: Verification Instructions
 */
console.log('\n' + '='.repeat(70))
console.log('Step 3: Verification Instructions')
console.log('='.repeat(70))

console.log('\nTo verify the published record on Hedera:')
console.log('1. Visit: https://hashscan.io/testnet/')
console.log('2. Search for the Transaction ID shown above')
console.log('3. View the consensus message (should contain JSON payload)\n')

console.log('To view all records in the HCS topic:')
console.log('  curl -X GET "https://<hcs-node-url>/api/v1/topics/<topic-id>/messages"')
console.log('\nThe published record contains the complete PaymentRecord serialized as JSON.')

// Clean up
hcsRepo.close()

console.log('\nDemo completed.')
process.exit(0)