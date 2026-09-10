import { createClientHederaSigner, createHederaVerifyPayerSignature, createHederaSignAndSubmitTransaction, mirrorNodeUrlForNetwork } from '@x402/hedera'
import type { PrivateKey, Client } from '@hiero-ledger/sdk'

const CONFIG = {
  network: process.env.HEDERA_NETWORK || 'testnet',
  accountId: process.env.PAYER_ACCOUNT_ID || '',
  privateKey: process.env.PAYER_PRIVATE_KEY || '',
  facilitatorUrl: process.env.FACILITATOR_URL,
}

// Create client signer from account credentials
export async function createClientSigner(): Promise<{
  signer: ReturnType<typeof createClientHederaSigner>
  mirrorNodeUrl: string
}> {
  const accountId = CONFIG.accountId
  const privateKey = CONFIG.privateKey ? PrivateKey.fromString(CONFIG.privateKey) : undefined

  if (!accountId || !privateKey) {
    throw new Error('Missing PAYER_ACCOUNT_ID or PAYER_PRIVATE_KEY in .env')
  }

  const signer = createClientHederaSigner(accountId, privateKey, { network: CONFIG.network })
  const mirrorNodeUrl = mirrorNodeUrlForNetwork(CONFIG.network)

  return { signer, mirrorNodeUrl }
}

// Build facilitator from the signer
export async function buildFacilitator(clientSigner: Awaited<ReturnType<typeof createClientSigner>>): Promise<{
  signAndSubmitTransaction: NonNullable<ReturnType<typeof createHederaVerifyPayerSignature>['verifyPayerSignature']>
  verifyPayerSignature: ReturnType<typeof createHederaVerifyPayerSignature>
}> {
  const feePayerKey = PrivateKey.generate() // Generate a new key for the facilitator

  return {
    signAndSubmitTransaction: (async (transactionBase64, feePayer, network) => {
      // Build SDK client for settlement
      const client = Client.fromUrl(mirrorNodeUrlForNetwork(network))
      const response = await client.submitTransaction({
        transactionBytes: Buffer.from(transactionBase64, 'base64'),
      })

      // Get receipt (throws on non-SUCCESS)
      const receipt = await response.getReceipt(client)

      if (!receipt.success) {
        throw new Error(`Settlement failed: ${receipt.statusError?.message || 'Unknown failure'}`)
      }

      return { transactionId: receipt.transactionId! }
    }) as any,
    verifyPayerSignature: createHederaVerifyPayerSignature({
      mirrorNodeUrl: mirrorNodeUrlForNetwork(CONFIG.network),
    }),
  }
}
