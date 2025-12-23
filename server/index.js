import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Helper: Detect mobile network from phone number
function detectNetwork(phoneNumber) {
  const number = phoneNumber.replace(/^243/, '');
  const prefix = number.substring(0, 2);
  
  // Correct operator names: mpesa, airtel, orange, afrimoney
  if (['81', '82', '83'].includes(prefix)) return 'mpesa';
  if (['84', '85', '86', '89', '90', '91', '97', '99'].includes(prefix)) return 'airtel';
  if (['80'].includes(prefix)) return 'orange';
  if (['98'].includes(prefix)) return 'afrimoney';
  
  return 'mpesa';
}

// Helper: Generate unique reference
function generateReference() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AF${timestamp}${random}`.toUpperCase();
}

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'Africanite Payment Hub',
    ip: req.ip 
  });
});

// Get outbound IP (for FreshPay whitelist)
app.get('/check-ip', async (req, res) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    res.json({ 
      outbound_ip: data.ip,
      message: 'Send this IP to FreshPay for whitelisting'
    });
  } catch (error) {
    res.json({ error: 'Could not fetch IP' });
  }
});

// Debug endpoint - shows what would be sent to FreshPay
app.post('/debug-payment', (req, res) => {
  const { phone_number, amount, currency = 'USD', firstname = 'Africanite', lastname = 'Service', email = 'foma.kandy@gmail.com' } = req.body;
  
  const number = phone_number.replace(/^243/, '');
  const prefix = number.substring(0, 2);
  let method = 'mpesa';
  if (['81', '82', '83'].includes(prefix)) method = 'mpesa';
  if (['84', '85', '86', '89', '90', '91', '97', '99'].includes(prefix)) method = 'airtel';
  if (['80'].includes(prefix)) method = 'orange';
  if (['98'].includes(prefix)) method = 'afrimoney';
  
  const formattedPhone = phone_number.startsWith('243') ? phone_number.substring(3) : phone_number;
  const customerNumber = formattedPhone.startsWith('0') ? formattedPhone : `0${formattedPhone}`;
  
  const payload = {
    merchant_id: process.env.MERCHANT_ID,
    merchant_secrete: process.env.MERCHANT_SECRET,
    amount: amount.toString(),
    currency: currency,
    action: 'debit',
    customer_number: customerNumber,
    firstname: firstname,
    lastname: lastname,
    email: email,
    reference: 'DEBUG123',
    method: method,
    callback_url: `https://web-production-a4586.up.railway.app/moko-webhook`
  };
  
  res.json({
    message: 'This is what would be sent to FreshPay',
    api_url: process.env.API_BASE_URL,
    payload: payload
  });
});

