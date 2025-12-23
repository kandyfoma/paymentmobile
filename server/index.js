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
  
  if (['81', '82', '83'].includes(prefix)) return 'vodacom';
  if (['84', '85', '86', '89', '90', '91', '97', '99'].includes(prefix)) return 'airtel';
  if (['80', '84', '85', '86', '89'].includes(prefix)) return 'orange';
  if (['98'].includes(prefix)) return 'africell';
  
  return 'vodacom';
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
      lastname = 'Customer',
      email = 'customer@africanite.com'
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

    console.log('Calling FreshPay API:', apiBaseUrl);

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

// Moko Webhook
app.post('/moko-webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body));
    
    const callbackData = req.body;

    if (callbackData.data) {
      console.log('Encrypted callback received');
      return res.json({ status: 'Callback received' });
    }

    const {
      Reference,
      reference,
      Trans_Status,
      Status,
      Transaction_id,
      Trans_Status_Description
    } = callbackData;

    const transactionRef = Reference || reference;
    const finalStatus = Trans_Status || Status;

    if (!transactionRef) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    let newStatus = 'PENDING';
    if (finalStatus === 'Successful' || finalStatus === 'Success') {
      newStatus = 'SUCCESS';
    } else if (finalStatus === 'Failed') {
      newStatus = 'FAILED';
    }

    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update({ 
        status: newStatus,
        freshpay_ref: Transaction_id || undefined,
        metadata: {
          callback_data: callbackData,
          final_status: finalStatus,
          status_description: Trans_Status_Description,
          updated_at: new Date().toISOString()
        }
      })
      .or(`moko_reference.eq.${transactionRef},freshpay_ref.eq.${transactionRef}`)
      .select();

    if (updateError) {
      console.error('Update error:', updateError);
    }

    console.log(`Transaction ${transactionRef} updated to ${newStatus}`);

    res.json({ 
      status: 'Callback processed',
      transaction_status: newStatus,
      reference: transactionRef
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
