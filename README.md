# AI Voice Calling Agent

Modular MVP for authorized outbound AI voice campaigns: upload scripts and contact lists, approve campaign scripts, launch calls through provider interfaces, and record outcomes.

**Status:** Phase 3 complete (campaign engine: schedule/retry/concurrency, consent gates, call state machine, idempotent jobs). Live calling is disabled by default. Data is in-memory until Phase 6 (Prisma).

## Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js, TypeScript, Tailwind CSS (shadcn/ui in Phase 2) |
| API | Node.js, TypeScript, Express |
| Data | PostgreSQL + Prisma (wired from Phase 6; optional in Phase 1) |
| AI | Groq via provider abstraction |
| Jobs | BullMQ + Redis, or in-memory when Redis is unavailable |
| Docs | Architecture, checklist, cost/provider notes under `docs/` |

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+
- Optional: PostgreSQL, Redis (not required for Phase 1 health/dev mode)

### Setup

```bash
cd ai-voice-calling-agent
cp .env.example .env
npm install
```

Edit `.env` as needed. Leave `LIVE_CALLING_ENABLED=false` unless credentials, consent, destination-country support, and spend limits are verified.

### Develop

```bash
# API — http://localhost:4100
npm run dev:api

# Web — http://localhost:3100
npm run dev:web
```

### Checks

```bash
npm run check          # format + lint + typecheck + test
npm run test
npm run typecheck
npm run lint
```

### Health

- `GET http://localhost:4100/health` — liveness  
- `GET http://localhost:4100/ready` — readiness (config + queue mode)  
- `GET http://localhost:4100/api/v1/meta` — build/meta (no secrets)

## Project layout

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for folder structure and diagrams.  
See [docs/CHECKLIST.md](./docs/CHECKLIST.md) for phased progress.  
See [docs/COST-AND-PROVIDERS.md](./docs/COST-AND-PROVIDERS.md) for cost and vendor notes.

## Safety rules

- Never put API keys in `NEXT_PUBLIC_*` variables.
- Simulated providers must not be marked as real calls.
- Uploaded documents and spoken instructions are untrusted and cannot override opt-out, spend limits, or permissions.
- Automated tests use mocked providers only — never dial real numbers.

## Phases

1. **Foundation** — monorepo, config, logging, health, queue stub, checks  
2. **Dashboard + contact ingestion**  
3. **Campaign engine + state machine** (this release)  
4. Conversation engine  
5. Real telephony/voice (after verification)  
6. Persistence + reporting  
7. Expanded automated test suite  
