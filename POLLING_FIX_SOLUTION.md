# Solution: Aggressive Polling Issue

## Problem Identified

Multiple components are polling APIs every **15 seconds** when WebSocket is disconnected:

1. **Chat unread count** (`useStaffChat.ts`) - polling every 30s (with backoff)
2. **AI alerts** (`AlertBell.tsx` via `useRealtimeData`) - polling every 15s
3. **Module access** - loaded once, not the issue
4. **Other realtime data hooks** - polling every 15s

This causes database connection pool exhaustion and slow page loads.

---

## Root Cause

From `src/hooks/useRealtimeData.ts` line 143:
```typescript
const interval = pollingInterval ?? 15000  // Default 15 seconds!
```

When WebSocket is disconnected, every component using `useRealtimeData` polls its API every 15 seconds.

---

## Solution: Increase Polling Intervals

### Option 1: Global Fix (Recommended)

Change the default polling interval from 15s to 60s:

**File:** `src/hooks/useRealtimeData.ts`

**Line 143:**
```typescript
const interval = pollingInterval ?? 60000  // Changed from 15000 to 60000 (1 minute)
```

**Line 248 (useRealtimeDataMultiple):**
```typescript
const interval = pollingInterval ?? 60000  // Changed from 15000 to 60000
```

**Line 369 (useRealtimeDocument):**
```typescript
const interval = pollingInterval ?? 60000  // Changed from 15000 to 60000
```

### Option 2: Per-Component Fix

Alternatively, specify `pollingInterval` in each component:

**AlertBell.tsx:**
```typescript
useRealtimeData(fetchAlerts, { 
  entityType: 'ai-alert',
  pollingInterval: 60000  // 1 minute instead of 15s
})
```

**useStaffChat.ts** is already using 30s with backoff, which is reasonable.

---

## Option 3: Disable Polling Entirely (if WebSocket is stable)

Set `pollingInterval: 0` to disable polling:

```typescript
useRealtimeData(fetchAlerts, { 
  entityType: 'ai-alert',
  pollingInterval: 0  // Disabled - WebSocket only
})
```

**Risk:** If WebSocket disconnects, data won't update until it reconnects.

---

## Recommended Approach

**Use Option 1** (global fix) with these intervals:

| Data Type | Current | Recommended | Reason |
|-----------|---------|-------------|--------|
| AI Alerts | 15s | 60s | Low urgency, can wait 1 minute |
| Chat Unread | 30s | 30s | Already good with backoff |
| Storage Quota | 15s | 120s | Changes infrequently |
| Module Access | Once | Once | Already correct |
| Realtime Data | 15s | 60s | General data can wait |

---

## Why This Fixes the Issue

1. **Reduces API calls by 75%:** 15s → 60s = 4x fewer requests
2. **Lowers DB connection pool usage:** Fewer concurrent queries
3. **Faster page loads:** Less compilation churn from API routes
4. **Better user experience:** Smoother browsing, less network activity

---

## Implementation

Apply the fix to `useRealtimeData.ts`:

```typescript
// Line 143
const interval = pollingInterval ?? 60000  // was: 15000

// Line 248
const interval = pollingInterval ?? 60000  // was: 15000

// Line 369
const interval = pollingInterval ?? 60000  // was: 15000
```

Then restart the server.

---

## Expected Results After Fix

**Before:**
```
GET /api/ai/alerts 200 in 1108ms
GET /api/chat/unread 200 in 648ms
GET /api/company/storage-quota 200 in 3.3s
(repeated every 15 seconds)
```

**After:**
```
GET /api/ai/alerts 200 in 500ms
GET /api/chat/unread 200 in 400ms
GET /api/company/storage-quota 200 in 800ms
(repeated every 60 seconds)
```

- 4x fewer requests
- Faster response times (less DB contention)
- Stable connection pool usage

---

## Note on WebSocket

The polling only happens when **WebSocket is disconnected**. If WebSocket is connected and working, updates happen in real-time with zero polling.

Check WebSocket connection in browser console:
```javascript
// Should show "connected"
```

If WebSocket is always disconnected, you may need to debug the WebSocket connection itself.
