import { z } from 'zod'

export const webhookHeadersSchema = z.object({
  'x-webhook-secret': z.string().min(1),
})

export const webhookBodySchema = z.object({
  event_id: z.string().min(1),
  event_type: z.enum(['payment.success', 'payment.failed']),
  order_id: z.string().min(1),
  timestamp: z.string().datetime().optional(),
})

export type WebhookHeaders = z.infer<typeof webhookHeadersSchema>
export type WebhookBody = z.infer<typeof webhookBodySchema>
