# Cost and provider-dependency assessment

Figures below are indicative (public list prices as of research date 2026-10). Verify on vendor dashboards before enabling live calling. Currency mixes USD/INR intentionally — convert at current FX for budgeting.

## Cost stack (per connected minute)

| Layer | Role | Low-cost MVP lean | Notes |
|-------|------|-------------------|-------|
| Telephony | Place/receive PSTN call | Dominant cost | Country-specific |
| STT | Caller speech → text | Groq Whisper Turbo ~$0.04/hr (~$0.0007/min) | Batch ASR; streaming may need another vendor |
| LLM | Turn decisions | Groq Llama 3.1 8B ~$0.05/$0.08 per 1M tok | Typically << ₹0.05/call |
| TTS | Agent text → speech | Groq Orpheus ~$22/1M chars | Or free/cheap vendor TTS |
| Platform | Our API + DB + Redis | Self-host / small VPS | Keep orchestration in-house |

**Rough India MVP all-in (excluding platform):** ≈ ₹0.4–1.2 per minute telephony + ₹0.05–0.20 AI speech/LLM, depending on vendor and pulse billing.

## Telephony candidates (India-first)

| Provider | Indicative outbound | Strengths | Risks / blockers |
|----------|---------------------|-----------|------------------|
| **Plivo** | ~₹0.38/min domestic; 30s pulse; number ~₹200/mo | Clear India pricing; audio streaming included | Confirm DLT/consent workflows for your use case |
| **Exotel** | Pulse billing (often 60s); plan-dependent (~₹0.5–0.9/min class) | India-native; campaign-oriented | Opaque enterprise rates; pulse inflation on short calls |
| **Twilio** | ~$0.05–0.07/min to India mobile/local | Excellent docs, Media Streams, Conversation Relay | Higher India rates; regulatory setup for local numbers |

**Phase 1 stance:** `TELEPHONY_PROVIDER=simulated`. Do not enable live dialing until:

1. Destination country confirmed  
2. Account + CLI/Exophone provisioned  
3. Consent/suppression controls live  
4. `DAILY_CALL_SPEND_LIMIT_USD` / concurrency caps set  
5. Webhook URL reachable for status callbacks  

## Speech / AI

| Capability | Preferred for MVP | Alternative | Dependency risk |
|------------|-------------------|-------------|-----------------|
| Conversation LLM | **Groq** (`llama-3.1-8b-instant`) | Larger Groq models for harder scripts | API key + rate limits |
| STT | **Simulated** → Groq Whisper turbo for file/chunk | Deepgram / Sarvam for low-latency streaming | Groq STT is strong on batch; real-time duplex may need streaming STT |
| TTS | **Simulated** → Groq Orpheus or telephony-native TTS | ElevenLabs (quality, higher cost); Sarvam (Indic) | Voice quality vs cost trade-off |

## Infrastructure

| Component | MVP | Cost note |
|-----------|-----|-----------|
| PostgreSQL | Local Docker or managed small instance | Required from Phase 6 |
| Redis | Optional; memory queue in Phase 1 | Add when concurrency / retries matter |
| Object storage | Later (recordings) | Prefer not storing full audio in MVP |
| Hosting | Single Node API + Next.js | Keep API and secrets server-side |

## Provider abstraction (non-negotiable)

Concrete SDKs are wrapped behind:

- `TelephonyProvider`
- `SpeechToTextProvider`
- `TextToSpeechProvider`
- `ConversationModelProvider`

Simulated implementations must label outcomes `mode: "simulated"` and must never be reported as live calls.

## Recommendation for this MVP

1. **Build fully on simulated telephony + simulated STT/TTS** through Phase 4.  
2. **Use Groq only for conversation text** once `GROQ_API_KEY` is provided (optional in Phase 1).  
3. **For India live dialing (Phase 5):** evaluate **Plivo** first on price transparency, then **Exotel** if India campaign features win; keep Twilio as a global fallback.  
4. Re-verify streaming audio path (Media Streams / websocket) before committing — half-duplex gather/say is cheaper to start.
