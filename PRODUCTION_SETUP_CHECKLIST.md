# Africanite Services - Production Setup Checklist

## ✅ Account Status
- [x] Moko AFRIKA merchant account activated
- [x] Production credentials received (Africanité.xlsx)
- [ ] Password changed after first login
- [ ] Supabase project created
- [ ] Database table created
- [ ] Edge Functions deployed
- [ ] First test payment completed

## 🔐 Security Checklist
1. ✅ Credentials stored in CREDENTIALS_SECURE.txt (not in git)
2. ✅ .gitignore configured to exclude sensitive files
3. ⚠️ **TODO:** Login to merchant portal and change password
4. ⚠️ **TODO:** Store new password in CREDENTIALS_SECURE.txt
5. ⚠️ **TODO:** Enable 2FA if available on merchant portal

## 🚀 Deployment Steps
1. Create Supabase account at https://supabase.com
2. Create new project
3. Copy SUPABASE_URL and SUPABASE_ANON_KEY
4. Run SQL schema from AFRICANITE_PAYMENT_HUB.md
5. Link project: `.\supabase.exe link --project-ref YOUR_REF`
6. Set secrets (use credentials from CREDENTIALS_SECURE.txt)
7. Deploy functions: `.\supabase.exe functions deploy --use-api`
8. Test with small amount (e.g., 100 CDF)

## 📊 Testing Workflow
1. Call initiate-payment from Postman/mobile app
2. Verify transaction appears in Supabase database as PENDING
3. Check phone receives STK push notification
4. Enter PIN on phone
5. Verify webhook updates status to SUCCESS
6. Verify in Moko Merchant Portal: https://cd.merchants.gofreshpay.com/login

## 🆘 Emergency Contacts
- Technical Support: support@gofreshbakery.com
- API Docs: https://developer.gofreshpay.com/
- Production Endpoint: https://paydrc.gofreshbakery.net/api/v5/

## 📝 Next Steps
1. **IMMEDIATELY:** Login and change password at https://cd.merchants.gofreshpay.com/login
2. Complete Supabase setup
3. Test payment flow end-to-end
4. Integrate SDK into your 3 mobile apps
5. Monitor first real transactions
