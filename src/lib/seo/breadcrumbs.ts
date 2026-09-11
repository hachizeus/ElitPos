const BASE_URL = 'https://elitpos.elitjohnsdigital.co.ke'

export function generateBreadcrumbJsonLd(items: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      ...(item.url ? { 'item': `${BASE_URL}${item.url}` } : {}),
    })),
  }
}
