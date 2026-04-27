# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start with hot reload (nodemon + ts-node)
npm run build      # Compile TypeScript + copy email templates to dist/
npm start          # Build then run compiled output
```

No test suite is present in this codebase.

To seed the database on first run, set `SEED_DB=true` in `.env` before starting.

## Architecture

Express 5 / TypeScript CRM server for MR Group of Colleges and Hospitals. Multi-tenant — all entities are scoped to a `property_id`.

**Request lifecycle:**
```
Route → AuthMiddleware (JWT + auto-refresh) → PermissionMiddleware (RBAC) → Controller → Service → Mongoose Model
```

**Route layout (`src/routes/index.ts`):**
All domain routes mount under `/api/<domain>`. Facebook routes mount separately at `/api/facebook`. Razorpay webhook is at `/webhook/razorpay` and bypasses `express.json()` to preserve raw body for signature verification.

**Layer responsibilities:**
- `src/routes/` — Express routers, middleware attachment
- `src/controllers/` — Thin HTTP handlers; call services, return responses
- `src/services/` — All business logic (lead CRUD, bulk import, Facebook sync, email, WhatsApp)
- `src/models/` — Mongoose schemas; relationships via `ref` + `.populate()`
- `src/dtos/` — TypeScript interfaces/enums for request/response shapes
- `src/middlewares/` — Auth, RBAC, rate limiting, pricing/subscription gates
- `src/cron-jobs/cron.ts` — All scheduled jobs (Facebook sync every 15 min, email campaigns at midnight, hourly feature validity checks)
- `src/webhooks/` — Inbound webhook handlers (Razorpay payments, lead automation triggers)
- `src/seeders/` — One-time DB bootstrapping (roles, permissions, property, default statuses/labels)

## Key Patterns

**Schema extensibility:** Never add new top-level schema fields. All new attributes go into the `meta` object on the relevant model. This is a firm convention in this codebase.

**Audit logging:** Lead and Property models carry a `logs[]` array. Append a log entry on every meaningful state change (status updates, assignments, bulk imports, etc.).

**Caching:** `NodeCache` for user/role-permission lookups (5–10 min TTL). `ioredis` for distributed cache. Lock/unlock patterns in `src/services/cache.util.ts` guard concurrent writes.

**Multi-tenancy:** Every query that reads/writes Lead, Label, Status, Source, User, or Role must include `property_id` as a filter. Never query across tenants.

**Round-robin agent assignment:** Facebook lead import and bulk uploads auto-assign leads to Telecaller-role users in round-robin order. Logic lives in the respective service files.

**Lean queries:** Use `.lean()` on read-heavy list queries to avoid Mongoose document overhead.

## Integrations

- **Facebook Lead Ads** — `/api/facebook/login` and `/api/facebook/connect` initiate OAuth; a cron job hits `POST /lead/webhook` every 15 minutes to pull new leads via Graph API. The webhook handler is in `src/app.ts`.
- **Razorpay** — `POST /webhook/razorpay` with raw body; handler in `src/webhooks/payment.webhook.ts`; health check at `GET /payment-webhook/monitor`
- **WhatsApp (WapMonkey)** — Device sync, campaign dispatch; routes under `/api/wapmonkey`
- **Email** — Nodemailer + Resend; Handlebars templates in `src/templates/`; campaign logic in `src/services/email-campaign-service.ts`
- **ImageKit** — File/image uploads via Multer; config in `config/imagekit.service.ts`

## Auth

JWT stored in HTTP-only cookies. `AuthMiddleware` validates access token and silently rotates it using a refresh token — no client logout on expiry. `PermissionMiddleware` reads `role.permissions[]` off the JWT payload and rejects requests missing the required permission string.

## Environment

Key `.env` variables: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT` (default 5000), `NODE_ENV`, `SEED_DB`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

Production base URL (used by cron jobs): `https://mk9egvjms4.ap-south-1.awsapprunner.com` (AWS App Runner).
