# CASA / ESOF — Authentication & session evidence (OrzuX)

Use this document when filling **Evidence** comments in ESOF.  
Project auth stack: **Supabase Auth** (password hashing, OTP generation) + **OrzuX app guards** (Redis + Turnstile).

Configure in Supabase Dashboard → Authentication → Settings:

- **OTP expiry**: ≤ 10 minutes (recommended for 1.1.2 / 1.3.1).
- **Password minimum length**: ≥ 10 (matches app validation).
- **Secure password change** / **single-use recovery**: enabled (Supabase default for email OTP).

Ensure production env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.

| ID | Requirement | Status | Implementation |
|----|-------------|--------|----------------|
| **1.1.1** | Authentication resistant to brute force | **App + infra** | Redis lockout after 5 failed logins / 15 min (`src/lib/security/auth-brute-force.ts`); IP bucket 30 attempts / 15 min; Cloudflare Turnstile on login (`sign-in-with-email.ts`); min 3s between attempts per email. |
| **1.1.2** | Initial passwords / activation codes random, short expiry | **Supabase + app** | Supabase generates email OTP; expiry set in Supabase Auth settings; codes verified once via `verifyEmailOtpAction` / `verifyRecoveryOtpAction`. |
| **1.1.3** | Passwords stored resistant to offline attacks | **Supabase** | Passwords hashed by Supabase Auth (bcrypt); app never stores plaintext passwords. |
| **1.2.1** | No default credentials on public interfaces | **Ops** | No hardcoded admin passwords in repo; platform admins via `platform_admins` table; secrets via ENV only. |
| **1.3.1** | Out-of-band verifier expires in reasonable time | **Supabase config** | Set OTP/magic-link expiry in Supabase (≤10 min recommended). |
| **1.3.2** | OOB verifier used only once | **Supabase** | Single-use OTP / PKCE exchange on `/auth/callback`. |
| **1.3.3** | OOB verifier securely random | **Supabase** | Cryptographic OTP generation by Supabase Auth. |
| **1.3.4** | OOB verifier resistant to brute force | **App** | Max 5 OTP verify failures / 15 min per email (`assertOtpVerifyAllowed` in auth actions). |
| **2.1.1** | No passwords/session tokens in URL | **App** | OAuth uses `code` PKCE exchange only (`src/app/auth/callback/route.ts`); sessions in httpOnly cookies via `@supabase/ssr`. |
| **2.2.1** | Logout invalidates session | **Supabase + app** | `signOut()` / `/auth/logout` calls `supabase.auth.signOut()`; server session cleared. |

## Code references (audit trail)

- Login guard: `src/lib/security/auth-brute-force.ts`
- Login action: `src/features/auth/actions/sign-in-with-email.ts`
- OTP verify: `src/features/auth/actions/verify-email-otp.ts`, `verify-recovery-otp.ts`
- Password reset request: `src/features/auth/actions/request-password-reset.ts`
- Logout: `src/app/auth/logout/route.ts`, `src/services/auth.service.ts` (`signOut`)
- Security report UI: `apps/admin/src/features/security/report.ts`
