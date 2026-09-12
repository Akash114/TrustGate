import express from 'express'
import { CONFIG, validateConfig, createHederaClient } from './config'
import type { AccountId, PaymentRecord } from '@hiero-ledger/sdk'
import HcsRepository from './hcs.js'
import ReputationService, { InMemoryPaymentRepository } from './reputation.js'
import TrustPolicy, { PaymentRoutingLevel } from './trust-policy.js'
import ProtectedPaymentService, {
  ProtectedPaymentIntentStatus,
  type ProtectedPaymentIntent,
} from './protected-payment.js'
import { HederaProtectedPaymentService } from './protected-payment-hcs.js'
import { ScheduleStatusService, createScheduleStatusService } from './schedule-status-service.js'

// Initialize Schedule Status Service for Story 5.3 (lifecycle verification)
const scheduleStatusService = createScheduleStatusService()

// Validate config on startup
validateConfig()

const app = express()

// Body parser middleware - needed for parsing JSON request bodies
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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
 * Initialize HCS publisher if operator credentials are available
 */
let hcsRepository: HcsRepository | null = null
try {
  if (CONFIG.hasOperatorCredentials()) {
    console.log('Initializing HCS Publisher...')
    const network = CONFIG.hederaNetwork || 'testnet'
    const hcsTopicName = process.env.HCS_TOPIC_NAME || 'trustgate-payments'

    // Create a default HCS topic ID for this environment
    const accountIdStr = process.env.HCS_TOPIC_ACCOUNT || '0.0.xxxxx'
    const timestamp = Date.now()
    const topicIdStr = `${accountIdStr}#${timestamp}`

    hcsRepository = new HcsRepository(network, hcsTopicName)

    // Try to create the topic if it doesn't exist
    (hcsRepository as any).createTopic().catch(() => {
      // Ignore errors - topic may already exist or need funding
    })
  } else {
    console.log('HCS Publisher: Operator credentials not configured, skipping HCS initialization')
  }
} catch (error) {
  console.error('HCS Publisher: Failed to initialize:', error instanceof Error ? error.message : error)
}

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
 *
 * CRITICAL: This MUST match exactly what demo-x402-payment.ts will use to build transaction.
 * The assetId here is the recipient account where HBAR payment should go.
 */
function buildPaymentRequiredResponse(): Record<string, unknown> {
  // Use REAL facilitator fee payer account from config/env
  // This ensures x402 requirements match actual Hedera transaction recipient
  const FEE_PAYER_ACCOUNT = CONFIG.getFeePayerAccountId()

  return {
    error: 'Payment Required',
    status: 402,
    message: PAYMENT_REQUIRED,
    paymentRequirements: {
      assetId: FEE_PAYER_ACCOUNT, // Real fee payer/receiver account
      amount: `${PAYMENT_AMOUNT_USDC}`,
      decimals: 6,
      payerAccountId: PAYER_ACCOUNT_ID,
      network: CONFIG.hederaNetwork,
    },
    message: {
      description: 'Please make a payment to access this resource',
      instructions: `Pay ${PAYMENT_AMOUNT_USDC} HBAR (Testnet) to the account specified in paymentRequirements.assetId`,
    },
  } as const
}

// Shared in-memory storage for payment records (Story 3.1, Story 4.1)
const globalPaymentRecords = new Map<string, PaymentRecord>()

/**
 * ReputationService - Simplified version using global storage directly
 */
export default class ReputationService {
  private network: string
  private readonly _onRecordAdded?: (record: PaymentRecord) => void

  constructor(
    public readonly network: string,
    _paymentRepository?: any,
    _onRecordAdded?: (record: PaymentRecord) => void,
  ) {
    this.network = network
    this._onRecordAdded = _onRecordAdded
  }

