# Railway Deployment Guide for Africanite Payment Hub

## ✅ Local Testing Passed
Your server is running successfully on port 3000!

## 🚀 Deploy to Railway

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (free tier includes fixed IP!)
3. Verify your email

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect this repository: `paymentmobile`
4. Railway will auto-detect the Node.js project

### Step 3: Configure Environment Variables
In Railway dashboard, add these variables (get actual values from CREDENTIALS_SECURE.txt):

```
PORT=3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
MERCHANT_ID=your_moko_merchant_id
MERCHANT_SECRET=your_moko_merchant_secret
MOKO_API_URL=https://paydrc.gofreshbakery.net/api/v5
CURRENCY=USD
```

**⚠️ IMPORTANT:** Copy actual values from `CREDENTIALS_SECURE.txt` (not committed to git)

### Step 4: Get Your Fixed IP
1. After deployment, go to "Settings" → "Networking"
2. Enable "Public Networking"
3. Copy your:
   - **Fixed IP Address** (e.g., 3.127.45.67)
   - **Domain** (e.g., paymentmobile-production.up.railway.app)

### Step 5: Send IP to FreshPay
Email Alliance Tshindayi at FreshPay:
```
Bonjour Alliance,

Voici notre IP fixe pour le whitelisting:
IP: [YOUR_RAILWAY_IP]
Domain: [YOUR_RAILWAY_DOMAIN]

Merci!
```

### Step 6: Update Callback URL
1. Login to FreshPay merchant portal
2. Go to Settings → Webhook/Callback
3. Update callback URL to:
   ```
   https://[YOUR_RAILWAY_DOMAIN]/moko-webhook
   ```

### Step 7: Update Mobile Apps
Replace Supabase endpoint with Railway in your React Native/React.js apps:

**OLD:**
```javascript
const response = await fetch('https://oacrwvfivsybkvndooyx.supabase.co/functions/v1/initiate-payment', {
```

**NEW:**
```javascript
const response = await fetch('https://[YOUR_RAILWAY_DOMAIN]/initiate-payment', {
```

### Step 8: Test Payment
Once IP is whitelisted by FreshPay:
```bash
curl -X POST https://[YOUR_RAILWAY_DOMAIN]/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "243828812498",
    "amount": 1,
    "reference": "TEST001"
  }'
```

## 📊 Railway Dashboard
- **Logs**: Monitor real-time logs
- **Metrics**: CPU/Memory usage
- **Deployments**: Rollback if needed
- **Settings**: Manage env vars

## 💰 Pricing
- **Free Tier**: $5 credit/month (enough for development)
- **Fixed IP**: Included in free tier!
- **Custom Domain**: Free

## 🔧 Local Development
Server is already running locally on http://localhost:3000

Test endpoints:
- Health: http://localhost:3000/
- Payment: POST http://localhost:3000/initiate-payment
- Webhook: POST http://localhost:3000/moko-webhook

## ⚠️ Important Notes
1. Don't commit `.env` to GitHub (already in .gitignore)
2. Railway will use environment variables from dashboard
3. Keep `server/.env` for local testing only
4. After IP whitelist, all 403 errors should disappear

## 📞 Support
If Railway deployment fails:
- Check build logs in Railway dashboard
- Verify all env vars are set
- Ensure `server/` directory structure is correct

Ready to deploy! 🚀
