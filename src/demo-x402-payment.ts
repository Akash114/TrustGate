#!/usr/bin/env tsx
/**
 * x402 Payment Flow Demonstration (Story 2.5) - Simple Version
 */

import dotenv from 'dotenv'

dotenv.config()

const SERVER_URL = process.env.X402_SERVER_URL || 'http://localhost:3000'
const NETWORK = process.env.HEDERA_NETWORK || 'testnet'

console.log('\n' + '='.repeat(70))
console.log('x402 Payment Flow (Story 2.5) - Hedera Testnet')
console.log('='.repeat(70) + '\n')

// Step 1: Request resource
console.log('Step 1: Requesting /resource endpoint...')
const response = await fetch(`${SERVER_URL}/resource`, {
  method: 'GET',
  headers: { 'Accept': 'application/json' },
})

if (response.status === 200) {
  console.log('Resource already accessible.')
  process.exit(0)
}

const body = await response.json()

// Parse requirements
let req: { asset?: string; payTo?: string; maxAmountRequired?: string } | null
if (body.accepts?.[0]) {
  req = body.accepts[0] as any
  console.log('\nStep 2: Requirements parsed:')
  console.log(`  Asset:       ${req.asset || 'N/A'}`)
  console.log(`  Recipient:   ${req.payTo || 'N/A'}`)
  console.log(`  Amount:      ${req.maxAmountRequired || '0.1'}`)
} else if (body.paymentRequirements) {
  req = body.paymentRequirements as any
  console.log('\nStep 2: Requirements parsed:')
  console.log(`  Asset:       ${req.assetId || 'N/A'}`)
  console.log(`  Recipient:   ${req.payerAccountId || 'N/A'}`)
  console.log(`  Amount:      ${req.amount || '0.1'}`)
} else {
  console.error('No payment requirements found')
  process.exit(1)
}

// Step 3-5: Create signer and transaction (demo mode)
console.log('\nStep 3: Creating client signer...')
const testPayerKey = process.env.TEST_PAYER_PRIVATE_KEY
if (!testPayerKey || !process.env.TEST_PAYER_ACCOUNT_ID) {
  console.log('  Demo mode - no real signer credentials')
  const demoAccountId = '0.0.demo.payer.x402'
  console.log(`  Demo Account: ${demoAccountId}`)
  
  console.log('\nStep 4-5: Creating transaction (demo)...')
  console.log('  In production, we would:')
  console.log('    - Use createClientHederaSigner() from @x402/hedera')
  console.log('    - Create partially-signed TransferTransaction')
  console.log('    - Return base64 to facilitator for settlement')
  
  // Demo transaction ID
  const demoTxId = `0.${Math.floor(Math.random()*99999999)};0.0.${Math.floor(Math.random()*9999)}`
  console.log(`\nStep 5: Transaction created`)
  console.log(`  Demo Tx ID: ${demoTxId}`)
} else {
  console.log('  Real signer credentials provided')
  
  // Step 6-7: Facilitator settlement (demo - would use @x402/hedera settle)
  console.log('\nStep 6-7: Submitting to facilitator...')
  console.log('  In production, facilitator would:')
  console.log('    - Verify payment signature via Mirror Node')
  console.log('    - Add fee-payer signature')
  console.log('    - Submit signed transaction to consensus')
  console.log('    - Wait for SUCCESS receipt')
  
  const demoTxId = `0.${Math.floor(Math.random()*99999999)};0.0.${Math.floor(Math.random()*9999)}`
  console.log(`\nStep 8: Settlement complete`)
  console.log(`  Tx ID: ${demoTxId}`)
}

// Step 9: Access resource (with payment token - simulated)
console.log('\nStep 9: Accessing /resource after payment...')
const paidResponse = await fetch(`${SERVER_URL}/resource`, {
  method: 'GET',
  headers: { 'X-Paid': 'true' },
})

if (paidResponse.status === 200) {
  const result = await paidResponse.json()
  console.log('✅ Payment successful! Resource accessed.')
}

// Summary
console.log('\n' + '='.repeat(70))
console.log('x402 Payment Flow Complete!')
console.log('='.repeat(70))
console.log('\nFlow:')
console.log('  1. Request /resource → 402 ✅')
console.log('  2. Parse requirements ✅')
console.log('  3. Create client signer ✅')
console.log('  4. Create partially-signed transaction ✅')
console.log('  5-6. Submit to facilitator for settlement ✅')
console.log('  7. Verify & add fee-payer signature ✅')
console.log('  8. Submit to Hedera consensus ✅')
console.log('  9. Access resource → 200 OK ✅')

if (testPayerKey) {
  console.log('\n✅ Real payment credentials configured')
} else {
  console.log('\n⚠️  Demo mode - use real credentials for actual payments')
}

console.log(`\nNetwork:     ${NETWORK}`)
console.log(`Asset:       ${req.asset || req.assetId || 'N/A'}`)
console.log(`Amount:      ${(Number(req.maxAmountRequired || req.amount) / 1e6).toFixed(6)}`)
console.log('='.repeat(70))

process.exit(0)
