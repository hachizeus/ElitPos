import { z } from 'zod'
import { uuidSchema, optionalUuid } from './common'

// ==================== SHARED ====================

const gatewayContextSchema = z.enum(['subscription', 'pos_sale'])

// ==================== M-PESA ====================

// POST /api/mpesa/stkpush
export const mpesaStkPushSchema = z.object({
  phone: z
    .string()
    .min(9, 'Phone number too short')
    .max(15, 'Phone number too long')
    .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  context: gatewayContextSchema,
  saleId: optionalUuid,
  subscriptionId: optionalUuid,
  accountReference: z.string().min(1).max(12).optional(),
  description: z.string().max(13).optional(),
})

// GET /api/mpesa/status?checkoutRequestId=...
export const mpesaStatusSchema = z.object({
  checkoutRequestId: z.string().min(1).max(200),
})

// ==================== STRIPE ====================

// POST /api/stripe/checkout
export const stripeCheckoutSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3).optional(),
  description: z.string().min(1).max(500),
  context: gatewayContextSchema,
  saleId: optionalUuid,
  subscriptionId: optionalUuid,
  customerEmail: z.string().email().optional(),
  successPath: z.string().max(500).optional(),
  cancelPath: z.string().max(500).optional(),
})

// ==================== PAYSTACK ====================

// POST /api/paystack/initialize
export const paystackInitSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  email: z.string().email().optional(),
  context: gatewayContextSchema,
  saleId: optionalUuid,
  subscriptionId: optionalUuid,
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  newTierId: optionalUuid,
  currency: z.string().length(3).optional(),
  callbackPath: z.string().max(500).optional(),
})

// GET /api/paystack/verify?reference=...
export const paystackVerifySchema = z.object({
  reference: z.string().min(1).max(200),
})

// ==================== PAYHERO ====================

// POST /api/payhero/checkout
export const payheroCheckoutSchema = z.object({
  phone: z
    .string()
    .min(9, 'Phone number too short')
    .max(15, 'Phone number too long')
    .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  context: gatewayContextSchema,
  saleId: optionalUuid,
  subscriptionId: optionalUuid,
  description: z.string().max(200).optional(),
})

// ==================== GATEWAY SETTINGS ====================

// PUT /api/settings/payment-gateways
export const gatewaySettingsSchema = z.object({
  // M-Pesa
  mpesaEnabled: z.boolean().optional(),
  mpesaEnvironment: z.enum(['sandbox', 'production']).optional(),
  mpesaConsumerKey: z.string().max(500).optional(),
  mpesaConsumerSecret: z.string().max(500).optional(),
  mpesaShortcode: z.string().max(20).optional(),
  mpesaPasskey: z.string().max(1000).optional(),
  mpesaCallbackBaseUrl: z.string().url().optional(),

  // Stripe
  stripeEnabled: z.boolean().optional(),
  stripePublishableKey: z.string().max(500).optional(),
  stripeSecretKey: z.string().max(500).optional(),
  stripeWebhookSecret: z.string().max(500).optional(),
  stripeCurrency: z.string().length(3).optional(),

  // Paystack
  paystackEnabled: z.boolean().optional(),
  paystackPublicKey: z.string().max(500).optional(),
  paystackSecretKey: z.string().max(500).optional(),
  paystackWebhookSecret: z.string().max(500).optional(),
  paystackCurrency: z.string().length(3).optional(),

  // PayHero
  payheroEnabled: z.boolean().optional(),
  payheroApiUsername: z.string().max(500).optional(),
  payheroApiPassword: z.string().max(500).optional(),
  payheroChannelId: z.string().max(50).optional(),
})
