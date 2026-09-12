#!/usr/bin/env tsx
/**
 * Story 2.6.4 — Simple x402 Facilitator for Hedera Testnet
 *
 * This is a simplified facilitator that demonstrates the /verify and /settle endpoints.
 * For Story 2.6.4, we focus on proving the API contract works.
 */

import { config } from "dotenv";
import express, { Request, Response } from "express";
import { PaymentRecord, InMemoryPaymentRepository } from "../src/types.js";

config();

const PORT = parseInt(process.env.PORT) || 3002;
const HEDERA_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID || "0.0.10464166";
const MIRROR_NODE_URL = process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com";

console.log('\n' + '='.repeat(70));
console.log('Story 2.6.4 & 3.1 — Simple x402 Facilitator');
console.log('='.repeat(70) + '\n');

console.log(`Network:          ${process.env.HEDERA_NETWORK || 'testnet'}`);
console.log(`Fee Payer Account: ${HEDERA_ACCOUNT_ID}`);
console.log(`Payment Records (Story 3.1): In-memory storage active\n`);

// Initialize in-memory payment repository for Story 3.1
const paymentRepo = new InMemoryPaymentRepository((record) => {
  console.log('✅ New payment record stored:', record.transactionId.substring(0, 50) + '...');
});

const app = express();
app.use(express.json());

/**
 * GET /health - Health check
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    account: HEDERA_ACCOUNT_ID,
    version: "1.0.0",
    endpoints: ["/health", "/verify", "/settle"],
  });
});

/**
 * GET /supported - List supported payment kinds
 */
app.get("/supported", (req: Request, res: Response) => {
  const kinds = [
    {
      x402Version: 1,
      scheme: "exact",
      network: "hedera-testnet",
      extra: { feePayer: HEDERA_ACCOUNT_ID },
    },
    {
      x402Version: 1,
      scheme: "exact",
      network: "hedera-mainnet",
      extra: { feePayer: HEDERA_ACCOUNT_ID },
    },
  ];

  res.json({ kinds });
});

/**
 * GET /verify - Documentation endpoint
 */
app.get("/verify", (req: Request, res: Response) => {
  res.json({
    endpoint: "/verify",
    description: "POST to verify x402 payment payloads",
    method: "POST",
    body: {
      paymentPayload: "PaymentPayload (object)",
      paymentRequirements: "PaymentRequirements (object)",
    },
    response: {
      valid: true,
      message: "string",
    },
  });
});

/**
 * GET /settle - Documentation endpoint
 */
app.get("/settle", (req: Request, res: Response) => {
  res.json({
    endpoint: "/settle",
    description: "POST to settle verified x402 payments",
    method: "POST",
    body: {
      paymentPayload: "PaymentPayload (object)",
      paymentRequirements: "PaymentRequirements (object)",
    },
    response: {
      transactionId: "string",
      status: "string",
    },
  });
});

/**
 * POST /verify - Verify a payment payload
 *
 * This endpoint validates that the payment signature and amounts match expectations.
 * For Story 2.6.4, we demonstrate that the API accepts requests and returns responses.
 */
app.post("/verify", async (req: Request, res: Response) => {
  console.log('\n=== /verify endpoint called ===');

  const body = req.body as any;

  if (!body.paymentPayload || !body.paymentRequirements) {
    console.error('Missing paymentPayload or paymentRequirements in request body');
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Both paymentPayload and paymentRequirements are required',
    });
  }

  const requirements = body.paymentRequirements;
  const payload = body.paymentPayload;

  console.log('Verification Request:');
  console.log(`  Network:   ${requirements.network}`);
  console.log(`  Asset:     ${requirements.assetId || requirements.tokenId}`);
  console.log(`  Amount:    ${requirements.amount}`);

  // For Story 2.6.4 demo, we return a successful verification
  // In production, this would actually verify the signature against Hedera
  const valid = true;

  res.json({
    valid,
    message: 'Payment payload verified successfully',
    transactionId: payload.transactionId || `0.0.testpayer@${Date.now()}`,
  });
});

/**
 * POST /settle - Settle a verified payment
 *
 * This endpoint creates a PaymentRecord for successful payments (Story 3.1).
 * For Story 2.6.4, we demonstrate that the API accepts requests.
 * Note: On testnet, settlement may require additional funding or permissions.
 */
app.post("/settle", async (req: Request, res: Response) => {
  console.log('\n=== /settle endpoint called ===');

  const body = req.body as any;

  if (!body.paymentPayload || !body.paymentRequirements) {
    console.error('Missing paymentPayload or paymentRequirements in request body');
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Both paymentPayload and paymentRequirements are required',
    });
  }

  const requirements = body.paymentRequirements;
  const payload = body.paymentPayload;

  console.log('Settlement Request:');
  console.log(`  Network:   ${requirements.network}`);
  console.log(`  Asset:     ${requirements.assetId || requirements.tokenId}`);
  console.log(`  Amount:    ${requirements.amount}`);
  console.log(`  Transaction ID: ${payload.transactionId || 'N/A'}`);

  // For Story 2.6.4 demo, return a simulated successful settlement
  // In production, this would actually sign and broadcast to Hedera
  const response: PaymentRecord = {
    transactionId: payload.transactionId || `0.0.testpayer@${Date.now()}`,
    payerAccountId: requirements.payerAccountId || HEDERA_ACCOUNT_ID,
    recipientAccountId: requirements.assetId || requirements.tokenId || HEDERA_ACCOUNT_ID,
    amount: requirements.amount || '1',
    asset: 'HBAR',
    network: requirements.network || 'testnet',
    status: 'SUCCESS',
    timestamp: Date.now(),
  };

  // Store the payment record in the repository (Story 3.1)
  paymentRepo.store(response);

  console.log('Settlement Response:');
  console.log(JSON.stringify(response, null, 2));

  res.json(response);
});

/**
 * GET /payments - Retrieve all recorded payment events (Story 3.1)
 */
app.get("/payments", (req: Request, res: Response) => {
  const records = paymentRepo.getAll();

  console.log(`\n=== /payments endpoint called ===`);
  console.log(`Found ${records.length} payment record(s)\n`);

  if (records.length === 0) {
    console.log('No payments recorded yet.');
  } else {
    records.forEach((record, index) => {
      console.log(`\n${index + 1}. Transaction: ${record.transactionId}`);
      console.log(`   Payer:     ${record.payerAccountId}`);
      console.log(`   Recipient: ${record.recipientAccountId}`);
      console.log(`   Amount:    ${record.amount} ${record.asset}`);
      console.log(`   Network:   ${record.network}`);
      console.log(`   Status:    ${record.status}`);
      console.log(`   Timestamp: ${new Date(record.timestamp).toISOString()}`);
    });
  }

  res.json(records);
});

/**
 * Error handling middleware
 */
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Something went wrong',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Facilitator listening at http://localhost:${PORT}`);
  console.log('Supported endpoints:');
  console.log('  GET  /health    - Health check');
  console.log('  GET  /supported - List supported payment kinds');
  console.log('  GET  /verify    - Verify endpoint documentation');
  console.log('  POST /verify    - Verify payment payload');
  console.log('  GET  /settle    - Settle endpoint documentation');
  console.log('  POST /settle    - Settle verified payment\n');
});

export default app;
