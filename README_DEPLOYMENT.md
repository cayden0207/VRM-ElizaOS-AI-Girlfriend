# Deployment Guide – Vercel

## 🚀 Quick Start

### 1) Prerequisites

Have the following ready:
- Vercel account
- OpenAI API key (required)
- Supabase project (optional)

### 2) Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

```bash
# Required
OPENAI_API_KEY=sk-xxxxx            # Your OpenAI API key

# Voice (optional)
ELEVENLABS_API_KEY=sk_xxxxx        # ElevenLabs TTS API key

# Database (optional but recommended)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx

# API limits (optional)
RATE_LIMIT_WINDOW_MS=900000        # 15-minute window
RATE_LIMIT_MAX_REQUESTS=100        # Max requests per IP per window
```

### 3) Deploy

1. Fork or clone this repo
2. Import the project into Vercel
3. Configure env vars
4. Deploy

### 4) Security Notes

✅ Improvements already in place:
- ✅ No API keys hard‑coded in the frontend
- ✅ Frontend calls backend API proxy for OpenAI
- ✅ Rate limiting added
- ✅ Sensitive data via env vars

⚠️ Recommendations:
- Never expose API keys in frontend code
- Rotate keys regularly
- Monitor usage to avoid overage
- Use different keys per environment

### 5) API Flow

```
User → Frontend → Backend (/api/chat) → OpenAI API
        ↑                         ↓
        ←────────── Response ─────
```

### 6) Cost Control Tips

- Prefer `gpt-3.5-turbo` over `gpt-4` when possible
- Implement auth and quotas
- Monitor per‑user usage
- Consider paid subscriptions

### 7) Troubleshooting

If you run into issues:
1. Check Vercel function logs
2. Verify env vars
3. Validate API keys
4. Check if rate limits triggered

## 📝 Files

- `vercel.json` – Vercel routing/headers
- `api/index.js` – Backend API entry
- `.env` / env vars – Project configuration

## 🔒 Best Practices

1. API keys
   - Use Vercel env vars
   - Separate keys per env
   - Rotate regularly

2. Rate limiting
   - IP‑based limits in place
   - Stricter limits for chat endpoints

3. Authentication
   - Wallet address supported
   - Consider additional auth methods

## 📊 Monitoring

- Vercel Analytics for performance
- OpenAI usage alerts
- Track API error rate
- Monitor user activity

## 🆘 Help

- Vercel docs: https://vercel.com/docs
- OpenAI docs: https://platform.openai.com/docs
- Project Issues: open an issue in the repo
