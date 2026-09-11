'use client'

import { useCompanyOptional } from '@/components/providers/CompanyContextProvider'
import type { POSBusinessConfig } from '@/components/pos/types'

export function usePOSBusinessConfig(): POSBusinessConfig {
  const company = useCompanyOptional()
  const bt = company?.businessType ?? 'retail'

  const isServiceCapable = bt === 'auto_service' || bt === 'dealership'

  return {
    showVehicleSelector: isServiceCapable,
    showTableSelector: bt === 'restaurant',
    showOrderTypeSelector: bt === 'restaurant',
    enableBarcodeAutoAdd: bt === 'supermarket',
    enableWeighableItems: bt === 'supermarket',
    enableModifiers: bt === 'restaurant',
    enableTips: bt === 'restaurant',
    enableKitchenSend: bt === 'restaurant',
    enableCoreChargeDisplay: isServiceCapable,
    redirectToDealPipeline: false,
  }
}
