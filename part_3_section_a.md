# Part 3, Section A: AI-Generated Webhook Handler Review

## Original Code

```typescript
import express from 'express'
import crypto from 'crypto'
import { db } from './db'

const router = express.Router()

router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-signature'] as string
  const secret = process.env.WEBHOOK_SECRET as string
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex')}`

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  try {
    const { event, orderId, status } = req.body

    await db.query(
      `UPDATE orders SET status = '${status}' WHERE id = '${orderId}'`
    )

    res.status(200).json({ received: true })
  } catch (error) {
    console.log(error)
    res.status(200).json({ received: true })
  }
})

export default router
```

---

## Identified Problems

### 1. SQL Injection via String Interpolation
**Risk:** The query interpolates `status` and `orderId` directly from the request body into the SQL string. An attacker can send crafted payloads to alter the query structure, exfiltrate data, or destroy the database.

**Example payload:**
```json
{
  "status": "paid'; DROP TABLE orders; --",
  "orderId": "123"
}
```

**Fix:** Use parameterized queries so the database driver treats user input as data, not executable SQL.

---

### 2. Timing Attack on Signature Comparison
**Risk:** The standard `!==` string comparison short-circuits at the first mismatched character. An attacker can measure response times to brute-force the correct signature byte-by-byte, bypassing the HMAC verification entirely.

**Fix:** Use `crypto.timingSafeEqual` to compare the signature and expected digest in constant time. Buffer lengths must also match before comparison to avoid leaking length information.

---

### 3. HMAC Computed on Re-serialized JSON Instead of Raw Body
**Risk:** The signature is verified against `JSON.stringify(req.body)`. Express body parsing can change whitespace, key ordering, or encoding. A legitimate webhook may fail verification because the re-serialized string no longer matches the exact bytes the sender signed. Conversely, some parsing edge cases could theoretically allow a payload that serializes back to a safe-looking object while the raw bytes were tampered with.

**Fix:** Verify the signature against the raw request body bytes before JSON parsing. This requires a `verify` hook in the Express JSON middleware (or equivalent) to capture the raw buffer.

---

### 4. Error Handler Returns 200 and Swallows Failures
**Risk:** If the database query fails, the catch block still responds with HTTP 200. The webhook provider (e.g., Stripe, PayPal) interprets this as successful delivery and will not retry. The payment system ends up in an inconsistent state: the provider thinks the event was acknowledged, but the local order record was never updated.

**Fix:** Log the error and return a 5xx status so the provider retries the webhook until the database update succeeds.

---

### 5. (Bonus) No Idempotency Guard
**Risk:** Webhook providers can deliver the same event more than once (retries, network issues). Without deduplication, the same order status update runs multiple times, which can cause inconsistent state in a payment system.

**Fix:** Store processed event IDs in a separate table and check before processing. Wrap the check and update in a single transaction to prevent race conditions if the same event arrives simultaneously.

---

## Corrected Code

```typescript
import express, { Request, Response } from 'express'
import crypto from 'crypto'
import { db } from './db'

const router = express.Router()

// Extend Express so middleware can attach the raw body buffer for signature verification.
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer
    }
  }
}

router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-signature'] as string | undefined
  const secret = process.env.WEBHOOK_SECRET

  if (!signature || !secret) {
    return res.status(401).json({ error: 'Missing signature or secret' })
  }

  if (!req.rawBody) {
    return res.status(400).json({ error: 'Raw body not available' })
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex')}`

  // 2. Timing-safe comparison
  const signatureBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expected)

  if (signatureBuf.length !== expectedBuf.length) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  try {
    const { orderId, status } = req.body

    if (!orderId || !status) {
      return res.status(400).json({ error: 'Missing orderId or status' })
    }

    // 1. Parameterized query prevents SQL injection
    await db.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      [status, orderId]
    )

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    // 4. Return 500 so the provider retries the webhook
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

### Required App-Level Middleware

The router above assumes the raw request body is available on `req.rawBody`. Configure the Express application-level JSON parser like this:

```typescript
app.use(express.json({
  verify: (req: Request, _res: Response, buf: Buffer) => {
    req.rawBody = buf
  }
}))
```

If the webhook endpoint is mounted *before* the global JSON parser, or if you prefer to isolate the raw body requirement to this route, you can mount `express.raw({ type: 'application/json' })` specifically on `/webhook` and parse JSON manually inside the handler. Either approach satisfies the requirement that the HMAC is computed over the exact bytes the sender signed.
