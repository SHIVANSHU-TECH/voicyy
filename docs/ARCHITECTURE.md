# Architecture — AI Voice Calling Agent

## Goals

Low-cost, maintainable MVP for authorized outbound voice campaigns with script approval, contact ingestion, conversation control, and outcome reporting. Designed to evolve into a multi-tenant SaaS without rewriting provider boundaries.

## Folder structure

```text
ai-voice-calling-agent/
├── apps/
│   ├── api/                      # Express + TypeScript API
│   │   └── src/
│   │       ├── config/           # Env validation (Zod)
│   │       ├── lib/              # Logger, errors, idempotency helpers
│   │       ├── middleware/       # Error handler, request id
│   │       ├── modules/
│   │       │   ├── health/
│   │       │   ├── contacts/     # Phase 2
│   │       │   ├── campaigns/    # Phase 3 (engine, eligibility, simulated worker)
│   │       │   ├── calls/        # Call list + state machine transitions
│   │       │   ├── conversation/ # Phase 4
│   │       │   ├── calling/      # Phase 5
│   │       │   └── reporting/    # Phase 6
│   │       ├── providers/        # Concrete adapter wiring
│   │       ├── queue/            # BullMQ or in-memory
│   │       └── index.ts
│   └── web/                      # Next.js + Tailwind + shadcn/ui
│       └── src/app/              # Dashboard, contacts, campaigns, calls, settings
├── packages/
│   ├── shared/                   # Types, Zod schemas, call state enums
│   └── providers/                # Telephony / STT / TTS / LLM interfaces (later)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CHECKLIST.md
│   └── COST-AND-PROVIDERS.md
├── .env.example
├── package.json                  # npm workspaces root
└── README.md
```

## System diagram

```text
┌─────────────────┐     HTTPS      ┌──────────────────────────────┐
│  Next.js Web    │ ──────────────► │  Express API                 │
│  (dashboard)    │ ◄────────────── │  config · auth · validation  │
└─────────────────┘                 │                              │
                                    │  Campaign Engine             │
                                    │   └─ Call State Machine      │
                                    │  Conversation Engine         │
                                    │   └─ policy + script guard   │
                                    │  Queue (BullMQ | memory)     │
                                    └───────────┬──────────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    ▼                           ▼                           ▼
           ┌────────────────┐        ┌────────────────┐        ┌────────────────┐
           │ TelephonyProvider│        │ STT / TTS      │        │ Conversation  │
           │ (sim | Exotel/ │        │ (sim | Groq/…) │        │ ModelProvider │
           │  Twilio/…)     │        └────────────────┘        │ (Groq first)  │
           └────────────────┘                                   └────────────────┘
                    │
                    ▼
           ┌────────────────┐
           │ PostgreSQL     │  contacts · campaigns · calls · audit
           │ (Prisma)       │
           └────────────────┘
```

## Core design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | npm workspaces (`apps/*`, `packages/*`) | Simple, no paid tooling required |
| Secrets | Server-only env vars; Zod-validated at boot | Never ship keys to the browser |
| Queue | BullMQ when Redis present; in-memory otherwise | Local DX without Redis |
| Live calls | `LIVE_CALLING_ENABLED=false` by default | Simulated until country/consent/spend verified |
| AI | Groq behind `ConversationModelProvider` | Low latency/cost; swappable later |
| Documents | PDF → script/context; CSV/XLSX → contacts | Keep contact records separate from knowledge |
| Untrusted input | Scripts/docs never override policy | Opt-out, spend limits, and permissions win |

## Call lifecycle (initial states)

`draft → approved → queued → initiating → ringing → connected → completed | failed | cancelled | opted_out`

Duplicate call jobs are rejected via idempotency keys (`campaignId + contactId + attempt`).

## Security & compliance baseline

- Consent and suppression checks before enqueue.
- Opt-out ends the sales conversation immediately and persists suppression.
- No invented facts, pricing, guarantees, or appointments.
- Do not log API keys, full sensitive transcripts by default, or unnecessary PII.
- Configurable retention for transcripts and audit events.
