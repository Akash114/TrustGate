import { config } from 'dotenv'

config()

export const CONFIG = {
  port: parseInt(process.env.PORT, 10) ?? 3000,

  // Hedera Configuration (future)
  hederaNetwork: process.env.HEDERA_NETWORK,
  facilitatorUrl: process.env.FACILITATOR_URL,
  hcsNodeUrl: process.env.HCS_NODE_URL,
}

export function validateConfig(): void {
  // Minimal validation - only port is required for MVP
  if (CONFIG.port <= 0 || CONFIG.port > 65535) {
    throw new Error('Invalid PORT configuration')
  }
}
