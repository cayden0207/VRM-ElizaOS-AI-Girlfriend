# 🔒 Security & Optimization Checklist

## ✅ Completed Hardening

### API Security
- [x] Move OpenAI API key to backend
- [x] Move ElevenLabs API key to backend  
- [x] Add API rate limiting
- [x] Standardize env var management

### Configuration Safety
- [x] Remove Supabase keys from frontend
- [x] Auto environment detection
- [x] Production config optimization
- [x] Increase Vercel function timeout to 25s

### CORS
- [x] Restrict to production domains
- [x] Request body size limit

---

## ⚠️ To Improve

### High Priority (before go‑live)

1. **Wallet signature verification** 
   - File: `config.js:39`
   - Issue: Enable signature verification in production
   - Fix: Set `requireWalletSignature: true`

2. **Env configuration**
   - Add in Vercel: `FRONTEND_URL=https://your-domain.vercel.app`

### Medium Priority (near term)

3. **Memory management**
   - Problem: Unbounded chat history can leak memory
   - Suggestion: LRU cache or periodic cleanup

4. **Error handling**
   - Global error middleware
   - Unified error response format
   - Centralized error logging

5. **Performance**
   - API response cache
   - Profile cache
   - DB connection pooling

### Low Priority (long term)

6. **Monitoring & logging**
   - Vercel Analytics
   - API performance metrics
   - Error tracking (Sentry, etc.)

7. **User Experience**
   - Offline support
   - Better loading states
   - Error retry strategy

---

## 🚀 Pre‑deployment Checklist

### Vercel Environment Variables
- [ ] `OPENAI_API_KEY`
- [ ] `ELEVENLABS_API_KEY` (optional)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `FRONTEND_URL` (for CORS)
- [ ] `NODE_ENV=production`

### Functional Tests
- [ ] Registration / login flow
- [ ] AI chat
- [ ] Voice playback
- [ ] Wallet connection
- [ ] Profile management
- [ ] Rate‑limit behavior

### Performance Tests
- [ ] API p95 < 3s
- [ ] First paint < 2s
- [ ] Memory usage monitored
- [ ] Concurrency test

---

## 📊 Recommended Metrics

### Business
- DAU
- Chat messages volume
- API success rate
- Retention

### Technical  
- API latency
- Error rate
- Vercel function duration
- DB query performance

### Cost
- OpenAI usage
- ElevenLabs usage
- Vercel function time
- DB storage

---

## 🛡️ Best Practices

1. **Key rotation**
   - Rotate monthly
   - Use strong randomness

2. **Access control**
   - IP allow‑list (if applicable)
   - User‑level rate limiting

3. **Data protection**
   - Encrypt sensitive data at rest
   - GDPR / data‑privacy compliance

4. **Security updates**
   - Regular dependency updates
   - Track advisories / CVEs

---

## 📈 Scalability

### Data
- Redis cache for hot data
- Consider dedicated store for chat history

### API  
- Consider GraphQL
- API versioning
- Microservices (if needed)

### Users
- Multi‑tenant support
- Permission model
- Subscriptions & billing
