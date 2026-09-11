import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const content = `# ElitPOS by Elitjohns Digital Agency

> AI-powered cloud POS and ERP platform for retail stores, restaurants, supermarkets, auto service centers, and vehicle dealerships. All features on every plan. Unlimited users. Free to start.

ElitPOS is a multi-tenant SaaS business management system built by Elitjohns Digital Agency for five business types. It provides point of sale, inventory management, double-entry accounting, HR and payroll, kitchen display, work order management, and AI-powered analytics in a single platform. Every plan includes every feature with no feature gating. The first company per account is free forever with no credit card required.

## Key Pages

- [Home](https://elitpos.elitjohnsdigital.co.ke/): Product overview and value proposition
- [Features](https://elitpos.elitjohnsdigital.co.ke/features): Complete feature list across all modules
- [Pricing](https://elitpos.elitjohnsdigital.co.ke/pricing): Transparent storage-based pricing, all features included
- [Retail POS](https://elitpos.elitjohnsdigital.co.ke/retail): Barcode scanning, inventory, loyalty programs, gift cards
- [Restaurant](https://elitpos.elitjohnsdigital.co.ke/restaurant): Kitchen display, table management, floor plan, reservations, recipes
- [Supermarket](https://elitpos.elitjohnsdigital.co.ke/supermarket): High-volume checkout, department management, batch tracking
- [Auto Service](https://elitpos.elitjohnsdigital.co.ke/auto-service): Work orders, vehicle tracking, inspections, insurance estimates
- [Vehicle Dealership](https://elitpos.elitjohnsdigital.co.ke/dealership): Vehicle inventory, sales pipeline, trade-ins, test drives

## Company

- [About](https://elitpos.elitjohnsdigital.co.ke/about): Our mission and technology
- [Contact](https://elitpos.elitjohnsdigital.co.ke/contact): Support and inquiries
- [Privacy Policy](https://elitpos.elitjohnsdigital.co.ke/privacy): Data handling and security practices
- [Terms of Service](https://elitpos.elitjohnsdigital.co.ke/terms): Usage terms and conditions

## Getting Started

- [Register](https://elitpos.elitjohnsdigital.co.ke/register): Create a free account — no credit card required
- [Login](https://elitpos.elitjohnsdigital.co.ke/login): Sign in to your account
- [Full Product Details](/llms-full.txt): Extended product information for AI systems
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
