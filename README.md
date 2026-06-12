# Payment Webhook Handler

A NestJS webhook endpoint that receives payment events from external providers,
verifies their authenticity, and updates order records idempotently.

## Tech Stack

- NestJS + TypeScript
- PostgreSQL
- Prisma ORM
- Zod (validation)
- Prettier + ESLint

## Setup

1. **Install DBngin and create a localhost PostgreSQL database**
   Download [DBngin](https://dbngin.com), add a PostgreSQL database, and start it.

2. **Install Node.js**  
   Download and install it if you haven't already.

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL and WEBHOOK_SECRET
   ```

5. **Run database migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

6. **Start the server**
   ```bash
   npm run start:dev
   ```

## Webhook Endpoint

- **URL**: `POST /webhooks/payment`
- **Header**: `x-webhook-secret: <your-secret>`
- **Body**:
  ```json
  {
    "event_id": "evt_123",
    "event_type": "payment.success",
    "order_id": "ord_456",
    "timestamp": "2024-01-01T00:00:00Z"
  }
  ```

## Testing

A shell script `test-webhooks.sh` is included with `curl` commands covering all the key scenarios.

### How to run

```bash
# Make sure the server is running first
npm run start:dev

# In another terminal
bash test-webhooks.sh
```

### What the script tests

| Test | Description | Expected Response |
|------|-------------|-------------------|
| 1 | Payment success | 200 OK, order status updated to `paid` |
| 2 | Duplicate webhook (same `event_id`) | 200 OK — the duplicate is caught and ignored so the provider stops retrying |
| 3 | Missing secret header | 401 Unauthorized |
| 4 | Invalid secret | 401 Unauthorized |
| 5 | Invalid payload (missing `order_id`) | 401 Unauthorized |
| 6 | Invalid event type | 401 Unauthorized |
| 7 | Order not found | 404 Not Found |
| 8 | Payment failed | 200 OK, order status updated to `failed` |
| 9 | Another new payment success | 200 OK |

### Why these tests matter

- **Test 2** (duplicate) is the most critical. Payment providers often retry webhooks on any non-2xx status. By returning 200 for duplicates, we prevent unnecessary load and avoid double-processing the same event.
- **Tests 3–6** verify the secret and payload validation layers. We return 401 for any malformed request because the provider needs to know something is wrong before retrying.
- **Test 7** checks the case where the order does not exist in our database. We return 404, which signals to the provider that it may want to retry later once the order is created.
- **Tests 8–9** confirm both `payment.success` and `payment.failed` event types are handled correctly and update the order status accordingly.

## Test Commands

```bash
# Unit tests (service + controller)
npm test

# Unit tests with coverage
npm run test:cov

# Unit tests in watch mode
npm run test:watch

# End-to-end tests (requires running database)
npm run test:e2e
```

## Test Files

| File | Type | What It Tests |
|------|------|---------------|
| `src/webhooks/webhooks.service.spec.ts` | Unit | Service logic: idempotency, transaction, order status updates, error cases |
| `src/webhooks/webhooks.controller.spec.ts` | Unit | Controller logic: secret validation, payload parsing, duplicate swallowing |
| `test/webhooks.e2e-spec.ts` | E2E | Full HTTP round-trip: real database + real NestJS app + supertest |

### What the automated tests cover

**Unit tests — `webhooks.service.spec.ts`**
These test the core business logic in isolation. Prisma is mocked so no database is needed.
- `payment.success` → creates a webhook event record and updates the order status to `paid`
- `payment.failed` → creates a webhook event record and updates the order status to `failed`
- Duplicate `event_id` → throws `ConflictException` so the caller knows it was already processed
- Missing order → throws `NotFoundException` so the caller knows the order does not exist

**Unit tests — `webhooks.controller.spec.ts`**
These test the HTTP layer in isolation. The service is mocked.
- Valid webhook with correct secret → returns 200 and `{ success: true }`
- Duplicate webhook (service throws `ConflictException`) → controller catches it and still returns 200 so the provider does not retry
- Missing `x-webhook-secret` header → returns 401
- Invalid secret → returns 401
- Invalid payload (bad event type or missing fields) → returns 401

**End-to-end tests — `webhooks.e2e-spec.ts`**
These test the full stack. A real NestJS app is started and real HTTP requests are sent via `supertest` against the actual PostgreSQL database.
- Full `payment.success` flow → order is created in the DB, webhook is sent, response is 200, order status is updated to `paid`
- Duplicate webhook → same event is sent twice, both return 200, order is only updated once
- Invalid secret → returns 401
- Missing order → returns 404
- `beforeEach` cleans up test orders and webhook events so the suite can be re-run safely

## How It Works

- **Secret verification**: Compares the `x-webhook-secret` header against `WEBHOOK_SECRET`.
- **Validation**: Uses Zod to ensure the payload contains a valid event type and IDs.
- **Idempotency**: Stores every `event_id` in `webhook_events`. Duplicate events return 200 without re-processing.
- **Database update**: Wraps the insert + order update in a transaction to guarantee consistency.

## Assumptions

1. The payment provider sends a unique `event_id` per webhook event.
2. `order_id` in the webhook body maps to the `external_id` column in our `orders` table.
3. The `orders` table is pre-populated by another service; we only update status here.
4. If a duplicate webhook arrives, we return 200 OK (the provider expects this to stop retries).
5. If the secret is missing or invalid, we return 401 Unauthorized.
6. If the order is not found, we return 404 Not Found (the provider may retry).