// Initiate Payment
app.post('/initiate-payment', async (req, res) => {
  try {
    const { 
      app_name, 
      user_id, 
      amount, 
      phone_number, 
      currency = 'USD',
      firstname = 'Africanite',
      lastname = 'Service',
      email = 'foma.kandy@gmail.com'
    } = req.body;

    if (!app_name || !amount || !phone_number) {
      return res.status(400).json({ 
        error: 'Missing required fields: app_name, amount, phone_number' 
      });
    }

    const reference = generateReference();

    // Insert transaction
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        app_name,
        user_id,
        amount,
        phone_number,
        currency,
        status: 'PENDING',
        moko_reference: reference
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create transaction', 
        details: insertError.message 
      });
    }

    // Prepare FreshPay API call
    const merchantId = process.env.MERCHANT_ID;
    const merchantSecret = process.env.MERCHANT_SECRET;
    const apiBaseUrl = process.env.API_BASE_URL;

    if (!merchantId || !merchantSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const method = detectNetwork(phone_number);
    const formattedPhone = phone_number.startsWith('243') 
      ? phone_number.substring(3) 
      : phone_number;
    const customerNumber = formattedPhone.startsWith('0') 
      ? formattedPhone 
      : `0${formattedPhone}`;

    const freshpayPayload = {
      merchant_id: merchantId,
      merchant_secrete: merchantSecret,
      amount: amount.toString(),
      currency: currency,
      action: 'debit',
      customer_number: customerNumber,
      firstname: firstname,
      lastname: lastname,
      email: email,
      reference: reference,
      method: method,
      callback_url: `${req.protocol}://${req.get('host')}/moko-webhook`
    };

    console.log('🚀 FreshPay Request:', JSON.stringify(freshpayPayload, null, 2));
    console.log('📞 Detected Method:', method);
    console.log('📱 Customer Number:', customerNumber);

    const freshpayResponse = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(freshpayPayload)
    });

    const responseText = await freshpayResponse.text();
    console.log('FreshPay Response:', responseText);

    let freshpayData;
    try {
      freshpayData = JSON.parse(responseText);
    } catch {
      await supabase.from('transactions').update({ status: 'FAILED' }).eq('id', transaction.id);
      return res.status(500).json({ 
        error: 'Invalid response from payment provider',
        raw_response: responseText.substring(0, 200)
      });
    }

    if (freshpayData.Status !== 'Success') {
      await supabase.from('transactions').update({ 
        status: 'FAILED',
        metadata: { freshpay_response: freshpayData }
      }).eq('id', transaction.id);
      return res.status(400).json({ 
        error: 'Payment initiation failed', 
        details: freshpayData.Comment || 'Unknown error'
      });
    }

    await supabase.from('transactions').update({ 
      freshpay_ref: freshpayData.Transaction_id,
      metadata: { 
        freshpay_response: freshpayData,
        method: method
      }
    }).eq('id', transaction.id);

    res.json({ 
      transaction_id: transaction.id, 
      reference: reference,
      freshpay_transaction_id: freshpayData.Transaction_id,
      message: 'Payment initiated. Please check your phone and enter your PIN.',
      status: 'PENDING'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Moko Webhook - Receives FreshPay callback and updates Supabase
app.post('/moko-webhook', async (req, res) => {
  try {
    console.log('🔔 Webhook received:', JSON.stringify(req.body, null, 2));
    
    const callbackData = req.body;

    // Handle encrypted callback (if any)
    if (callbackData.data) {
      console.log('⚠️ Encrypted callback received - cannot process');
      return res.json({ status: 'Encrypted callback received' });
    }

    // Extract fields from FreshPay response
    // FreshPay sends: Reference, Status, Transaction_id, Amount, Currency, Customer_Number
    const {
      Reference,
      reference,
      Trans_Status,
      Status,
      Transaction_id,
      Trans_Status_Description,
      Amount,
      Customer_Number
    } = callbackData;

    const transactionRef = Reference || reference;
    const finalStatus = Trans_Status || Status;
    const freshpayTransactionId = Transaction_id;

    console.log('📋 Parsed webhook data:', {
      reference: transactionRef,
      status: finalStatus,
      freshpayTxId: freshpayTransactionId,
      amount: Amount,
      phone: Customer_Number
    });

    if (!transactionRef && !freshpayTransactionId) {
      console.error('❌ No reference or transaction_id in webhook');
      return res.status(400).json({ error: 'Missing reference or transaction_id' });
    }

    // Determine new status
    let newStatus = 'PENDING';
    if (finalStatus === 'Successful' || finalStatus === 'Success') {
      newStatus = 'SUCCESS';
    } else if (finalStatus === 'Failed' || finalStatus === 'Failure') {
      newStatus = 'FAILED';
    }

    console.log(`🔄 Updating transaction to status: ${newStatus}`);

    // Build the query to find the transaction
    // Try matching by moko_reference (our reference) or freshpay_ref (their transaction_id)
    let query = supabase.from('transactions').update({ 
      status: newStatus,
      freshpay_ref: freshpayTransactionId || undefined,
      metadata: {
        callback_data: callbackData,
        final_status: finalStatus,
        status_description: Trans_Status_Description,
        amount_confirmed: Amount,
        customer_number: Customer_Number,
        updated_at: new Date().toISOString()
      }
    });

    // Match by reference or freshpay transaction ID
    if (transactionRef && freshpayTransactionId) {
      query = query.or(`moko_reference.eq.${transactionRef},freshpay_ref.eq.${freshpayTransactionId}`);
    } else if (transactionRef) {
      query = query.eq('moko_reference', transactionRef);
    } else {
      query = query.eq('freshpay_ref', freshpayTransactionId);
    }

    const { data: updatedTransaction, error: updateError } = await query.select();

    if (updateError) {
      console.error('❌ Supabase update error:', updateError);
      return res.status(500).json({ error: 'Failed to update transaction', details: updateError.message });
    }

    if (!updatedTransaction || updatedTransaction.length === 0) {
      console.warn('⚠️ No transaction found for reference:', transactionRef, 'or freshpay_ref:', freshpayTransactionId);
      // Still return success to FreshPay so they don't retry
      return res.json({ 
        status: 'No matching transaction found',
        reference: transactionRef
      });
    }

    console.log(`✅ Transaction ${transactionRef} updated to ${newStatus}`, updatedTransaction);

    res.json({ 
      status: 'Callback processed successfully',
      transaction_status: newStatus,
      reference: transactionRef,
      transaction_id: updatedTransaction[0]?.id
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ status: 'Error logged', error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Africanite Payment Hub running on port ${PORT}`);
  console.log(`📱 Initiate Payment: POST http://localhost:${PORT}/initiate-payment`);
  console.log(`🔔 Webhook: POST http://localhost:${PORT}/moko-webhook`);
});
