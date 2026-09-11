---
name: payment-demo-real-hedera-verification
description: Acceptance criteria for real Hedera transaction verification in payment demo
metadata:
  type: feedback
---

## Story 2.6.1 - Remove Payment Simulation and Verify Real Hedera Submission

### Changes Made to src/demo-x402-payment.ts

**Removed simulated/fake behaviors:**
- ❌ Removed fake Transaction ID generation (lines 86-91 old)
  - Now uses `client.submitTransaction()` which returns REAL SDK-generated TxId
- ❌ Removed "simplified approach" fallback (old line 164)
  - Script now fails with error when transaction building fails
- ❌ Removed premature "SETTLED" claims without confirmation check
- ❌ Removed X-Paid bypass simulation

**Added real Hedera verification:**
- ✅ Uses `@hiero-ledger/sdk` to submit actual HBAR transfer transactions
- ✅ Calls `client.submitTransaction()` which returns REAL Hedera-generated TransactionId
- ✅ Polls Hedera mirror node until transaction shows SUCCESS status
- ✅ Checks `status` and `eventFlags` from mirror node response
- ✅ Exits with code 1 if transaction FAILED or PENDING on Hedera
- ✅ Only prints "CONFIRMED ✅" after actual Hedera consensus confirmation

**Added balance verification:**
- ✅ Fetches account balance from Hedera mirror node before attempting payment
- ✅ Exits with clear error if `balance < amount + 0.00001`
- ✅ Provides funding instructions (testnet.cobify.io faucet link)

### Exit Codes and Behavior

| Condition | Exit Code | Message |
|-----------|-----------|---------|
| Transaction confirmed on Hedera | 0 | "PAYMENT SUCCESSFUL" + "CONFIRMED ✅" |
| Transaction FAILED on Hedera | 1 | "PAYMENT failed" + error details |
| Transaction PENDING on Hedera | 1 | Error waiting for consensus |
| Insufficient HBAR balance | 1 | "Insufficient HBAR balance!" + funding instructions |
| Account not found | 1 | "Your payer account does not exist" |
| Invalid private key | 1 | "Invalid private key format" |
| No client configured | 1 | "Cannot submit payment: No Hedera client" |

### Key Implementation Details

**REAL Transaction ID:** The SDK's `submitTransaction()` method automatically generates and submits the transaction, returning a real `TransactionId` from the consensus layer. This is different from manually constructing `0.0.{realm};0.0.{sequence}` which was previously generated randomly.

**Transaction Verification Flow:**
1. Submit transaction via `client.submitTransaction(txBuilder.freezeWith())`
2. Poll mirror node at `/api/v1/transactions/{txId}` with 3s retry on 404
3. Check `status` field: must contain "SUCCESS" or have no eventFlags (successful)
4. If status contains "FAILURE": exit(1) with failure details
5. If status is "PENDING": exit(1) asking user to retry

**Balance Check:** The script fetches account balance from mirror node and ensures it's sufficient before attempting payment. This prevents wasted transaction fees on failed attempts due to insufficient funds.

### Testing Instructions

Before running the demo, fund your testnet account:
```bash
# Go to https://testnet.cobify.io/ and use the faucet
# Or create a new account via Hedera Explorer testnet

# Required .env variables:
TEST_PAYER_ACCOUNT_ID=0.0.your-account-id-here
TEST_PAYER_PRIVATE_KEY=your-private-key-from-https://devnet.mirrornode.hedera.com/...
```

Run the demo:
```bash
npm run demo-payment
```

Expected output on success shows real Hedera Transaction ID and "CONFIRMED ✅" status.

### Related Files

- src/demo-x402-payment.ts - Payment execution script (modified)
- src/config.ts - Configuration with `@hiero-ledger/sdk` client initialization
- package.json - Dependencies include `@hiero-ledger/sdk: ^2.85.0`