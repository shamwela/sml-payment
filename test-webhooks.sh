#!/bin/bash

# Test script for the payment webhook handler
# Run with: bash test-webhooks.sh

BASE_URL="http://localhost:3000"
WEBHOOK_SECRET="password123"

# 1. Successful payment webhook
echo "=== 1. Payment success ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"event_id":"evt_001","event_type":"payment.success","order_id":"ord_456"}'
echo ""

# 2. Duplicate webhook (should return 200 OK to prevent retries)
echo "=== 2. Duplicate webhook (same event_id) ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"event_id":"evt_001","event_type":"payment.success","order_id":"ord_456"}'
echo ""

# 3. Missing secret header
echo "=== 3. Missing secret header ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"evt_002","event_type":"payment.success","order_id":"ord_456"}'
echo ""

# 4. Invalid secret
echo "=== 4. Invalid secret ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: wrong-secret" \
  -d '{"event_id":"evt_003","event_type":"payment.success","order_id":"ord_456"}'
echo ""

# 5. Invalid payload (missing order_id)
echo "=== 5. Invalid payload ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"event_id":"evt_004","event_type":"payment.success"}'
echo ""

# 6. Invalid event type
echo "=== 6. Invalid event type ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"event_id":"evt_005","event_type":"payment.refunded","order_id":"ord_456"}'
echo ""

# 7. Order not found
echo "=== 7. Order not found ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"event_id":"evt_006","event_type":"payment.success","order_id":"ord_999"}'
echo ""

# 8. Payment failed
echo "=== 8. Payment failed ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"event_id":"evt_007","event_type":"payment.failed","order_id":"ord_456"}'
echo ""

# 9. Another new payment success
echo "=== 9. Another payment success ==="
curl -s -X POST "$BASE_URL/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"event_id":"evt_008","event_type":"payment.success","order_id":"ord_456"}'
echo ""
