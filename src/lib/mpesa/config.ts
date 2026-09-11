// M-Pesa Daraja API configuration

export type MpesaEnvironment = 'sandbox' | 'production'

export const MPESA_URLS: Record<MpesaEnvironment, Record<string, string>> = {
  sandbox: {
    auth:    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkpush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    query:   'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  },
  production: {
    auth:    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkpush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    query:   'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  },
}

export function getMpesaUrl(env: MpesaEnvironment, endpoint: 'auth' | 'stkpush' | 'query'): string {
  return MPESA_URLS[env][endpoint]
}

export interface MpesaConfig {
  consumerKey: string
  consumerSecret: string
  shortcode: string
  passkey: string
  environment: MpesaEnvironment
  callbackBaseUrl: string
}

/** Build config from per-tenant gateway settings record */
export function buildMpesaConfig(row: {
  mpesaConsumerKey: string | null
  mpesaConsumerSecret: string | null
  mpesaShortcode: string | null
  mpesaPasskey: string | null
  mpesaEnvironment: string | null
  mpesaCallbackBaseUrl: string | null
}): MpesaConfig | null {
  if (
    !row.mpesaConsumerKey ||
    !row.mpesaConsumerSecret ||
    !row.mpesaShortcode ||
    !row.mpesaPasskey
  ) return null

  return {
    consumerKey:     row.mpesaConsumerKey,
    consumerSecret:  row.mpesaConsumerSecret,
    shortcode:       row.mpesaShortcode,
    passkey:         row.mpesaPasskey,
    environment:     (row.mpesaEnvironment as MpesaEnvironment) || 'sandbox',
    callbackBaseUrl: row.mpesaCallbackBaseUrl || (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  }
}
