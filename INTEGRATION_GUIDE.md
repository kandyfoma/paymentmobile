# 🚀 Quick Integration Guide for Your Apps

## Overview
Your payment hub is ready to accept payments from all your React Native and React.js apps!

## Payment Flow
1. **User Action**: User navigates to payment page, selects provider, enters phone number
2. **App Calls Hub**: Your app sends POST request to Railway endpoint
3. **Hub Processes**: Server validates, saves to database, calls FreshPay API
4. **Real-time Updates**: App listens to Supabase for status changes
5. **User Confirmation**: User enters PIN on phone, payment completes

---

## ✅ What's Already Done

### Server Side (Railway)
- ✅ Express server deployed at `https://web-production-a4586.up.railway.app`
- ✅ CORS enabled (accepts requests from any origin)
- ✅ Fixed IP: `208.77.244.15` (whitelisted by FreshPay)
- ✅ Automatic network detection from phone number
- ✅ Transaction tracking in Supabase database
- ✅ Webhook handling for payment callbacks

### Database (Supabase)
- ✅ PostgreSQL database with `transactions` table
- ✅ Real-time subscriptions enabled
- ✅ Secure with Row Level Security

---

## 📱 How Your Apps Should Call It

### Endpoint
```
POST https://web-production-a4586.up.railway.app/initiate-payment
```

### Required Payload
```json
{
  "app_name": "Your App Name",
  "user_id": "user123",
  "amount": 10,
  "phone_number": "243828812498",
  "currency": "USD",
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com"
}
```

### Response (Success)
```json
{
  "success": true,
  "transaction_id": "abc123",
  "message": "Payment initiated successfully",
  "instructions": "Please check your phone and enter PIN"
}
```

### Response (Error)
```json
{
  "error": "Error message here",
  "details": "Additional details"
}
```

---

## 🎯 Network Auto-Detection

You don't need to ask users to select their provider! The server automatically detects it from the phone number:

| Phone Prefix | Network | Example |
|--------------|---------|---------|
| 81, 82, 83 | Vodacom M-Pesa | 243828812498 |
| 84, 85, 86, 89, 90, 91, 97, 99 | Airtel Money | 243997654321 |
| 80 | Orange Money | 243807654321 |
| 98 | Africell | 243987654321 |

**However**, you can still show a provider picker in your UI for better UX - just note that the server will auto-detect anyway.

---

## 📊 Real-Time Status Updates

Subscribe to payment status changes using Supabase real-time:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oacrwvfivsybkvndooyx.supabase.co',
  'YOUR_SUPABASE_ANON_KEY'
);

const channel = supabase
  .channel('transaction-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'transactions',
      filter: `id=eq.${transactionId}`
    },
    (payload) => {
      console.log('Status:', payload.new.status);
      // Status values: PENDING, SUCCESS, FAILED
    }
  )
  .subscribe();
```

---

## 🔐 Security Notes

### What's Protected
- ✅ Merchant credentials (never exposed to apps)
- ✅ API keys (stored in Railway env vars)
- ✅ Database writes (server-side only)

### What Apps Need
- ✅ Supabase ANON key (safe to expose - read-only)
- ✅ Railway endpoint URL (public)
- ❌ NO merchant credentials needed
- ❌ NO service role keys needed

---

## 🧪 Testing

### Test Payment
```bash
curl -X POST https://web-production-a4586.up.railway.app/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Test App",
    "user_id": "test123",
    "amount": 1,
    "phone_number": "243828812498",
    "currency": "USD"
  }'
```

### Check Server Health
```bash
curl https://web-production-a4586.up.railway.app/
```

### Check Current IP
```bash
curl https://web-production-a4586.up.railway.app/check-ip
```

---

## 🚨 Error Handling

Your apps should handle these scenarios:

1. **Network Error**: Server unreachable
   ```javascript
   catch (error) {
     if (!error.response) {
       // Network error
       alert('Please check your internet connection');
     }
   }
   ```

2. **Invalid Phone**: Wrong format
   ```javascript
   if (!/^243[0-9]{9}$/.test(phoneNumber)) {
     alert('Invalid phone number format');
   }
   ```

3. **Payment Timeout**: User doesn't enter PIN
   ```javascript
   // Set a timeout for PENDING status
   setTimeout(() => {
     if (status === 'PENDING') {
       alert('Payment timeout. Please try again.');
     }
   }, 120000); // 2 minutes
   ```

---

## 📝 Next Steps for Your Apps

### For React Native Apps
1. Install dependencies:
   ```bash
   npm install @supabase/supabase-js @react-native-picker/picker
   ```

2. Copy `services/paymentService.js` from README
3. Copy `screens/PaymentScreen.js` from README
4. Add payment navigation to your app
5. Test with $1 payment

### For React.js Web App
1. Install dependencies:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Create payment modal/page
3. Implement same logic as React Native
4. Test in browser

---

## 💡 Best Practices

1. **Always validate phone numbers** before calling API
2. **Show clear instructions** to users ("Check your phone for PIN prompt")
3. **Handle timeouts** gracefully (user might not respond)
4. **Log transaction IDs** for support purposes
5. **Use real-time updates** instead of polling
6. **Show loading states** during API calls

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS error | Server already has CORS enabled, check your request |
| 403 Forbidden | IP might have changed, check `/check-ip` endpoint |
| Invalid operator | Server auto-detects, ensure phone format is correct |
| Timeout | User has 2 minutes to enter PIN, implement timeout handling |
| Status stuck on PENDING | Check webhook is working, verify callback URL in FreshPay portal |

---

## 📞 Support

If payments fail:
1. Check Railway logs (https://railway.app)
2. Verify IP hasn't changed: `curl https://web-production-a4586.up.railway.app/check-ip`
3. Check Supabase database for transaction record
4. Contact FreshPay support if API returns errors

---

**🎉 Your payment hub is production-ready!**

All your apps can now accept Moko mobile money payments through one centralized, secure, and maintainable system.
