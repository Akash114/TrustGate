#!/usr/bin/env tsx
/**
 * Story 4.1 — Reputation from Payment History
 *
 * Calculates deterministic reputation scores based on payment history.
 * This will be the input to TrustGate's future adaptive payment decisions.
 */

import type { PaymentRecord, PaymentRepository } from './types.js'

interface ReputationMetrics {
  /** Number of total payments made by this payer */
  totalPayments: number

  /** Number of successful payments */
  successfulPayments: number

  /** Number of failed payments (from historical records if available) */
  failedPayments: number

  /** Success rate as a decimal (e.g., 0.95 for 95%) */
  successRate: number

  /**
   * MVP Scoring Rule:
   * score = min(successfulPayments × 10, 100)
   * Unknown payer → score 0
   * 1 successful payment → score 10
   * 5 successful payments → score 50
   * 10+ successful payments → score 100
   */
  score: number
}

/**
 * ReputationService - Calculates and exposes reputation scores from payment history.
 *
 * Uses deterministic MVP scoring rules for consistent reputation calculations.
 * No HCS/network calls are required.
 */
export class ReputationService {
  constructor(
    public readonly network: string,
  ) {}

  /**
   * Calculate reputation metrics for a payer account.
   *
   * @param payerAccountId - The Hedera account ID of the payer to evaluate
   * @returns ReputationMetrics object with all calculated values
   */
  calculateReputation(payerAccountId: string): ReputationMetrics {
    // Read directly from globalPaymentRecords for simplicity
    const records: PaymentRecord[] = Array.from(globalPaymentRecords.values())

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

    // Cap at 100 for consistency
    score = Math.min(score, 100)

    return {
      totalPayments,
      successfulPayments,
      failedPayments,
      successRate: parseFloat(successRate.toFixed(4)), // Keep reasonable precision
      score,
    }
  }

  /**
   * Get reputation for a specific payer account.
   *
   * @param payerAccountId - The Hedera account ID to look up
   * @returns ReputationMetrics object, or zero-score for unknown payers
   */
  getReputation(payerAccountId: string): ReputationMetrics {
    if (!payerAccountId) {
      // Handle missing/invalid payer accountId
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
   * Get default reputation for unknown payers.
   */
  private defaultReputation(): ReputationMetrics {
    return {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      successRate: 0,
      score: 0,
    }
  }

  /**
   * Register a payment record to update repository.
   * Called automatically when server stores new payments.
   */
  registerPayment?: (record: PaymentRecord) => void

  /**
   * Calculate reputation metrics for a payer account.

/**
 * In-memory implementation of PaymentRepository for ReputationService.
 */
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

export default ReputationService
