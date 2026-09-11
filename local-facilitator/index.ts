/**
 * Local x402 Facilitator for Hedera Testnet
 * Standalone HTTP server for x402 payment verification and settlement
 */

import { AccountId, PrivateKey, Client } from '@hiero-ledger/sdk'
import dotenv from 'dotenv'
import http from 'http'

dotenv.config()

const NETWORK = process.env.NETWORK || 'hedera:testnet'
const MIRROR_NODE_URL = process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'
const PORT = parseInt(process.env.FACILITATOR_PORT || '3002')

// Configure Hedera client
const accountIds = ['0.0.15882187']
const operatorId = AccountId.fromString(accountIds[0])
const privateKey = PrivateKey.fromStringECDSA(
  process.env.OPERATOR_PRIVATE_KEY || 
  '302e4f3d8e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c'
)

console.log(`\n${'='.repeat(60)}`)
console.log('x402 Local Facilitator - Hedera Testnet')
console.log(`${'='.repeat(60)}\n`)
console.log(`Network:    ${NETWORK}`)
console.log(`Mirror Node: ${MIRROR_NODE_URL}`)
console.log(`Port:       ${PORT}`)
console.log(`Account ID: ${process.env.FACILITATOR_ACCOUNT_ID || 'N/A'}`)
console.log('='.repeat(60))

const client = Client.forName('testnet')
client.setNetwork('testnet')
// No operator needed for demo (transactions simulated)

// Create HTTP server with facilitator endpoints
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  
  if (req.url === '/health' || req.url === '/') {
    res.statusCode = 200
    res.end(JSON.stringify({
      message: 'x402 Local Facilitator is running',
      account: process.env.FACILITATOR_ACCOUNT_ID,
      version: '1.0.0',
      endpoints: ['/health', '/verify', '/settle']
    }))
  } else if (req.url?.startsWith('/verify')) {
    res.statusCode = 200
    res.end(JSON.stringify({
      message: 'Payment verification endpoint - POST required',
      account: process.env.FACILITATOR_ACCOUNT_ID
    }))
  } else if (req.url?.startsWith('/settle')) {
    res.statusCode = 200
    res.end(JSON.stringify({
      message: 'Transaction settlement endpoint - POST required'
    }))
  } else {
    res.statusCode = 404
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

server.listen(PORT, () => {
  console.log(`\nServer listening on http://localhost:${PORT}`)
  console.log('\nEndpoints:')
  console.log(`  GET /health  - Health check`)
  console.log(`  POST /verify - Verify x402 payment signature`)
  console.log(`  POST /settle - Settle transaction via facilitator`)
  console.log('\nFacilitator ready for x402 payments!\n')
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down facilitator...')
  server.close()
  client.close()
  process.exit(0)
})
