/**
 * ElitPOS — Offline Fallback Page
 * Shown by the service worker when the user navigates to a page
 * that has no cached version and the network is unavailable.
 */
export default function OfflinePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ElitPOS — Offline</title>
      </head>
      <body style={{
        background: '#071209',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        gap: '16px',
        padding: '24px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: 80, height: 80,
          background: 'rgba(0,255,136,0.1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
        }}>
          📡
        </div>

        <h1 style={{ color: '#00FF88', fontSize: '2rem', margin: 0, fontWeight: 700 }}>
          You&apos;re Offline
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          maxWidth: 400,
          lineHeight: 1.6,
          margin: 0,
        }}>
          ElitPOS needs a connection to load this page.
          Any sales you completed while offline will sync automatically when you reconnect.
        </p>

        <div style={{
          display: 'flex', gap: 12, marginTop: 8,
        }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#00FF88',
              color: '#071209',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
          <button
            onClick={() => window.history.back()}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Go Back
          </button>
        </div>
      </body>
    </html>
  )
}
