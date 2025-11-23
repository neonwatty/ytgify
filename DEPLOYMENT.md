# YTGify Chrome Extension - Production Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Access to production backend API URL
- Chrome Web Store developer account (for publishing)

---

## Step 1: Configure Production Environment

### 1.1 Update `.env.production`

Edit `.env.production` and set your production API URL:

```bash
API_BASE_URL=https://api.ytgify.com
```

**Important:** Replace `https://api.ytgify.com` with your actual production backend URL.

### 1.2 Verify Configuration

```bash
# Check that API_BASE_URL is set correctly
cat .env.production
```

---

## Step 2: Build for Production

### 2.1 Install Dependencies

```bash
npm install
```

### 2.2 Build Production Bundle

```bash
npm run build:production
```

**What this does:**
- Compiles TypeScript to JavaScript
- Bundles with Webpack in production mode
- Minifies code
- Strips localhost permissions from manifest
- Injects API_BASE_URL from `.env.production`
- Outputs to `dist-production/`

### 2.3 Verify Build

```bash
# Check that build succeeded
ls dist-production/

# Verify manifest doesn't contain localhost permissions
grep localhost dist-production/manifest.json
# Should return nothing
```

---

## Step 3: Test Production Build Locally

### 3.1 Load Extension in Chrome

1. Open Chrome: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select `dist-production/` directory

### 3.2 Test Critical Flows

**Authentication:**
- Open extension popup
- Click "Sign In"
- Login with test account
- Verify token is stored correctly

**GIF Upload:**
- Navigate to YouTube video
- Create a GIF
- Click "Upload to Cloud"
- Verify upload succeeds to production backend

**Token Refresh:**
- Wait 10+ minutes (or manually expire token)
- Try uploading another GIF
- Verify token refreshes automatically

**Session Expiration:**
- Manually clear auth state or wait for expiration
- Verify Chrome notification appears
- Verify banner shows in popup

---

## Step 4: Prepare for Chrome Web Store

### 4.1 Create Package

```bash
cd dist-production
zip -r ../ytgify-production.zip *
cd ..
```

### 4.2 Required Assets

Ensure you have:
- **Icons:** 16x16, 32x32, 48x48, 128x128 (in `dist-production/icons/`)
- **Screenshots:** 1280x800 or 640x400 (for store listing)
- **Promotional images:** 440x280 small tile (optional)
- **Description:** Store listing text
- **Privacy Policy:** URL to hosted privacy policy

### 4.3 Version Number

Update version in `manifest.json` before building:

```json
{
  "version": "1.0.11"  // Increment from previous version
}
```

---

## Step 5: Submit to Chrome Web Store

### 5.1 Upload Package

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click on your extension (or create new item)
3. Click **Package** → **Upload new package**
4. Select `ytgify-production.zip`

### 5.2 Fill Store Listing

**Required fields:**
- Name: YTGify
- Summary: Turn your favorite YouTube moments into shareable GIFs
- Description: (Full description with features)
- Category: Productivity
- Language: English
- Screenshots: Upload 3-5 screenshots
- Privacy policy: URL

### 5.3 Set Permissions Justification

**For "notifications" permission:**
> Used to notify users when their session expires and they need to re-authenticate.

**For "storage" permission:**
> Used to store user preferences and authentication tokens.

**For "tabs" permission:**
> Required to detect YouTube pages and inject GIF creation UI.

### 5.4 Submit for Review

1. Click **Submit for review**
2. Wait 1-3 business days for Google review
3. Monitor email for approval or rejection

---

## Step 6: Post-Deployment Monitoring

### 6.1 Monitor Backend API

Check backend logs for:
- Authentication errors (401s)
- Rate limiting (429s)
- Token refresh failures
- GIF upload errors

### 6.2 Monitor Extension Errors

Check Chrome Web Store developer console for:
- Crash reports
- User reviews mentioning auth issues
- Token expiration complaints

### 6.3 Analytics (Optional)

Track:
- User authentication success/failure rates
- Token refresh frequency
- GIF upload success rates
- Session duration

---

## Rollback Procedure

If critical issues are discovered:

### Option 1: Unpublish Extension

1. Go to Chrome Web Store Developer Dashboard
2. Click **More** → **Unpublish**
3. Extension removed from store but existing users keep it

### Option 2: Quick Hotfix

1. Fix issue in code
2. Increment version number
3. Build new production bundle
4. Upload new package
5. Submit for expedited review (explain urgent fix)

---

## Environment-Specific Configuration

### Development
```bash
npm run dev          # Uses .env.development
npm run build        # Development build
```

### Production
```bash
npm run build:production  # Uses .env.production
```

### Configuration Files

| File | Purpose | Committed to Git? |
|------|---------|-------------------|
| `.env.example` | Template | ✅ Yes |
| `.env.development` | Dev config | ✅ Yes (localhost is safe) |
| `.env.production` | Production config | ❌ No (contains sensitive URLs) |

---

## Troubleshooting

### Issue: "API_BASE_URL is not set"

**Solution:** Ensure `.env.production` exists with `API_BASE_URL` set.

### Issue: "Manifest contains localhost permissions"

**Solution:** Use `npm run build:production` (not `npm run build`)

### Issue: "Token refresh not working"

**Checklist:**
1. Backend `/api/v1/auth/refresh` endpoint works
2. CORS allows extension origin
3. Token expiration is 15 minutes
4. Extension has `notifications` permission

### Issue: "Users report silent logouts"

**Solution:**
- Check Chrome notification permissions
- Verify banner shows in popup
- Check token-manager.ts logs

---

## Security Checklist

Before deploying to production:

- [ ] API_BASE_URL uses HTTPS (not HTTP)
- [ ] JWT_SECRET_KEY on backend is 32+ characters
- [ ] CORS only allows production extension ID
- [ ] No hardcoded credentials in code
- [ ] .env.production not committed to git
- [ ] Manifest doesn't include localhost permissions
- [ ] Rate limiting configured on backend
- [ ] Token expiration is reasonable (15 min)

---

## Additional Resources

- [Chrome Extension Publishing Guide](https://developer.chrome.com/docs/webstore/publish/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/devguide/)

---

**Last Updated:** 2025-11-22
**Production API:** Configure in `.env.production`
**Support:** File issues at github.com/neonwatty/ytgify