  /**
   * Calculate reputation metrics for a payer account.
   */
  calculateReputation(payerAccountId: string): ReputationMetrics {
    const records = Array.from(globalPaymentRecords.values())

    // Filter records for this specific payer
    const payerRecords = records.filter(r => r.payerAccountId === payerAccountId)

    // Count successful and failed payments
    const successfulPayments = payerRecords.filter(r => r.status === 'SUCCESS').length
    const failedPayments = payerRecords.filter(r => r.status !== 'SUCCESS').length
    const totalPayments = payerRecords.length

    // Calculate success rate (0 if no payments)
    const successRate = totalPayments > 0 ? successfulPayments / totalPayments : 0

    // Apply MVP scoring rule: score = min(successfulPayments × 10, 100)
    let score = Math.min(successfulPayments * 10, 100)

    return {
      totalPayments,
      successfulPayments,
      failedPayments,
      successRate: parseFloat(successRate.toFixed(4)),
      score,
    }
  }

  /**
   * Get reputation for a specific payer account.
   */
  getReputation(payerAccountId: string): ReputationMetrics {
    if (!payerAccountId) {
      return this.defaultReputation()
    }

    const metrics = this.calculateReputation(payerAccountId)

    // For unknown payers (no records found), return default zero reputation
    if (metrics.totalPayments === 0) {
      return this.defaultReputation()
    }

    return metrics
  }

  /**
   * Store a payment record in global storage.
   */
  store(record: PaymentRecord): void {
    // Don't overwrite existing records with the same transaction ID
    if (!globalPaymentRecords.has(record.transactionId)) {
      globalPaymentRecords.set(record.transactionId, record)

      // Notify observers
      this._onRecordAdded?.(record)
    }
  }

  /**
   * Get all stored payment records.
   */
  getAll(): PaymentRecord[] {
    return Array.from(globalPaymentRecords.values())
  }

  private defaultReputation(): ReputationMetrics {
    return {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      successRate: 0,
      score: 0,
    }
  }
}

// Create and initialize reputation service
let _reputationService: ReputationService | null = null
try {
  console.log('Initializing Reputation Service...')
  const network = CONFIG.hederaNetwork || 'testnet'

  // Create reputation service - reads from globalPaymentRecords directly
  _reputationService = new ReputationService(network)
  console.log('Reputation Service initialized')
} catch (error) {
  console.error('Reputation Service: Failed to initialize:', error instanceof Error ? error.message : error)
}

// Initialize ProtectedPaymentService (Story 5.1 MVP - mock intents)
let _protectedPaymentService: ProtectedPaymentService | null = null
try {
  const network = CONFIG.hederaNetwork || 'testnet'
  _protectedPaymentService = new ProtectedPaymentService(network)
  console.log('ProtectedPaymentService initialized')
} catch (error) {
  console.error('ProtectedPaymentService: Failed to initialize:', error instanceof Error ? error.message : error)
}

// Initialize HederaProtectedPaymentService for scheduled payments (Story 5.2)
let _hederaProtectedPaymentService: HederaProtectedPaymentService | null = null
try {
  const network = CONFIG.hederaNetwork || 'testnet'

  // Create Hedera protected payment service with operator credentials if available
  const scheduleTtlSeconds = parseInt(process.env.SCHEDULE_TTL_SECONDS, 10) || 604800 // Default: 7 days

  _hederaProtectedPaymentService = new HederaProtectedPaymentService(
    network,
    CONFIG.operatorId?.toString(),
    scheduleTtlSeconds,
  )

  console.log('HederaProtectedPaymentService initialized (Story 5.2)')
} catch (error) {
  console.error('HederaProtectedPaymentService: Failed to initialize:', error instanceof Error ? error.message : error)
}

// Initialize TrustPolicy with configurable threshold
let _trustPolicy: TrustPolicy | null = null
try {
  const threshold = parseInt(CONFIG.trustScoreThreshold, 10) || 30
  _trustPolicy = new TrustPolicy(threshold)
  console.log(`TrustPolicy initialized with threshold: ${threshold}`)
} catch (error) {
  console.error('TrustPolicy: Failed to initialize:', error instanceof Error ? error.message : error)
}

