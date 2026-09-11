// Type declarations for Paystack inline JS (loaded dynamically via CDN)
interface PaystackCallbacks {
  onSuccess: (response: { reference: string; status: string }) => void
  onCancel: () => void
}

interface PaystackTransaction {
  /** Open Paystack checkout with key + amount + email (client-side init) */
  newTransaction(options: {
    key: string
    email?: string
    amount?: number
    currency?: string
    ref?: string
    onSuccess: (response: { reference: string; status: string }) => void
    onCancel: () => void
  }): void

  /** Resume a server-initialized transaction using the accessCode */
  resumeTransaction(accessCode: string, callbacks: PaystackCallbacks): void
}

interface Window {
  PaystackPop: PaystackTransaction
}
