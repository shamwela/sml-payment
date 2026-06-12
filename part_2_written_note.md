# Part 2, Written Note — Payment Webhook Handler

## 1. What I built

A NestJS `POST /webhooks/payment` endpoint that receives webhook events from external payment providers, verifies the request, and updates an order status in PostgreSQL.

**Key decisions:**

- **Idempotency via `event_id`**: Every incoming event ID is stored in a `webhook_events` table. If the same `event_id` arrives again, we return 200 OK immediately so the provider stops retrying. This prevents double-processing and double-charging.
- **Database transaction**: The webhook event insert and the order update are wrapped in a single Prisma transaction. Either both succeed or both roll back.
- **Zod for validation**: Payload shape and event types are validated with Zod before any database work. Only `payment.success` and `payment.failed` are accepted.
- **Secret header verification**: The `x-webhook-secret` header is checked against a `WEBHOOK_SECRET` env var. Missing or invalid secrets return 401.
- **Duplicate handling at the controller layer**: The service throws `ConflictException` for duplicates, but the controller catches it and still returns 200. This isolates the business logic ("this is a duplicate") from the HTTP contract ("provider must receive 2xx").

## 2. What I would do differently with more time

1. **Use a proper signature instead of a shared secret header** — A shared secret is simple but the provider should ideally sign the payload with HMAC-SHA256 so we can verify the exact body was not tampered with in transit.
2. **Add a webhook replay/audit log** — Instead of a simple `webhook_events` table, store the full request body, headers, and response. This is invaluable for debugging provider disputes.
3. **Handle provider retries with exponential backoff awareness** — Track the number of retry attempts and alert if the same event is retried unusually many times.
4. **Add a background job queue** — If the order update is slow or a downstream service is down, we should queue the update and ack the webhook immediately. A provider timeout usually causes a retry.
5. **Idempotency key should be composite** — `event_id` alone is fine if the provider guarantees uniqueness, but a composite of `event_id + provider` is safer if we ever integrate multiple providers.
6. **Add metrics and alerts** — Track webhook volume, error rates, duplicate rates, and DB latency. Alert on spikes or elevated 401/404 rates.

## 3. Questions I would want answered before deploying

1. **What is the provider's retry policy?** — How many retries, what backoff schedule, and what happens if all retries fail? This determines whether our 404 handling is safe or if we need a dead-letter queue.
2. **Is `event_id` globally unique across the provider's lifetime?** — If event IDs are only unique within a 24-hour window, our idempotency table will leak or need TTL cleanup.
3. **What is the expected latency for the order update?** — If the provider times out after 5 seconds and our transaction takes 6 seconds, we need to decouple the DB update from the HTTP response.
4. **Is there a webhook signing mechanism we should use?** — The current `x-webhook-secret` header is just a shared string. If the provider supports HMAC signatures, we should implement that instead.
5. **Do we need to support multiple providers?** — If so, we need provider-specific routing, secret management, and event type mapping.
6. **What is the order creation flow?** — We assume the order already exists. If there is a race condition between order creation and the webhook, we may get 404s that should be retried later.
7. **Should failed webhooks be manually replayable?** — If an admin needs to re-trigger a webhook, we need an internal API or CLI for that.
