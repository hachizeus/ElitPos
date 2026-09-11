// Stripe configuration helpers

export interface StripeConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
  currency: string
}

export function buildStripeConfig(row: {
  stripeSecretKey: string | null
  stripePublishableKey: string | null
  stripeWebhookSecret: string | null
  stripeCurrency: string | null
}): StripeConfig | null {
  if (!row.stripeSecretKey || !row.stripePublishableKey) return null
  return {
    secretKey:     row.stripeSecretKey,
    publishableKey: row.stripePublishableKey,
    webhookSecret: row.stripeWebhookSecret || '',
    currency:      (row.stripeCurrency || 'kes').toLowerCase(),
  }
}
