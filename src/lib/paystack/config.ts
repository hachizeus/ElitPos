// Paystack configuration helpers

export interface PaystackConfig {
  secretKey: string
  publicKey: string
  webhookSecret: string
  currency: string
}

export function buildPaystackConfig(row: {
  paystackSecretKey: string | null
  paystackPublicKey: string | null
  paystackWebhookSecret: string | null
  paystackCurrency: string | null
}): PaystackConfig | null {
  if (!row.paystackSecretKey || !row.paystackPublicKey) return null
  return {
    secretKey:     row.paystackSecretKey,
    publicKey:     row.paystackPublicKey,
    webhookSecret: row.paystackWebhookSecret || '',
    currency:      (row.paystackCurrency || 'KES').toUpperCase(),
  }
}
