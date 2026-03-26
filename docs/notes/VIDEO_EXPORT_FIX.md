# Video Export Fix Guide

This guide explains the changes made to fix the 401 and 429 errors in video export.

## Problem Summary

The video export feature was experiencing:
- **401 Unauthorized** errors from HCTI API
- **429 Too Many Requests** errors due to rate limiting
- Hardcoded, exposed API credentials in client-side code (security vulnerability)

### Root Causes

1. **Exposed Credentials**: API keys were hardcoded in `preview-export.tsx`, visible to all users
2. **Rate Limiting**: Shared API key across all users caused rapid hitting of rate limits
3. **Client-Side Processing**: Image rendering was done on client-side with direct API calls

## Solution Overview

The solution moves sensitive operations to the backend (Next.js API routes) and removes hardcoded credentials.

### Changes Made

#### 1. New Backend Routes

**`/api/shotstack-export` (POST)**
- Accepts rendered slide HTML from client
- Calls HCTI API with secure credentials from environment variables
- Creates Shotstack render job
- Returns render ID to client

```typescript
POST /api/shotstack-export
Body: {
  htmlContent: Array<{ html, duration, audioUrl }>,
  slides: Array<{ html, duration, audioUrl }>
}
Response: {
  success: boolean,
  renderId: string,
  error?: string
}
```

**`/api/shotstack-export/[renderId]` (GET)**
- Polls Shotstack for render status
- Returns current status and video URL when ready

```typescript
GET /api/shotstack-export/[renderId]
Response: {
  status: 'queued' | 'fetching' | 'rendering' | 'done' | 'failed',
  renderId: string,
  url?: string,
  error?: string
}
```

**`/api/html-to-image` (POST)**
- Converts HTML to image using HCTI
- Securely calls HCTI with credentials from environment
- Used by FFmpeg export

```typescript
POST /api/html-to-image
Body: { html: string }
Response: {
  success: boolean,
  url: string,
  error?: string
}
```

#### 2. Updated Frontend (`preview-export.tsx`)

**Shotstack Export Changes:**
- Removed hardcoded API credentials
- Removed direct HCTI API calls
- Removed direct Shotstack API calls
- Now calls `/api/shotstack-export` with rendered HTML
- Polls `/api/shotstack-export/[renderId]` for status

**FFmpeg Export Changes:**
- Removed hardcoded HCTI credentials
- Now calls `/api/html-to-image` for each slide
- Removed direct HCTI API calls

### Environment Setup

1. **Create `.env.local` file** in project root (copy from `.env.example`):

```env
# HCTI (HTML2Image) Credentials
HCTI_USER_ID=your_hcti_user_id
HCTI_API_KEY=your_hcti_api_key

# Shotstack Credentials  
SHOTSTACK_API_KEY=your_shotstack_api_key
```

2. **Obtain credentials:**

   - **HCTI**: Sign up at https://hcti.io and get User ID and API Key from dashboard
   - **Shotstack**: Sign up at https://shotstack.io and get API key from account settings

3. **Never commit `.env.local`** - it's in `.gitignore` by default

### Benefits

1. **Security**: API credentials no longer exposed in client-side code
2. **Rate Limiting**: Each user gets their own request path, better rate limit handling
3. **Reliability**: Retry logic implemented on backend with exponential backoff
4. **Error Handling**: Better error messages and status reporting
5. **Scalability**: Backend can optimize and cache API calls

### Testing the Fix

1. **Setup environment variables:**
   ```bash
   # Copy .env.example to .env.local and add your credentials
   cp .env.example .env.local
   ```

2. **Restart next dev server** (important for environment variables to load)

3. **Test Shotstack export:**
   - Open a project in editor
   - Click "Export with Shotstack"
   - Monitor browser console for status updates
   - Should complete without 401/429 errors

4. **Test FFmpeg export:**
   - Click "Export with FFmpeg"
   - Should use new `/api/html-to-image` route
   - Should complete successfully

### Troubleshooting

**Still getting 401 errors:**
- Check that `HCTI_USER_ID` and `HCTI_API_KEY` are correct in `.env.local`
- Verify HCTI credentials haven't been revoked in HCTI dashboard
- Ensure `.env.local` file exists and is readable
- Restart the next dev server after adding/changing environment variables

**Still getting 429 errors:**
- Check HCTI rate limits on your account
- If shared account, request higher rate limit tier
- Add delays between requests (backend already does this)
- Check Shotstack API rate limits

**Backend route not found (404):**
- Ensure Next.js server is running
- Check that route files are created in correct locations
- Verify no TypeScript compilation errors
- Clear `.next` build cache and restart

**Environment variables not loading:**
- Ensure `.env.local` file is in **project root** (`/c/projects/vsl-123-proj/vsl123/.env.local`)
- Restart next dev server after creating/modifying `.env.local`
- Do NOT use `process.env` in client components - these are for server-side only

### File Changes Summary

**New Files:**
- `/src/app/api/shotstack-export/route.ts` - Main Shotstack export handler
- `/src/app/api/shotstack-export/[renderId]/route.ts` - Status polling endpoint
- `/src/app/api/html-to-image/route.ts` - HTML to image conversion
- `/.env.example` - Example environment variables

**Modified Files:**
- `/src/components/editor/preview-export.tsx` - Updated export functions

### Notes for Future Development

- Consider adding request queuing/rate limiting at backend
- Add logging for monitoring API usage and errors
- Consider adding SDK for HCTI/Shotstack to standardize calls
- Monitor HCTI and Shotstack API usage to catch issues early
