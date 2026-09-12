/**
 * Story 3.1 — Payment Record Types
 *
 * Defines the canonical payment record structure that all TrustGate features
 * will use for reputation scoring and trust decisions.
 */

export interface PaymentRecord {
  /** Unique transaction identifier from Hedera Mirror Node format */
  transactionId: string

  /** Payer's Hedera account ID (sender of payment) */
  payerAccountId: string

  /** Recipient account ID (where HBAR was transferred) */
  recipientAccountId: string

  /** Payment amount in the smallest unit (e.g., 1000000 for 1 HBAR with 6 decimals) */
  amount: string

  /** Asset type - typically "HBAR" for Hedera native tokens */
  asset: string

  /** Hedera network: testnet or mainnet */
  network: string

  /** Payment status: always SUCCESS for recorded payments */
  status: 'SUCCESS'

  /** Unix timestamp when payment was recorded */
  timestamp: number

  /** Optional: HCS topic information for this record */
  hcsTopicId?: string

  /** Optional: HCS transaction ID when the record was published */
  hcsPublishTxId?: string

  /** Optional: additional metadata about the payment */
  metadata?: Record<string, unknown>
}

export type PaymentRepository = {
  /** Store a new payment record */
  store(record: PaymentRecord): void

  /** Retrieve all stored payment records */
  getAll(): PaymentRecord[]

  /** Check if a specific transaction exists */
  has(transactionId: string): boolean

  /** Get a specific payment record by transaction ID */
  get(transactionId: string): PaymentRecord | undefined
}

/** Default in-memory implementation for storing payment records */
export class InMemoryPaymentRepository implements PaymentRepository {
  private records = new Map<string, PaymentRecord>()

  constructor(private _onRecordAdded?: (record: PaymentRecord) => void) {}

  store(record: PaymentRecord): void {
    // Don't overwrite existing records with the same transaction ID
    if (!this.has(record.transactionId)) {
      this.records.set(record.transactionId, record)

      // Notify observers of new record
      this._onRecordAdded?.(record)
    }
  }

  getAll(): PaymentRecord[] {
    return Array.from(this.records.values())
  }

  has(transactionId: string): boolean {
    return this.records.has(transactionId)
  }

  get(transactionId: string): PaymentRecord | undefined {
    return this.records.get(transactionId)
  }

  clear(): void {
    this.records.clear()
  }
}
