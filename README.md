# TrueVibe Payment Webhook Handler

A NestJS webhook endpoint that receives payment events from external providers,
verifies their authenticity, and updates order records idempotently.

## Tech Stack

- NestJS + TypeScript
- PostgreSQL
- Prisma ORM
- Zod (validation)
- Prettier + ESLint

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL and WEBHOOK_SECRET
   ```

3. **Run database migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Start the server**
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
7. The `WEBHOOK_SECRET` environment variable is optional in development but required in production.