// Health check endpoint with optional Hedera status, HCS info, and reputation/service info
app.get('/health', (req, res) => {
  const healthData = {
    status: 'ok',
    port: CONFIG.port,
    network: CONFIG.hederaNetwork,
    hederaConnected: !!hederaClient,
    hcsEnabled: !!hcsRepository,
    reputationEnabled: _reputationService !== null,
    trustEnabled: _trustPolicy !== null,
    protectedPaymentEnabled: _protectedPaymentService !== null,
    hederaScheduledPaymentEnabled: _hederaProtectedPaymentService !== null,
    scheduleTtlSeconds: _hederaProtectedPaymentService?.scheduleTtlSeconds || 0,
    operatorId: CONFIG.hasOperatorCredentials() ? '***SET***' : 'not configured',
    endpoints: [
      '/health',
      '/resource',
      '/payments',
      '/payments/protected',
      '/payments/protected/:intentId',
      '/reputation/:payerAccountId',
      '/trust/:payerAccountId',
    ],
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

/**
 * POST /payments/protected - Create a protected payment intent (Story 5.1 MVP + Story 5.2)
 * When Hedera credentials are configured: creates real Scheduled Transaction
 * When not configured or fails: creates mock intent for testing without network access
 */
app.post('/payments/protected', async (req, res) => {
  try {
    if (!_protectedPaymentService && !_hederaProtectedPaymentService) {
      return res.status(503).json({
        error: 'Protected Payment Service Not Available',
        message: 'The Protected Payment Service is not initialized.',
      })
    }

    const request = req.body
    const { payerAccountId, recipientAccountId, amount, asset, network } = request

    // Validate required fields
    if (!payerAccountId || !recipientAccountId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'payerAccountId, recipientAccountId, and amount are required',
        requiredFields: ['payerAccountId', 'recipientAccountId', 'amount'],
      })
    }

    // Prefer Hedera service for real scheduled transactions if available
    let intent: ProtectedPaymentIntent | ScheduledPaymentIntent

    if (_hederaProtectedPaymentService && _hederaProtectedPaymentService.isConnected()) {
      // Use Hedera to create real scheduled transaction
      const hederaIntent = await _hederaProtectedPaymentService.createScheduledPayment(
        payerAccountId,
        recipientAccountId,
        amount,
        asset || 'HBAR',
      )

      console.log(`Hedera schedule created: ${hederaIntent.intentId}`)
      intent = hederaIntent
    } else if (_protectedPaymentService) {
      // Fallback to mock intent for testing or when Hedera unavailable
      const mockIntent = _protectedPaymentService.createIntent(
        payerAccountId,
        recipientAccountId,
        amount,
        asset || 'HBAR',
        network,
      )

      console.log(`Mock protected payment intent created: ${mockIntent.intentId}`)
      intent = mockIntent
    } else {
      // Edge case: neither service available
      return res.status(503).json({
        error: 'Protected Payment Service Not Available',
        message: 'No protected payment service is initialized.',
      })
    }

    res.status(201).json({
      success: true,
      message: 'Protected payment intent created',
      intentId: intent.intentId,
      ...intent,
    })
  } catch (error) {
    console.error('/payments/protected endpoint error:', error instanceof Error ? error.message : error)

    // Return mock intent on error to allow testing without network access
    if (_protectedPaymentService) {
      const fallbackIntent = _protectedPaymentService.createIntent(
        req.body.payerAccountId,
        req.body.recipientAccountId,
        req.body.amount,
        'HBAR',
      )

      res.status(201).json({
        success: true,
        message: 'Protected payment intent created (fallback to mock)',
        intentId: fallbackIntent.intentId,
        status: ProtectedPaymentIntentStatus.PENDING,
        errorMessage: error instanceof Error ? error.message : String(error),
        isScheduled: false,
        ...fallbackIntent,
      })
    } else {
      res.status(500).json({
        error: 'Failed to create protected payment intent',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
})

/**
 * GET /payments/protected/:intentId - Retrieve a protected payment intent by ID (Story 5.1 MVP + Story 5.2)
 * Returns full Hedera schedule details when scheduled, or mock intent data otherwise.
 */
app.get('/payments/protected/:intentId', async (req, res) => {
  try {
    if (!_hederaProtectedPaymentService && !_protectedPaymentService) {
      return res.status(503).json({
        error: 'Protected Payment Service Not Available',
        message: 'The Protected Payment Service is not initialized.',
      })
    }

    const intentId = req.params.intentId

    // First try to get from Hedera service if available
    let intent: ProtectedPaymentIntent | ScheduledPaymentIntent | undefined

    if (_hederaProtectedPaymentService) {
      intent = _hederaProtectedPaymentService.getIntent(intentId)
    }

    // If not found in Hedera service, try mock service as fallback
    if (!intent && _protectedPaymentService) {
      intent = _protectedPaymentService.getIntent(intentId) || undefined
    }

    // Try to query Hedera blockchain directly for schedule info if real schedule exists
    const hederaScheduleInfo = await (_hederaProtectedPaymentService as any)?.getScheduleOnChain(intentId)

    // Also try ScheduleStatusService for lifecycle verification (Story 5.3)
    let actualHederaStatus: typeof hederaScheduleInfo | null = null

    if (hederaScheduleInfo?.scheduleId) {
      // If we have a real scheduleId, query it via ScheduleStatusService
      try {
        actualHederaStatus = await scheduleStatusService.getStatus(hederaScheduleInfo.scheduleId!)

        // Return with blockchain-verified status from real Hedera
        return res.json({
          success: true,
          intentId: hederaScheduleInfo.intentId || actualHederaStatus.scheduleId,
          scheduleId: actualHederaStatus.scheduleId,
          txId: hederaScheduleInfo.txId,
          network: hederaScheduleInfo.network,
          status: actualHederaStatus.status,
          state: actualHederaStatus.state,
          createdAt: intent?.createdAt,
          isScheduled: true,
        })
      } catch (scheduleQueryError) {
        // If schedule query fails, continue with local storage info
        console.warn('ScheduleStatusService: Failed to query real schedule:',
          scheduleQueryError instanceof Error ? scheduleQueryError.message : String(scheduleQueryError))
      }
    }

    // Return stored intent if found (mock intent or pending)
    if (intent) {
      // For mock intents, ensure scheduleId is null and flag appropriately
      const responseIntent = { ...intent }
      delete responseIntent.scheduleId // Remove for mock intents to avoid confusion
      delete responseIntent.txId

      res.json({
        success: true,
        intentId: responseIntent.intentId,
        ...responseIntent,
        isScheduled: !!hederaScheduleInfo?.scheduleId, // Only true if real schedule exists
        mockIntent: !hederaScheduleInfo?.scheduleId, // Explicitly mark as mock if no real schedule
      })
      return
    }

    // Intent not found - return 404
    res.status(404).json({
      error: 'Protected payment intent not found',
      message: `Intent with ID "${intentId}" does not exist`,
    })

  } catch (error) {
    console.error('/payments/protected/:intentId endpoint error:', error instanceof Error ? error.message : error)

    // Clean error response without sensitive information
    res.status(500).json({
      error: 'Failed to retrieve protected payment intent',
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    // Keep health check clean
  }
})

/**
 * POST /payments - Store a new payment record for reputation tracking (Story 3.1 + Story 3.2)
 */
app.post('/payments', async (req, res) => {
  try {
    const recordData = req.body as Partial<PaymentRecord>

    // Validate required fields
    if (!recordData.transactionId || !recordData.payerAccountId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'transactionId and payerAccountId are required',
      })
    }

    // Store the payment record (if it doesn't already exist)
    const fullRecord = {
      transactionId: recordData.transactionId,
      payerAccountId: recordData.payerAccountId,
      recipientAccountId: recordData.recipientAccountId || '',
      amount: String(recordData.amount || '0'),
      asset: recordData.asset || 'HBAR',
      network: recordData.network || CONFIG.hederaNetwork || 'testnet',
      status: (recordData.status as 'SUCCESS' | 'FAILED') || 'SUCCESS',
      timestamp: recordData.timestamp || Date.now(),
    }

    // Store in global repository (if not already exists)
    if (!globalPaymentRecords.has(fullRecord.transactionId)) {
      globalPaymentRecords.set(fullRecord.transactionId, fullRecord)

      console.log(`Stored payment record: ${fullRecord.transactionId}`)
    } else {
      console.log(`Payment record already exists: ${fullRecord.transactionId}`)
    }

    res.status(201).json({
      success: true,
      message: 'Payment record stored',
      transactionId: fullRecord.transactionId,
    })
  } catch (error) {
    console.error('/payments endpoint error:', error instanceof Error ? error.message : error)
    res.status(500).json({
      error: 'Failed to store payment record',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

/**
 * GET /payments - Retrieve all recorded payment events (Story 3.1 + Story 3.2)
 */
app.get('/payments', async (req, res) => {
  const payments: PaymentRecord[] = []

  // Return stored records
  payments.push(...globalPaymentRecords.values())

  // If HCS is enabled, show HCS topic info
  if (hcsRepository) {
    try {
      const topicInfo = await (hcsRepository as any).getTopicInfo()
      res.json({
        payments,
        count: payments.length,
        hcs: {
          topicName: 'trustgate-payments',
          topicId: topicInfo?.topicID?.toString(),
          enabled: true,
        },
      })
    } catch (e) {
      res.json({
        payments,
        count: payments.length,
        hcs: {
          enabled: true,
          error: e instanceof Error ? e.message : 'Unknown error',
        },
      })
    }
  } else if (payments.length === 0) {
    res.json({
      payments,
      count: 0,
      message: 'No payments recorded yet.',
    })
  } else {
    res.json({ payments, count: payments.length })
  }
})

// GET /reputation/:payerAccountId - Get reputation score for a payer (Story 4.1)
app.get('/reputation/:payerAccountId', (req, res) => {
  const payerAccountId = req.params.payerAccountId

  if (!_reputationService) {
    // Return default zero reputation if service not initialized
    res.status(503).json({
      error: 'Reputation Service Not Available',
      message: 'The Reputation Service is not initialized. Check server logs.',
      data: {
        payerAccountId,
        totalPayments: 0,
        successfulPayments: 0,
        failedPayments: 0,
        successRate: 0,
        score: 0,
      },
    })
    return
  }

  try {
    const reputation = _reputationService.getReputation(payerAccountId)

    res.json({
      payerAccountId,
      ...reputation,
    })
  } catch (error) {
    console.error('Reputation Service: Failed to get reputation for', payerAccountId, error instanceof Error ? error.message : error)
    res.status(500).json({
      error: 'Failed to calculate reputation',
      message: error instanceof Error ? error.message : String(error),
      data: {
        payerAccountId,
        totalPayments: 0,
        successfulPayments: 0,
        failedPayments: 0,
        successRate: 0,
        score: 0,
      },
    })
  }
})

/**
 * GET /trust/:payerAccountId - Get trust-based routing decision (Story 4.2)
 */
app.get('/trust/:payerAccountId', (req, res) => {
  const payerAccountId = req.params.payerAccountId

  if (!_trustPolicy) {
    // Return default protected routing if policy not initialized
    return res.status(503).json({
      error: 'Trust Policy Not Available',
      message: 'The Trust Policy is not initialized. Check server logs.',
      data: {
        payerAccountId,
        score: 0,
        level: PaymentRoutingLevel.NEW,
        paymentPath: 'PROTECTED',
      },
    })
  }

  try {
    // Get reputation to get the score for this payer
    if (_reputationService) {
      const reputation = _reputationService.getReputation(payerAccountId)

      // Use policy to determine routing level based on score
      const decision = _trustPolicy.evaluate(reputation, payerAccountId)

      res.json({
        payerAccountId,
        score: decision.score,
        level: decision.level,
        paymentPath: decision.paymentPath,
      })
    } else {
      // No reputation service - treat as unknown/new
      return res.status(503).json({
        error: 'Reputation Service Not Available',
        message: 'Cannot determine trust level without reputation data.',
        data: {
          payerAccountId,
          score: 0,
          level: PaymentRoutingLevel.NEW,
          paymentPath: 'PROTECTED',
        },
      })
    }
  } catch (error) {
    console.error('Trust Policy: Failed to evaluate for', payerAccountId, error instanceof Error ? error.message : error)
    res.status(500).json({
      error: 'Failed to determine trust level',
      message: error instanceof Error ? error.message : String(error),
      data: {
        payerAccountId,
        score: 0,
        level: PaymentRoutingLevel.NEW,
        paymentPath: 'PROTECTED',
      },
    })
  }
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

  if (hcsRepository) {
    console.log('HCS Publisher ready - payment records can be published to HCS')
  } else {
    console.log('HCS Publisher: Not initialized')
  }
})
