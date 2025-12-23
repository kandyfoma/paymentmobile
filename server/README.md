# Africanite Payment Server (Railway Deployment)

Fixed IP payment server for Moko Mobile Money integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Fill in your credentials in `.env`

4. Run locally:
```bash
npm start
```

## Deploy to Railway

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select this repository
5. Railway will auto-detect and deploy
6. Add environment variables in Railway dashboard
7. Get your fixed IP and domain

## Endpoints

- `POST /initiate-payment` - Initiate a payment
- `POST /moko-webhook` - Webhook for FreshPay callbacks
- `GET /` - Health check
