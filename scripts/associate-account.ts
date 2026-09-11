#!/usr/bin/env tsx
/**
 * Associate an account with HTS USDC token on Hedera Testnet
 *
 * This script submits a TokenAssociate transaction to allow the account
 * to hold and transfer USDC tokens for x402 payments.
 *
 * @usage: npx tsx scripts/associate-account.ts <account_id> <private_key> [token_id]
 */

import { AccountId, PrivateKey, Client, TokenType } from '@hiero-ledger/sdk'
import dotenv from 'dotenv'

dotenv.config()

const TOKEN_ID = process.env.USDC_TOKEN_ID || '0.0.429274'

// Parse command line args or read from .env
const accountIdStr = process.argv[2] || process.env.ACCOUNT_ID
const private_keyStr = process.argv[3] || process.env.PRIVATE_KEY

if (!accountIdStr || !private_keyStr) {
  console.error('\nUsage:')
  console.error('  npx tsx scripts/associate-account.ts <account_id> <private_key>')
  console.error('\nOr set in .env:')
  console.error('  ACCOUNT_ID=0.0.xxxxx')
  console.error('  PRIVATE_KEY=<your_private_key>')
  process.exit(1)
}

console.log('\n' + '='.repeat(60))
console.log('TokenAssociate Script for Hedera Testnet')
console.log('='.repeat(60) + '\n')

const account = AccountId.fromString(accountIdStr)
console.log(`Account:     ${account}`)

let privateKey: PrivateKey
try {
  privateKey = PrivateKey.fromString(private_keyStr)
  console.log(`✅ Private key parsed\n`)
} catch (e: any) {
  console.error(`❌ Invalid private key: ${e.message}`)
  process.exit(1)
}

const client = Client.forName('testnet')
client.setOperator(accountIdStr, privateKey)

console.log('\nSubmitting TokenAssociate transaction...')
console.log('This associates the account with USDC token:', TOKEN_ID)

try {
  const txId = TransactionId.generate()
  console.log(`Transaction ID: ${txId}`)

  const tx = client.createTokenAssociateTransaction(TOKEN_ID)
    .setAccountId(account)

  // Set expiry time (2 hours from now for testnet)
  tx.setTransactionID(txId)

  console.log('\nSubmitting to Hedera consensus...')
  await tx.signWith(privateKey).execute(client)

  console.log('\n✅ TokenAssociate transaction submitted!')

  console.log('\nNext steps:')
  console.log('1. Wait ~60 seconds for consensus (testnet is fast)')
  console.log('2. Verify association on: https://hashscan.io/testnet')
  console.log('3. Check that account now has USDC tokens accessible')

} catch (e: any) {
  if (e.message?.includes('TOKEN_ALREADY_ASSOCIATED')) {
    console.error('\n✅ Account already associated with token - no action needed')
  } else if (e.message?.includes('NOT_FOUND')) {
    console.error(`\n❌ Token not found on network: ${TOKEN_ID}`)
    console.error('Make sure this is the correct USDC token ID for testnet')
  } else if (e.message?.includes('INSUFFICIENT_BALANCE')) {
    console.error('\n❌ Account needs HBAR balance to pay gas fees')
  } else {
    console.error(`\n❌ Error submitting TokenAssociate: ${e.message}`)
  }
}

console.log('\nVerifying account status...')
const accounts = client.getAccountInfos([account])
await accounts.execute(client)
const accInfo = accounts.getAt(0)

if (accInfo?.tokens && accInfo.tokens.length > 0) {
  console.log(`✅ Account is now associated with ${accInfo.tokens.length} token(s)`)
} else {
  console.log('⚠️  Token association may still be processing')
}

client.close()
console.log('\nDone.')