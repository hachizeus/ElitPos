# 🚨 CRITICAL: YOU MUST MANUALLY RESTART THE DEV SERVER

## The React Hooks Error Will NOT Go Away Until You Do This:

### Steps to Fix:

1. **Stop the server**: Press `Ctrl+C` in the terminal running `node server.js`
2. **Start it again**: Run `node server.js`

### Why This Is Necessary:

The error "Rendered more hooks than during the previous render" is caused by Next.js's hot module replacement getting out of sync with the actual code. Clearing `.next` cache does NOT fix this - **only a full server restart will**.

---

## Other Fixes Applied:

✅ **SMS Notification Preferences Added**
- Database column `notify_sms` added to `accounts` table
- UI updated in Settings → Notifications tab to include SMS toggle
- API endpoint updated to handle SMS preferences
- Sender respects user SMS preferences before sending

✅ **Database Connection Pool Increased**
- Max connections: 30 → 50
- Connection timeout reduced: 5s → 3s (fail fast)
- Idle timeout reduced: 30s → 20s (release faster)
- Statement timeout increased: 10s → 20s (allow complex queries)

✅ **SMS Phone Number Formatting Fixed**
- Auto-converts Kenya numbers (0xxx → +254xxx)
- Added verbose logging to debug Africa's Talking responses
- Accepts status codes 101 (Sent) and 102 (Queued)

---

## To Test SMS Sending:

1. Restart the server (as mentioned above)
2. Go to Admin → Settings and verify Africa's Talking credentials are saved
3. Send a test notification
4. Check terminal logs for: `[SMS] Africa's Talking response:`
5. If SMS still doesn't send, check the logs for the exact API error

---

## Database Connection Pool Monitoring:

Watch the terminal for these logs:
```
[Pool] Client connected. Total: X Idle: Y Waiting: Z
```

If `Waiting` stays high (>5), you may need to optimize slow queries or increase pool size further.
