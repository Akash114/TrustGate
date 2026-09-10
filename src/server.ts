import express from 'express'
import { CONFIG, validateConfig } from './config'

// Validate config on startup
validateConfig()

const app = express()

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Catch-all for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Start server
const port = CONFIG.port
app.listen(port, () => {
  console.log(`TrustGate server running on port ${port}`)
})
