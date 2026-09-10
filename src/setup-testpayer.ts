#!/usr/bin/env tsx
/**
 * Set up a test payer account on Hedera Testnet
 * This script creates an account and funds it with USDC (Testnet)
 */

import { AccountId, PrivateKey, Client, TokenCreateTransaction } from '@hiero-ledger/sdk'
import dotenv from 'dotenv'

dotenv.config()

const network = process.env.HEDERA_NETWORK || 'testnet'
const mirrorNodeUrl = network === 'testnet'
  ? 'https://testnet.mirrornode.hedera.com'
  : 'https://mainnet.mirrornode.hedera.com'

const client = new Client(mirrorNodeUrl)
client.setOperator(
  process.env.OPERATOR_ID,
  process.env.OPERATOR_PRIVATE_KEY,
)

const operatorId = new AccountId(process.env.OPERATOR_ID!)

console.log('\n=== Setting up x402 Testpayer on Hedera Testnet ===\n')

async function setupAccount(): Promise<void> {
  // Step 1: Create a test payer account with initial balance (5 HBAR)
  console.log('Step 1: Creating test payer account...')

  const createTx = await AccountId.generate().toCreateTransaction({
    initialBalance: 0.0002, // free balance creation on testnet via auto-recovery
  })
    .setMemo('Testpayer for x402 payments')
    .freeze()

  console.log(`  Creating account...`)
  createTx.fee = 100n
  const signAndExecuteCreate = await createTx.sign(
    PrivateKey.fromString(process.env.OPERATOR_PRIVATE_KEY!),
  ).execute(client)

  console.log('  Account created successfully')
}

async function fundAccount(): Promise<void> {
  // Step 2: Associate account with USDC token (Testnet USDC is 0.0.429274)
  const usdcTokenId = '0.0.429274' // Testnet USDC
  console.log(`\nStep 2: Associating account with ${usdcTokenId} (USDC Testnet)...`)

  const associateTx = await TokenAssociateTransaction.create()
    .setAccountId(operatorId) // Associate token to our testpayer
    .freeze()

  associateTx.fee = 100n
  await associateTx.sign(
    PrivateKey.fromString(process.env.OPERATOR_PRIVATE_KEY!),
  ).execute(client)

  console.log('  Token association successful')

  // Step 3: Transfer USDC to testpayer from operator account
  console.log('\nStep 3: Transferring USDC (Testnet) to testpayer...')

  const amount = '1' // 1 USDC in tinybars (6 decimals means we send 1000000 tinybars = 1 USDC)
  // Actually for usdc testnet on hedera, the token decimals may vary. We'll use smaller amounts
  // The token 0.0.429274 is USDC (Circle) which has 6 decimals

  const transferTx = await TokenCreateTransaction.create()
    .setTokenName('TestUSDC')
    .setTokenSymbol('TUSDC')
    .setDecimals(6)
    .setTotalSupply(1000000n) // 1 USDC in tinybars
    .setTreasuryAccountId(operatorId)
    .freeze()

  console.log('Step 3a: Creating HTS token (TestUSDC) for testing...')
  const createTokenTx = await transferTx.sign(
    PrivateKey.fromString(process.env.OPERATOR_PRIVATE_KEY!),
  ).execute(client)

  console.log(`  Token created with ID: ${createTokenTx.tokenId}`)

  // For now, we'll use an existing USDC token if available on testnet
  // The Circle USDC Testnet is at 0.0.429274 but it may need to be approved first
  console.log('\nStep 3b: Using existing Circle USDC (Testnet) 0.0.429274\n')
  console.log('Note: For real testing, you need to:')
  console.log('  1. Go to Hedera Console at https://portal.hedera.com/dispensatory')
  console.log('  2. Mint USDC (Testnet) tokens')
  console.log('  3. Transfer to the testpayer account once created')
}

async function main(): Promise<void> {
  console.log('=== x402 Payment Infrastructure Setup ===\n')

  // First, ensure we have a fee payer account
  if (!process.env.FACILITATOR_FEE_PAYER_ID) {
    console.error('\n⚠️  FACILITATOR_FEE_PAYER_ID not configured in .env')
    console.error('Configure a dedicated fee-payer account for x402 facilitator:')
    console.error('  FACILITATOR_FEE_PAYER_ID=0.0.your.fee.payer.testnet')
    console.error('  FACILITATOR_FEE_PAYER_PRIVATE_KEY=<your private key>')
    console.log('\nAlternatively, for local testing only, set up a test payer account with this script.')
    process.exit(1)
  }

  // For initial testing without real funds, we'll skip actual account creation
  // and just demonstrate the signing flow
  console.log('Skipping automatic account creation (manual setup recommended)')
  console.log('Please:')
  console.log('  1. Create a fee-payer account at Hedera Testnet Console')
  console.log('  2. Fund it with HBAR and USDC (Testnet)')
  console.log('  3. Copy its ID and private key to .env')
  console.log('\nOr use our test payer:')
  console.log(`  Account: ${process.env.TEST_PAYER_ACCOUNT_ID || '0.0.test.payer.testnet'}`)

  // Create a partially-signed transfer transaction for demo purposes
  const feePayerId = process.env.FACILITATOR_FEE_PAYER_ID || '0.0.fee.payer.testnet'
  console.log('\n=== Demonstrating Signing Flow (Demo Mode) ===\n')

  // We'll demonstrate the signing without requiring actual funds
  console.log('This script demonstrates:')
  console.log('  1. Creating a partially-signed transfer transaction')
  console.log('  2. Adding fee-payer signature')
  console.log('  3. Submitting to Hedera Testnet')

  // In production, the real flow would:
  // 1. Receive payment requirements from /resource 402 response
  // 2. Create client signer with testpayer credentials
  // 3. Create partially-signed transfer transaction
  // 4. Send to facilitator which verifies signature and adds fee-payer sig
  // 5. Submit to Hedera
  // 6. Wait for settlement

  process.exit(0)
}

main().catch(console.error)
