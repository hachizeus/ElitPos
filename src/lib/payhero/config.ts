// PayHero (Kenyan fintech) configuration helpers

export interface PayheroConfig {
  apiUsername: string
  apiPassword: string
  channelId: string
}

export function buildPayheroConfig(row: {
  payheroApiUsername: string | null
  payheroApiPassword: string | null
  payheroChannelId: string | null
}): PayheroConfig | null {
  if (!row.payheroApiUsername || !row.payheroApiPassword || !row.payheroChannelId) return null
  return {
    apiUsername: row.payheroApiUsername,
    apiPassword: row.payheroApiPassword,
    channelId:   row.payheroChannelId,
  }
}

export const PAYHERO_API = 'https://backend.payhero.co.ke/api/v2'
