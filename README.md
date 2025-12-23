# Africanite Services - Mobile Money Payment Hub

> Centralized payment service for multiple Africanite mobile applications using Moko Mobile Money (FreshPay PayDRC API)

[![Status](https://img.shields.io/badge/status-production-success)]() [![Platform](https://img.shields.io/badge/platform-Railway-brightgreen)]() [![Region](https://img.shields.io/badge/region-EU%20West-blue)]()

## 🏗️ Architecture Overview

This is a **Hub-and-Spoke** payment architecture where:
- **The Hub**: Railway Express Server (centralized payment logic with fixed IP)
- **The Spokes**: Your mobile apps (React Native apps + React.js web app)
- **The Provider**: Moko Mobile Money via FreshPay PayDRC API
- **The Database**: Supabase PostgreSQL with real-time subscriptions

### Why This Architecture?

✅ **Security** - API keys stay on the server, never in mobile apps  
✅ **Fixed IP** - Railway provides static IP for payment provider whitelisting  
✅ **Maintainability** - Update payment logic once, all apps benefit  
✅ **Scalability** - Add new apps without duplicating code  
✅ **Auditability** - Single dashboard for all transactions  
✅ **Real-time** - Apps get instant payment confirmations via Supabase subscriptions

---

## 🚀 Quick Start for Your Apps

### Payment Endpoint
```
https://web-production-a4586.up.railway.app/initiate-payment
```

### Required Fields
- `app_name` - Your app identifier (e.g., "Africanite App A")
- `user_id` - User's ID from your app (optional but recommended)
- `amount` - Payment amount (minimum 1)
- `phone_number` - Customer's phone number (format: 243XXXXXXXXX)
- `currency` - Payment currency (default: "USD")
- `firstname` - Customer's first name (optional)
- `lastname` - Customer's last name (optional)
- `email` - Customer's email (optional)

---

## 📱 Integration Examples

### React Native Integration

#### Step 1: Create Payment Screen

**Create a file: `lib/supabase.js` (for both React Native & React.js)**

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oacrwvfivsybkvndooyx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY3J3dmZpdnN5Ymt2bmRvb3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4OTI3NzEsImV4cCI6MjA1MDQ2ODc3MX0.sb_publishable_wj3fQLQJ808R5CG5FG8FYw_5J11Ps4g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 💳 React Native Mobile App Integration

### Step 3: Create Payment Service

**Create: `services/paymentService.js`**

```javascript
import { supabase } from '../lib/supabase';

export const initiatePayment = async (appName, userId, amount, phoneNumber) => {
  try {
    const { data, error } = await supabase.functions.invoke('initiate-payment', {
      body: {
        app_name: appName,
        user_id: userId,
        amount: amount,

```javascript
// services/paymentService.js
import { createClient } from '@supabase/supabase-js';

const PAYMENT_API_URL = 'https://web-production-a4586.up.railway.app/initiate-payment';
const SUPABASE_URL = 'https://oacrwvfivsybkvndooyx.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Get from CREDENTIALS_SECURE.txt

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const initiatePayment = async (appName, userId, amount, phoneNumber, userInfo = {}) => {
  try {
    // Call Railway payment endpoint
    const response = await fetch(PAYMENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_name: appName,
        user_id: userId,
        amount: amount,
        phone_number: phoneNumber,
        currency: 'USD',
        firstname: userInfo.firstname || 'Customer',
        lastname: userInfo.lastname || 'Customer',
        email: userInfo.email || 'customer@africanite.com'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Payment initiation failed');
    }

    return data.transaction_id;
  } catch (error) {
    console.error('Payment initiation failed:', error);
    throw error;
  }
};

export const subscribeToPaymentStatus = (transactionId, onStatusChange) => {
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
        onStatusChange(payload.new.status);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
```

#### Step 2: Create Payment Screen Component

**screens/PaymentScreen.js**

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { initiatePayment, subscribeToPaymentStatus } from '../services/paymentService';

const PaymentScreen = ({ route, navigation }) => {
  const { amount, userId, appName } = route.params;
  
  const [provider, setProvider] = useState('Vodacom M-Pesa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('PENDING');

  useEffect(() => {
    if (!transactionId) return;

    // Subscribe to real-time payment status updates
    const unsubscribe = subscribeToPaymentStatus(transactionId, (status) => {
      setPaymentStatus(status);
      
      if (status === 'SUCCESS') {
        Alert.alert('✅ Success', 'Payment completed successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else if (status === 'FAILED') {
        Alert.alert('❌ Failed', 'Payment failed. Please try again.');
        setTransactionId(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [transactionId]);

  const handlePayment = async () => {
    if (!phoneNumber || phoneNumber.length < 12) {
      Alert.alert('Error', 'Please enter a valid phone number (243XXXXXXXXX)');
      return;
    }

    setLoading(true);

    try {
      const txId = await initiatePayment(
        appName || 'AfricaniteApp',
        userId,
        amount,
        phoneNumber
      );
      
      setTransactionId(txId);
      Alert.alert(
        '📱 Check Your Phone',
        `A payment request has been sent to ${phoneNumber}. Please enter your PIN to complete.`
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to initiate payment');
      setLoading(false);
    }
  };

  if (transactionId && paymentStatus === 'PENDING') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.waitingText}>⏳ Waiting for payment confirmation...</Text>
        <Text style={styles.instructionText}>
          Please enter your PIN on {phoneNumber}
        </Text>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => {
            setTransactionId(null);
            setLoading(false);
          }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💳 Make Payment</Text>
      <Text style={styles.amountText}>Amount: ${amount} USD</Text>

      <Text style={styles.label}>Select Provider:</Text>
      <Picker
        selectedValue={provider}
        onValueChange={setProvider}
        style={styles.picker}
      >
        <Picker.Item label="🔵 Vodacom M-Pesa" value="Vodacom M-Pesa" />
        <Picker.Item label="🔴 Airtel Money" value="Airtel Money" />
        <Picker.Item label="🟠 Orange Money" value="Orange Money" />
        <Picker.Item label="🟢 Africell" value="Africell" />
      </Picker>

      <Text style={styles.label}>Phone Number:</Text>
      <TextInput
        style={styles.input}
        placeholder="243828812498"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        maxLength={12}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handlePayment}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Pay ${amount} USD</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  amountText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  picker: {
    backgroundColor: '#fff',
    marginBottom: 20,
    borderRadius: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waitingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
  },
  cancelButton: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: 16,
  },
});

export default PaymentScreen;
```

#### Step 3: Navigate to Payment Screen

```javascript
// From anywhere in your app
navigation.navigate('Payment', {
  amount: 10,  // Amount in USD
  userId: currentUser.id,
  appName: 'Africanite App A'
});
```

---

### React.js Web Integration

#### Step 1: Create Payment Service

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment</Text>
      <Text style={styles.amount}>{amount} CDF</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Phone Number (243XXXXXXXXX)"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        maxLength={12}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handlePayment}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Pay Now</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waitingText: {
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default PaymentScreen;
```

### Step 5: Navigate to Payment Screen

**From your app's checkout/cart screen:**

```javascript
navigation.navigate('Payment', {
  amount: 5000,
  userId: currentUser.id,
  appName: 'TaxiApp' // Your app's name
});
```

---

## 🌐 React.js Web App Integration

### Step 3: Create Payment Hook

**Create: `hooks/usePayment.js`**

```javascript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [status, setStatus] = useState('PENDING');

  const initiatePayment = async (appName, userId, amount, phoneNumber) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('initiate-payment', {
        body: {
          app_name: appName,
          user_id: userId,
          amount: amount,
          phone_number: phoneNumber,
          currency: 'CDF'
        }
      });

      if (error) throw error;
      
      setTransactionId(data.transaction_id);
      return data.transaction_id;
    } catch (error) {
      console.error('Payment failed:', error);
      setLoading(false);
      throw error;
    }
  };

  useEffect(() => {
    if (!transactionId) return;

    const channel = supabase
      .channel('payment-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `id=eq.${transactionId}`
      }, (payload) => {
        setStatus(payload.new.status);
        if (payload.new.status !== 'PENDING') {
          setLoading(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId]);

  return { initiatePayment, loading, status, transactionId };
};
```

### Step 4: Create Payment Component

**Create: `components/PaymentModal.jsx`**

```javascript
import React, { useState } from 'react';
import { usePayment } from '../hooks/usePayment';
import './PaymentModal.css'; // Add your styles

const PaymentModal = ({ amount, userId, appName, onClose, onSuccess }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const { initiatePayment, loading, status } = usePayment();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber.match(/^243\d{9}$/)) {
      setError('Invalid phone number. Format: 243XXXXXXXXX');
      return;
    }

    try {
      await initiatePayment(appName, userId, amount, phoneNumber);
    } catch (err) {
      setError(err.message || 'Failed to initiate payment');
    }
  };

  // Handle success
  if (status === 'SUCCESS') {
    return (
      <div className="payment-modal">
        <div className="success-message">
          <svg className="checkmark" viewBox="0 0 52 52">
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          <h2>Payment Successful!</h2>
          <p>Your payment of {amount} CDF has been completed.</p>
          <button onClick={() => { onSuccess(); onClose(); }}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Handle failure
  if (status === 'FAILED') {
    return (
      <div className="payment-modal">
        <div className="error-message">
          <span className="error-icon">❌</span>
          <h2>Payment Failed</h2>
          <p>The payment could not be completed.</p>
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Waiting for payment
  if (loading && status === 'PENDING') {
    return (
      <div className="payment-modal">
        <div className="waiting-message">
          <div className="spinner"></div>
          <h2>Waiting for payment...</h2>
          <p>Please check your phone and enter your PIN</p>
        </div>
      </div>
    );
  }

  // Payment form
  return (
    <div className="payment-modal">
      <div className="payment-form">
        <h2>Complete Payment</h2>
        <p className="amount">{amount} CDF</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="243XXXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              maxLength={12}
              required
            />
            <small>Format: 243 + 9 digits</small>
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Pay Now'}
          </button>
          <button type="button" onClick={onClose} className="cancel">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
```

### Step 5: Use Payment Modal

**In your checkout/cart page:**

```javascript
import React, { useState } from 'react';
import PaymentModal from '../components/PaymentModal';

function CheckoutPage() {
  const [showPayment, setShowPayment] = useState(false);
  const cartTotal = 15000; // Your cart total

  const handlePaymentSuccess = () => {
    // Handle successful payment
    console.log('Payment completed!');
    // Clear cart, redirect, etc.
  };

  return (
    <div>
      <h1>Checkout</h1>
      <p>Total: {cartTotal} CDF</p>
      
      <button onClick={() => setShowPayment(true)}>
        Pay with Mobile Money
      </button>

      {showPayment && (
        <PaymentModal
          amount={cartTotal}
          userId="user_123"
          appName="EcommerceWeb"
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
```

---

## 💳 Quick Integration Summary

### For React Native (Mobile Apps):
1. Install: `npm install @supabase/supabase-js`
2. Copy `lib/supabase.js` and `services/paymentService.js`
3. Use `PaymentScreen` component
4. Navigate with amount, userId, appName

### For React.js (Web App):
1. Install: `npm install @supabase/supabase-js`
2. Copy `lib/supabase.js` and `hooks/usePayment.js`
3. Use `PaymentModal` component
4. Show modal on checkout

---

## 🔄 Complete Payment Flow Example (React Native)

Here's how all the pieces work together:
        'user_id': userId,           // Your app's user ID
        'amount': amount,            // e.g., 1000
        'phone_number': phoneNumber, // e.g., '243XXXXXXXXX'
        'currency': 'CDF',           // Congolese Franc
      },
    );

    final data = response.data as Map<String, dynamic>;
    return data['transaction_id']; // Store this to track the payment
  } catch (e) {
    print('Payment initiation failed: $e');
    rethrow;
  }
}
```

**React Native:**
```javascript
async function initiatePayment(appName, userId, amount, phoneNumber) {
  try {
    const { data, error } = await supabase.functions.invoke('initiate-payment', {
      body: {
        app_name: appName,
        user_id: userId,
        amount: amount,
        phone_number: phoneNumber,
        currency: 'CDF'
      }
    });

    if (error) throw error;
    return data.transaction_id;
  } catch (error) {
    console.error('Payment failed:', error);
    throw error;
  }
}
```

**Android (Kotlin):**
```kotlin
suspend fun initiatePayment(
    appName: String,
    userId: String,
    amount: Double,
    phoneNumber: String
): String {
    val response = supabase.functions.invoke(
        function = "initiate-payment",
        body = mapOf(
            "app_name" to appName,
            "user_id" to userId,
            "amount" to amount,
            "phone_number" to phoneNumber,
            "currency" to "CDF"
        )
    )
    
    return response["transaction_id"] as String
}
```

### Step 4: Listen for Payment Confirmation (Real-time)

After initiating payment, subscribe to the transaction status. When the user enters their PIN, you'll get an instant update:

**Flutter:**
```dart
Stream<String> listenToPaymentStatus(String transactionId) {
  return supabase
      .from('transactions')
      .stream(primaryKey: ['id'])
      .eq('id', transactionId)
      .map((data) {
        if (data.isNotEmpty) {
          return data.first['status'] as String;
        }
        return 'PENDING';
      });
}

// Usage in your widget:
StreamBuilder<String>(
  stream: listenToPaymentStatus(transactionId),
  builder: (context, snapshot) {
    if (snapshot.data == 'SUCCESS') {
      return Text('Payment Successful! ✅');
    } else if (snapshot.data == 'FAILED') {
      return Text('Payment Failed ❌');
    } else {
      return CircularProgressIndicator(); // Still pending
    }
  },
)
```

**React Native:**
```javascript
function PaymentStatus({ transactionId }) {
  const [status, setStatus] = useState('PENDING');

  useEffect(() => {
    const channel = supabase
      .channel('transaction-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `id=eq.${transactionId}`
      }, (payload) => {
        setStatus(payload.new.status);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId]);

  if (status === 'SUCCESS') {
    return <Text>Payment Successful! ✅</Text>;
  } else if (status === 'FAILED') {
    return <Text>Payment Failed ❌</Text>;
  } else {
    return <ActivityIndicator />;
  }
}
```

**Android (Kotlin):**
```kotlin
supabase.realtime.createChannel("transactions")
    .postgresChangeFlow<PostgresAction.Update>(schema = "public") {
        table = "transactions"
        filter = "id=eq.$transactionId"
    }
    .collect { action ->
        val status = action.record["status"] as String
        when (status) {
            "SUCCESS" -> showSuccessUI()
            "FAILED" -> showErrorUI()
        }
    }
```

---

## 🔄 Complete Payment Flow Example

Here's a full implementation showing the entire payment journey:

**Flutter Complete Example:**
```dart
class PaymentScreen extends StatefulWidget {
  @override
  _PaymentScreenState createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  String? transactionId;
  bool isProcessing = false;

  Future<void> processPayment() async {
    setState(() => isProcessing = true);

    try {
      // Step 1: Initiate payment
      final txId = await initiatePayment(
        appName: 'TaxiApp',
        userId: 'user_123',
        amount: 5000, // 5000 CDF
        phoneNumber: '243XXXXXXXXX',
      );

      setState(() => transactionId = txId);

      // Step 2: Listen for status (handled by StreamBuilder below)
      // User will see STK push on their phone now
      
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to initiate payment: $e')),
      );
      setState(() => isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (transactionId == null) {
      return ElevatedButton(
        onPressed: isProcessing ? null : processPayment,
        child: Text(isProcessing ? 'Processing...' : 'Pay 5000 CDF'),
      );
    }

    return StreamBuilder<String>(
      stream: listenToPaymentStatus(transactionId!),
      builder: (context, snapshot) {
        final status = snapshot.data ?? 'PENDING';

        switch (status) {
          case 'SUCCESS':
            return Column(
              children: [
                Icon(Icons.check_circle, color: Colors.green, size: 64),
                Text('Payment Successful!'),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Continue'),
                ),
              ],
            );
          case 'FAILED':
            return Column(
              children: [
                Icon(Icons.error, color: Colors.red, size: 64),
                Text('Payment Failed'),
                ElevatedButton(
                  onPressed: () => setState(() => transactionId = null),
                  child: Text('Try Again'),
                ),
              ],
            );
          default:
            return Column(
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Waiting for payment confirmation...'),
                Text('Please enter your PIN on your phone'),
              ],
            );
        }
      },
    );
  }
}
```

---

## 📋 API Reference

### Endpoint: `initiate-payment`

**URL:** `https://oacrwvfivsybkvndooyx.supabase.co/functions/v1/initiate-payment`

**Method:** POST

**Request Body:**
```json
{
  "app_name": "string (required)",
  "user_id": "string (optional)",
  "amount": "number (required)",
  "phone_number": "string (required, format: 243XXXXXXXXX)",
  "currency": "string (optional, default: CDF)"
}
```

**Response Success (200):**
```json
{
  "transaction_id": "uuid",
  "message": "Payment initiated"
}
```

**Response Error (400/500):**
```json
{
  "error": "Error message"
}
```

### Database Table: `transactions`

Subscribe to this table to get real-time payment updates:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Transaction ID (primary key) |
| `created_at` | Timestamp | When transaction was created |
| `app_name` | Text | Which app initiated (e.g., "TaxiApp") |
| `user_id` | Text | Your app's user ID |
| `phone_number` | Text | Customer's phone number |
| `amount` | Numeric | Payment amount |
| `currency` | Text | Currency code (CDF) |
| `status` | Text | PENDING → SUCCESS or FAILED |
| `freshpay_ref` | Text | FreshPay reference number |
| `metadata` | JSONB | Additional data |

---

## 🎯 Best Practices

### 1. **App Naming Convention**
Use consistent, descriptive names for your apps:
- ✅ Good: `"TaxiApp"`, `"FoodDelivery"`, `"EcommerceStore"`
- ❌ Bad: `"App1"`, `"Test"`, `"MyApp"`

### 2. **Phone Number Format**
Always use DRC format with country code:
- ✅ Correct: `"243XXXXXXXXX"` (243 + 9 digits)
- ❌ Wrong: `"0XXXXXXXXX"`, `"+243XXXXXXXXX"`

### 3. **Error Handling**
```dart
try {
  final txId = await initiatePayment(...);
} catch (e) {
  if (e.toString().contains('Missing required fields')) {
    // Show "Please fill all fields" message
  } else if (e.toString().contains('Server configuration error')) {
    // Show "Service temporarily unavailable"
  } else {
    // Show generic error
  }
}
```

### 4. **Timeout Handling**
Set a reasonable timeout for payment confirmations:
```dart
Future<String> waitForPayment(String txId) async {
  return await listenToPaymentStatus(txId)
      .firstWhere((status) => status != 'PENDING')
      .timeout(
        Duration(minutes: 5), // 5 minutes max
        onTimeout: () => 'TIMEOUT',
      );
}
```

### 5. **Testing**
Start with small amounts for testing:
- Test Amount: 100 CDF
- Production: Full amounts

---

## 🔒 Security Notes

✅ **What's Secure:**
- API keys are stored server-side only
- Supabase anon key is public and safe to use in apps
- Real Moko credentials never touch mobile apps

⚠️ **Important:**
- Never hardcode phone numbers in production
- Always validate user input before calling API
- Use Row Level Security (RLS) if storing user-specific data

---

## 🐛 Troubleshooting

### Payment Stuck in PENDING
**Cause:** User didn't enter PIN or cancelled  
**Solution:** Implement timeout (5 minutes) and allow retry

### "Missing required fields" Error
**Cause:** Missing `app_name`, `amount`, or `phone_number`  
**Solution:** Validate all fields before calling API

### Real-time Not Working
**Cause:** Subscription not set up correctly  
**Solution:** Ensure you're filtering by `id=eq.{transactionId}`

### Function Returns 500 Error
**Cause:** Server configuration issue  
**Solution:** Check Supabase Functions logs in dashboard

---

## 📊 Monitoring & Analytics

### View Transactions in Dashboard
1. Go to: https://supabase.com/dashboard/project/oacrwvfivsybkvndooyx
2. Click "Table Editor" → "transactions"
3. See all payments across all apps

### Query by App
```sql
-- See all TaxiApp transactions
SELECT * FROM transactions 
WHERE app_name = 'TaxiApp' 
ORDER BY created_at DESC;

-- Revenue by app
SELECT app_name, SUM(amount) as total_revenue 
FROM transactions 
WHERE status = 'SUCCESS' 
GROUP BY app_name;
```

### Moko Merchant Portal
Access detailed financial reports:  
https://cd.merchants.gofreshpay.com/login

---

## 📞 Support

- **Technical Issues:** support@gofreshbakery.com
- **API Documentation:** https://developer.gofreshpay.com/
- **Supabase Help:** https://supabase.com/dashboard/project/oacrwvfivsybkvndooyx

---

## 📄 License

This project is proprietary to Africanite Services.

---

**Built with ❤️ for Africanite Services**  
*Making payments simple across all our apps*
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```

  To upgrade:

  ```powershell
  scoop update supabase
  ```
</details>

<details>
  <summary><b>Linux</b></summary>

  Available via [Homebrew](https://brew.sh) and Linux packages.

  #### via Homebrew

  To install:

  ```sh
  brew install supabase/tap/supabase
  ```

  To upgrade:

  ```sh
  brew upgrade supabase
  ```

  #### via Linux packages

  Linux packages are provided in [Releases](https://github.com/supabase/cli/releases). To install, download the `.apk`/`.deb`/`.rpm`/`.pkg.tar.zst` file depending on your package manager and run the respective commands.

  ```sh
  sudo apk add --allow-untrusted <...>.apk
  ```

  ```sh
  sudo dpkg -i <...>.deb
  ```

  ```sh
  sudo rpm -i <...>.rpm
  ```

  ```sh
  sudo pacman -U <...>.pkg.tar.zst
  ```
</details>

<details>
  <summary><b>Other Platforms</b></summary>

  You can also install the CLI via [go modules](https://go.dev/ref/mod#go-install) without the help of package managers.

  ```sh
  go install github.com/supabase/cli@latest
  ```

  Add a symlink to the binary in `$PATH` for easier access:

  ```sh
  ln -s "$(go env GOPATH)/bin/cli" /usr/bin/supabase
  ```

  This works on other non-standard Linux distros.
</details>

<details>
  <summary><b>Community Maintained Packages</b></summary>

  Available via [pkgx](https://pkgx.sh/). Package script [here](https://github.com/pkgxdev/pantry/blob/main/projects/supabase.com/cli/package.yml).
  To install in your working directory:

  ```bash
  pkgx install supabase
  ```

  Available via [Nixpkgs](https://nixos.org/). Package script [here](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/supabase-cli/default.nix).
</details>

### Run the CLI

```bash
supabase bootstrap
```

Or using npx:

```bash
npx supabase bootstrap
```

The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

## Developing

To run from source:

```sh
# Go >= 1.22
go run . help
```
