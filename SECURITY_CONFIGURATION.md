# Security Configuration Guide

This document outlines the minimum viable security configuration for WhoFed, balancing user friction with security best practices.

---

## Risk Assessment

**App Risk Level: LOW**

- ✅ No payment information
- ✅ No health/medical data
- ✅ No sensitive PII beyond email addresses
- ✅ Main data: Pet feeding schedules and household task completion

**Worst Case Scenario:**
- Attacker accesses account → views pet schedules, marks tasks complete
- **Impact:** Annoying but not catastrophic
- **Mitigation:** Email verification + basic password requirements

---

## ✅ Required Security Measures

### 1. Email Verification (REQUIRED)

**Why:** Prevents typos, reduces spam accounts, verifies email ownership

**Status:** Must be enabled in all environments (dev, QA, prod)

**Configuration:**
1. Go to Supabase Dashboard → Authentication → Email Auth
2. Enable "Confirm email"
3. Users receive confirmation email on signup
4. Cannot log in until email is verified

**Environments:**
- **Production:** https://supabase.com/dashboard/project/ryrwlkbzyldzbscvcqjh/auth/users
- **Dev:** https://supabase.com/dashboard/project/orjsgwpukribilmjzkat/auth/users
- **QA:** https://supabase.com/dashboard/project/mjmfxjhdvguiaaebkzxd/auth/users

### 2. Basic Password Requirements (REQUIRED)

**Current Configuration:**
- Minimum 8 characters
- No complexity requirements (no special chars/numbers required)

**Why This Is Sufficient:**
- 8 characters provides baseline protection
- Complex requirements cause user friction
- Low-risk app doesn't need enterprise-grade policies

**To Verify:**
- Supabase Dashboard → Authentication → Settings
- Check "Minimum Password Length" = 8

### 3. Rate Limiting (AUTOMATIC)

**Status:** ✅ Enabled by default in Supabase

**Protection Against:**
- Brute force password attacks
- Signup spam
- API abuse

**No action required** - Supabase handles this automatically.

---

## ⚠️ Recommended Optional Security

### 4. Two-Factor Authentication (2FA)

**Configuration:** Enable but make optional for users

**How to Enable:**
1. Supabase Dashboard → Authentication → Settings
2. Enable "Enable Phone Sign-ups" or "Enable TOTP"
3. Users can opt-in from their profile settings

**Recommendation:** Enable TOTP (authenticator app) 2FA, not phone-based
- More secure
- No SMS costs
- Works offline

**User Experience:**
- ✅ Optional (power users can enable)
- ✅ No friction for average users
- ✅ Available for household owners who want extra security

### 5. Session Management

**Current Defaults (Keep These):**
- Session timeout: 3600 seconds (1 hour)
- Refresh token timeout: 2592000 seconds (30 days)

**To verify:**
- Supabase Dashboard → Authentication → Settings
- Check "JWT expiry limit" and "Refresh token rotation"

---

## ❌ Do NOT Implement (Too Much Friction)

### Skip These Security Measures:

- ❌ **Complex password requirements** (special chars, numbers, capitals)
  - Why skip: Creates user friction for low-risk app

- ❌ **Mandatory 2FA**
  - Why skip: Too much friction for a pet care app

- ❌ **Phone verification**
  - Why skip: Costs money, adds friction, email is sufficient

- ❌ **Password rotation policies** (force password change every X days)
  - Why skip: Outdated security practice, annoys users

- ❌ **Security questions**
  - Why skip: Less secure than other methods, easy to guess

- ❌ **CAPTCHA on signup**
  - Why skip: Email verification + rate limiting is sufficient

---

## 🛡️ Security Already In Place

### Application-Level Security (Already Implemented)

✅ **Row Level Security (RLS)**
- Users can only see their own households
- Policies enforce data isolation
- SQL-level protection

✅ **HTTPS/TLS**
- Vercel enforces HTTPS
- Supabase uses TLS
- All traffic encrypted

✅ **JWT Authentication**
- Secure token-based auth
- Tokens expire appropriately
- Refresh token rotation enabled

✅ **SQL Injection Protection**
- Supabase client uses parameterized queries
- No raw SQL from user input

