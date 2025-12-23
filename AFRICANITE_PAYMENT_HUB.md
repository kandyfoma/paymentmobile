# Africanite Services - Mobile Money Payment Hub

**Project Goal:** Build a centralized payment service using Supabase Edge Functions to handle Moko Mobile Money (via FreshPay PayDRC API) for multiple Africanite apps.

## 🏗️ Architecture Overview
- **Provider:** Moko Mobile Money integrated through FreshPay PayDRC API Gateway
- **Environment:** PRODUCTION (Account Activated ✅)
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** PostgreSQL (Supabase)
- **Apps:** Multi-tenant support for App A, App B, and App C.
- **Flow:** Asynchronous with webhooks for payment confirmation.

### 🔗 Official Resources
- **Merchant Portal:** https://cd.merchants.gofreshpay.com/login
- **API Documentation:** https://developer.gofreshpay.com/
- **Production Endpoint:** https://paydrc.gofreshbakery.net/api/v5/
- **Technical Support:** support@gofreshbakery.com

---

## 📊 Database Schema (SQL)
Run this in the Supabase SQL Editor:

```sql
-- Create a table to track all Africanite Service transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  app_name TEXT NOT NULL, -- e.g., 'App_A', 'App_B'
  user_id TEXT, -- ID of the user from the specific app
  phone_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'CDF', -- or your local currency (CDF for DRC)
  status TEXT DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
  moko_reference TEXT, -- Internal reference from Moko/FreshPay
  freshpay_ref TEXT, -- Reference from FreshPay API
  metadata JSONB -- Flexible storage for app-specific data
);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Optional: Index for performance
CREATE INDEX idx_transactions_app_name ON transactions(app_name);
CREATE INDEX idx_transactions_status ON transactions(status);
```

## 🔐 Authentication & Security
- Use Supabase Secrets for storing `MERCHANT_ID`, `MERCHANT_SECRET`, `API_BASE_URL` (https://paydrc.gofreshbakery.net/api/v5/)
- Implement HMAC-SHA256 for request signing if required by the API.
- Row Level Security (RLS) to ensure apps only access their own transactions.

## 🛠️ Edge Function 1: initiate-payment
**Objective:** Receive a request from the mobile app, create a pending transaction in the DB, and call the FreshPay PayDRC API to initiate a debit (C2B).

**Steps:**
1. Parse JSON body: `{ app_name, user_id, amount, phone_number, currency }`
2. Validate input.
3. Generate a unique internal_ref or use UUID.
4. Insert row into transactions table with status 'PENDING'.
5. Authenticate with FreshPay API (use merchant_id and secret to get token or sign request).
6. Call POST to `/deposit` or `/debit` endpoint with payload including callback_url to your webhook.
7. Update the row with freshpay_ref.
8. Return the transaction_id to the mobile app.

**Example Payload to FreshPay:**
```json
{
  "merchant_id": "AFRICANITE_ID",
  "amount": "1000",
  "currency": "CDF",
  "customer_number": "243XXXXXXXXX",
  "action": "debit",
  "callback_url": "https://your-project.supabase.co/functions/v1/moko-webhook"
}
```

## 🛠️ Edge Function 2: moko-webhook
**Objective:** Public endpoint for FreshPay to notify when payment status changes.

**Steps:**
1. Receive POST from FreshPay with transaction details.
2. Extract freshpay_ref, status, etc.
3. Update the transactions table where freshpay_ref matches, set status to 'SUCCESS' or 'FAILED'.
4. Optionally, trigger notifications or logs.

## 📱 Mobile App Integration
- Use Supabase SDK to call `initiate-payment` function.
- Subscribe to realtime changes on the transactions table for the specific transaction ID.
- When status updates to 'SUCCESS', proceed with unlocking features.

## 🎛️ Merchant Portal Dashboard
Access your Africanite Services merchant dashboard to:
- View all transactions across all apps
- Monitor payment success rates
- Download financial reports
- Manage account settings

**Login URL:** https://cd.merchants.gofreshpay.com/login
**Credentials:** Use the username and password from your activation email (Africanité.xlsx)

⚠️ **IMPORTANT:** Change your password immediately after first login for security.

## 🚀 Deployment Steps (No-Docker)
1. Install Supabase CLI: `npm install -g supabase` or download binary.
2. Login: `.\supabase.exe login`
3. Init project: ✅ Already done!
4. Create functions: ✅ Already created!
5. Link to your Supabase project: `.\supabase.exe link --project-ref YOUR_PROJECT_REF`
6. Set secrets with your Africanite credentials:
```powershell
.\supabase.exe secrets set MERCHANT_ID="your_merchant_id_here"
.\supabase.exe secrets set MERCHANT_SECRET="your_merchant_secret_here"
.\supabase.exe secrets set API_BASE_URL="https://paydrc.gofreshbakery.net/api/v5/"
```
7. Deploy: `.\supabase.exe functions deploy --use-api`

**⚠️ SECURITY NOTE:** Get your actual credentials from Moko and use them in the secrets command. Never commit credentials to git!

## 📋 API Endpoints from FreshPay Docs
Based on https://developer.gofreshpay.com/:
- **Deposit:** Initiate a payment/debit.
- **Withdrawal:** Handle payouts.
- **Remittance:** Transfer funds.
- **Transaction Status:** Check status.
- **Account Services:** Manage accounts.

For this project, focus on Deposit for incoming payments.

## ⚠️ Notes
- **Production Ready:** Your account is now live! ✅
- Test payments with small amounts first
- Ensure callback_url is publicly accessible (use your deployed Supabase function URL)
- Handle errors and retries in functions
- Monitor transactions via:
  - Supabase dashboard (technical view)
  - Moko Merchant Portal (business view): https://cd.merchants.gofreshpay.com/login

## 🆘 Support & Troubleshooting
**Technical Support:**
- Email: support@gofreshbakery.com
- API Documentation: https://developer.gofreshpay.com/

**Common Issues:**
- Webhook not received: Check function is publicly accessible
- Payment stuck in PENDING: Verify customer entered PIN correctly
- Authentication errors: Verify MERCHANT_ID and MERCHANT_SECRET in Supabase secrets

---

### How to use this with Copilot:
1. Open this .md file in VS Code.
2. Create folders: `supabase/functions/initiate-payment/index.ts`
3. In the .ts file, ask Copilot: "Write the TypeScript code for initiate-payment Edge Function based on AFRICANITE_PAYMENT_HUB.md"