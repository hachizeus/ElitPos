import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/ai/error-logger'

interface GeoipResult {
  country: string      // ISO 3166-1 alpha-2
  currency: string     // ISO 4217
  symbol: string
  city?: string
}

// Country to currency mapping (common ones)
const COUNTRY_CURRENCY_MAP: Record<string, { currency: string; symbol: string }> = {
  LK: { currency: 'LKR', symbol: 'Rs' },
  US: { currency: 'USD', symbol: '$' },
  GB: { currency: 'GBP', symbol: '£' },
  EU: { currency: 'EUR', symbol: '€' },
  DE: { currency: 'EUR', symbol: '€' },
  FR: { currency: 'EUR', symbol: '€' },
  IT: { currency: 'EUR', symbol: '€' },
  ES: { currency: 'EUR', symbol: '€' },
  NL: { currency: 'EUR', symbol: '€' },
  BE: { currency: 'EUR', symbol: '€' },
  AT: { currency: 'EUR', symbol: '€' },
  PT: { currency: 'EUR', symbol: '€' },
  IE: { currency: 'EUR', symbol: '€' },
  FI: { currency: 'EUR', symbol: '€' },
  IN: { currency: 'INR', symbol: '₹' },
  AU: { currency: 'AUD', symbol: 'A$' },
  CA: { currency: 'CAD', symbol: 'C$' },
  JP: { currency: 'JPY', symbol: '¥' },
  CN: { currency: 'CNY', symbol: '¥' },
  SG: { currency: 'SGD', symbol: 'S$' },
  AE: { currency: 'AED', symbol: 'د.إ' },
  SA: { currency: 'SAR', symbol: '﷼' },
  MY: { currency: 'MYR', symbol: 'RM' },
  TH: { currency: 'THB', symbol: '฿' },
  PH: { currency: 'PHP', symbol: '₱' },
  PK: { currency: 'PKR', symbol: '₨' },
  BD: { currency: 'BDT', symbol: '৳' },
  NP: { currency: 'NPR', symbol: 'रू' },
  ZA: { currency: 'ZAR', symbol: 'R' },
  NG: { currency: 'NGN', symbol: '₦' },
  KE: { currency: 'KES', symbol: 'KSh' },
  BR: { currency: 'BRL', symbol: 'R$' },
  MX: { currency: 'MXN', symbol: '$' },
  KR: { currency: 'KRW', symbol: '₩' },
  NZ: { currency: 'NZD', symbol: 'NZ$' },
  SE: { currency: 'SEK', symbol: 'kr' },
  NO: { currency: 'NOK', symbol: 'kr' },
  DK: { currency: 'DKK', symbol: 'kr' },
  CH: { currency: 'CHF', symbol: 'CHF' },
}

// GET /api/geoip - Detect visitor's country and currency
export async function GET(request: NextRequest) {
  try {
    // 1. Check Cloudflare's cf-ipcountry header first (most reliable behind CF proxy)
    const cfCountry = request.headers.get('cf-ipcountry')
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
      const countryCode = cfCountry.toUpperCase()
      const currencyInfo = COUNTRY_CURRENCY_MAP[countryCode] || { currency: 'KES', symbol: 'KSh' }
      return NextResponse.json(
        { country: countryCode, currency: currencyInfo.currency, symbol: currencyInfo.symbol, source: 'cloudflare' },
        { headers: { 'Cache-Control': 'private, max-age=86400' } }
      )
    }

    // 2. Try to get IP from headers (works behind proxies)
    const cfIp = request.headers.get('cf-connecting-ip')
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = cfIp || forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || ''

    // Skip for localhost/private IPs - default to Kenya
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return NextResponse.json(
        { country: 'KE', currency: 'KES', symbol: 'KSh', source: 'default' },
        { headers: { 'Cache-Control': 'private, max-age=86400' } }
      )
    }

    // 3. Try ip-api.com (free, 45 req/min, no key needed)
    let result = await fetchFromIpApi(ip)

    // 4. Fallback to ipinfo.io
    if (!result) {
      result = await fetchFromIpinfo(ip)
    }

    // Default to Kenya if all APIs fail
    if (!result) {
      return NextResponse.json(
        { country: 'KE', currency: 'KES', symbol: 'KSh', source: 'default' },
        { headers: { 'Cache-Control': 'private, max-age=86400' } }
      )
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=86400' },
    })
  } catch (error) {
    logError('api/geoip', error)
    return NextResponse.json({
      country: 'KE',
      currency: 'KES',
      symbol: 'KSh',
      source: 'default',
    })
  }
}

async function fetchFromIpApi(ip: string): Promise<GeoipResult | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,city`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return null

    const data = await response.json()
    if (data.status === 'fail') return null

    const countryCode = data.countryCode as string
    const currencyInfo = COUNTRY_CURRENCY_MAP[countryCode] || { currency: 'KES', symbol: 'KSh' }

    return {
      country: countryCode,
      currency: currencyInfo.currency,
      symbol: currencyInfo.symbol,
      city: data.city,
    }
  } catch {
    return null
  }
}

async function fetchFromIpinfo(ip: string): Promise<GeoipResult | null> {
  try {
    const response = await fetch(`https://ipinfo.io/${ip}/json`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return null

    const data = await response.json()
    const countryCode = data.country as string
    const currencyInfo = COUNTRY_CURRENCY_MAP[countryCode] || { currency: 'KES', symbol: 'KSh' }

    return {
      country: countryCode,
      currency: currencyInfo.currency,
      symbol: currencyInfo.symbol,
      city: data.city,
    }
  } catch {
    return null
  }
}