✅ **XSS Protection**
- Svelte auto-escapes HTML
- No dangerouslySetInnerHTML usage

---

## Quick Setup Checklist

### Initial Setup (Do Once Per Environment)

**Production:**
```
1. ✅ Go to https://supabase.com/dashboard/project/ryrwlkbzyldzbscvcqjh/auth/providers
2. ✅ Enable "Confirm email" under Email Auth
3. ✅ Set "Minimum Password Length" to 8
4. ✅ Enable TOTP 2FA (optional for users)
5. ✅ Verify rate limiting is enabled (default)
```

**Dev:**
```
1. ✅ Go to https://supabase.com/dashboard/project/orjsgwpukribilmjzkat/auth/providers
2. ✅ Enable "Confirm email"
3. ✅ Set "Minimum Password Length" to 8
4. ✅ Enable TOTP 2FA (optional)
```

**QA:**
```
1. ✅ Go to https://supabase.com/dashboard/project/mjmfxjhdvguiaaebkzxd/auth/providers
2. ✅ Enable "Confirm email"
3. ✅ Set "Minimum Password Length" to 8
4. ✅ Enable TOTP 2FA (optional)
```

---

## Testing Security Configuration

### Email Verification Test

1. Sign up with a new email
2. Should receive confirmation email
3. Cannot log in until email is confirmed
4. Click confirmation link
5. Can now log in

### Password Requirements Test

1. Try to sign up with password "abc123" (6 chars)
2. Should fail with "Password must be at least 8 characters"
3. Try with "abcd1234" (8 chars)
4. Should succeed

### Rate Limiting Test

1. Attempt 10+ failed logins rapidly
2. Should be temporarily blocked
3. Wait 60 seconds
4. Should be able to try again

---

## Future Security Enhancements (When Needed)

**Consider adding if app grows:**

- 🔒 Account lockout after X failed attempts
- 🔒 Login notification emails
- 🔒 Suspicious activity alerts
- 🔒 Device fingerprinting
- 🔒 IP-based access restrictions

**Don't add these until:**
- You have 1000+ users
- You see abuse patterns
- Users request them

---

## Security Monitoring

### What to Monitor:

1. **Failed login attempts** (Supabase Dashboard → Logs)
2. **Unusual signup patterns** (multiple accounts from same IP)
3. **Data access patterns** (RLS policy violations in logs)

### How to Monitor:

- Supabase Dashboard → Logs → Filter by "auth" events
- Set up log drains if you need advanced monitoring
- Review weekly for anomalies

---

## Security Incident Response

### If a User Reports Compromised Account:

1. **Immediate:** Reset their password via Supabase Dashboard
2. **Immediate:** Revoke all their sessions
3. **Within 24h:** Review access logs for suspicious activity
4. **Within 48h:** Notify other household members if needed
5. **Document:** What happened and how it was resolved

### If You Discover a Security Vulnerability:

1. **Don't push to production** if it's in code
2. **Fix in dev** first
3. **Test in QA** thoroughly
4. **Document** the vulnerability and fix
5. **Deploy to prod** during low-traffic hours
6. **Monitor** for 24 hours after deployment

---

## Compliance Notes

### GDPR Considerations:

- ✅ Email addresses are PII - handle appropriately
- ✅ Users can delete their accounts (implement this)
- ✅ Data is encrypted in transit (HTTPS) and at rest (Supabase)
- ✅ Users control who sees their data (household-based)

### Data Retention:

- Deleted users: Remove profile data but keep activity logs (anonymous)
- Deleted households: Cascade delete all related data
- Backups: Keep for disaster recovery only

---

## Questions?

- **Email verification not working?** Check Supabase email templates
- **2FA issues?** Verify TOTP is enabled in settings
- **Rate limiting too aggressive?** Contact Supabase support

---

## Summary

**Security Posture: Good for a low-risk app**

✅ Email verification prevents most abuse
✅ 8-char passwords provide baseline security
✅ Rate limiting prevents brute force
✅ RLS policies protect data
✅ Optional 2FA for power users

**This configuration balances security with user experience appropriately for a pet care coordination app.**
