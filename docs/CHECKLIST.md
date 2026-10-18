# Implementation checklist

Legend: `[x]` done · `[ ]` pending · `[!]` blocked (needs decision or credentials)

## Phase 1 — Project foundation

- [x] Inspect repository; create `ai-voice-calling-agent` monorepo
- [x] Architecture doc, README, `.env.example`, setup instructions
- [x] Cost / provider assessment
- [x] Config validation (Zod)
- [x] Structured logging (pino)
- [x] Central error handling + request IDs
- [x] Health checks (`/health`, `/ready`)
- [x] Queue abstraction with memory fallback
- [x] Lint, format, typecheck, unit/API tests
- [x] Run checks and fix failures

## Phase 2 — Dashboard and contact ingestion

- [ ] Dashboard with campaign/call stats
- [ ] Contacts upload (PDF/CSV/XLSX), preview, validation, duplicates
- [ ] Campaign creation + script approval UI
- [ ] Call history + filters
- [ ] Call detail (transcript/summary/outcome)
- [ ] Settings (providers, limits, retention)
- [ ] Phone validation + confirm-before-save

## Phase 3 — Campaign engine

- [ ] Campaign model (goal, script, Q&A, facts, forbidden claims)
- [ ] Schedule, retry, concurrency
- [ ] Consent / suppression gates
- [ ] Deterministic call state machine
- [ ] Idempotent call job creation

## Phase 4 — Conversation engine

- [ ] Provider-independent turn loop
- [ ] Script adherence + unknown-question handling
- [ ] Interruptions, clarification, redirect, busy, voicemail hooks
- [ ] Human escalation + polite termination
- [ ] Immediate opt-out → suppression
- [ ] Untrusted doc/script isolation from policy

## Phase 5 — Real voice and telephony

- [ ] Interfaces: Telephony / STT / TTS / ConversationModel
- [ ] Simulated providers (marked `mode: simulated`)
- [!] Select and verify one real stack for target country
- [!] Credentials, consent controls, spend limits before `LIVE_CALLING_ENABLED=true`
- [ ] Webhooks, status updates, timeouts, disconnect recovery

## Phase 6 — Persistence and reporting

- [ ] Prisma schema + migrations
- [ ] Store calls, events, outcomes, costs, audit
- [ ] Filters + CSV export
- [ ] Access controls + retention jobs

## Phase 7 — Testing

- [ ] Upload / duplicate / invalid phone suites
- [ ] Script adherence, unknown Q, opt-out, escalation
- [ ] Idempotency, rate limits, provider failures
- [ ] Mocked providers only — never dial real numbers in tests

## Open decisions (ask before Phase 5)

1. Primary outbound country (assumed India for cost notes; confirm).
2. Preferred telephony: Exotel / Plivo / Twilio (see `COST-AND-PROVIDERS.md`).
3. STT/TTS: Groq-only vs hybrid (Sarvam / Deepgram / vendor TTS).
4. Auth model for MVP (local admin vs Firebase/Auth0).
