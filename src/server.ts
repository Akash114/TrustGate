import express from 'express'
import { CONFIG, validateConfig, createHederaClient } from './config'
import type { AccountId } from '@hiero-ledger/sdk'

// Validate config on startup
validateConfig()

const app = express()

// Initialize Hedera client if credentials are available
let hederaClient: ReturnType<typeof createHederaClient> | null = null
try {
  hederaClient = await createHederaClient()
} catch (error) {
  // Silently handle init failures - the app will continue without Hedera connectivity
}

/**
 * x402 Payment Required header value for /resource endpoint.
 * Uses @x402/core package constants for payment requirements.
 */
const PAYMENT_REQUIRED = 'Payment required'
const PAYMENT_AMOUNT_USDC = 1 // 1 USDC minimum to access the resource
const PAYER_ACCOUNT_ID = CONFIG.operatorId as AccountId

/**
 * Checks if a client has paid for resource access (placeholder check).
 * In future stories, this will verify actual payment status via x402.
 */
function isClientPaid(headers: Record<string, string>): boolean {
  // Future implementation: check @x402 payment status, facilitator response, etc.
  // For now, we use a placeholder to demonstrate the x402 flow
  // Handle both lowercase and uppercase header names (Express normalizes to lowercase)
  const paidValue = headers['x-paid'] || ''
  return paidValue.toLowerCase() === 'true'
}

/**
 * Returns the x402 Payment Required response body with requirements.
 */
function buildPaymentRequiredResponse(): Record<string, unknown> {
  return {
    error: 'Payment Required',
    status: 402,
    message: PAYMENT_REQUIRED,
    paymentRequirements: {
      assetId: '0.0.1739786085', // USDC Testnet token ID (example)
      amount: `${PAYMENT_AMOUNT_USDC}`,
      decimals: 6,
      payerAccountId: PAYER_ACCOUNT_ID,
      network: CONFIG.hederaNetwork,
    },
    message: {
      description: 'Please make a payment to access this resource',
      instructions: `Pay ${PAYMENT_AMOUNT_USDC} ${CONFIG.hederaNetwork === 'testnet' ? 'USDC (Testnet)' : 'USDC'} to access this resource`,
    },
  } as const
}

// Health check endpoint with optional Hedera status
app.get('/health', (req, res) => {
  const healthData = {
    status: 'ok',
    port: CONFIG.port,
    network: CONFIG.hederaNetwork,
    hederaConnected: !!hederaClient,
    operatorId: CONFIG.hasOperatorCredentials() ? '***SET***' : 'not configured',
  }

  res.json(healthData)
})

// x402-Protected resource endpoint
app.get('/resource', (req, res) => {
  const hasPaid = isClientPaid(req.headers as Record<string, string>)

  if (!hasPaid) {
    // Return 402 Payment Required with x402 requirements
    return res.status(402).json(buildPaymentRequiredResponse())
  }

  // Client has paid - return the protected resource
  const resource = {
    success: true,
    message: 'Resource accessed successfully',
    data: {
      secret: 'this-is-a-protected-resource',
      timestamp: new Date().toISOString(),
      x402Version: '2.1',
    },
  }

  res.json(resource)
})

// Catch-all for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Start server
const port = CONFIG.port
app.listen(port, () => {
  console.log(`TrustGate server running on port ${port}`)
  if (hederaClient) {
    console.log('Hedera Testnet client initialized successfully')
  } else {
    console.log('No Hedera client configured - check .env for credentials')
  }
})
