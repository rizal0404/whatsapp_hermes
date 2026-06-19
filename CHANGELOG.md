# Changelog — WhatsApp API Gateway

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.1.0] - 2026-06-19

### Added

#### Groups API (`/v1/groups`)
- **List Groups**: `GET /v1/groups/:sessionId` — Fetches all WhatsApp groups joined by a session, returning group JID (`xxxx@g.us`), name, participant count, and creation timestamp. Results sorted alphabetically by group name.
- **Group Detail**: `GET /v1/groups/:sessionId/:groupJid` — Retrieves detailed metadata for a specific group including description, owner, and full participant list with admin roles.
- **New Module**: Created `src/groups/` module with `group.service.ts`, `group.controller.ts`, and `group.routes.ts` following existing project patterns.

#### Swagger API Dashboard (`/docs`)
- **Interactive API Documentation**: Integrated `@fastify/swagger` (OpenAPI 3.0.3) and `@fastify/swagger-ui` to auto-generate and serve a premium interactive API dashboard at `/docs`.
- **Full Schema Annotations**: All 18 API endpoints across 7 modules (Health, Sessions, Messages, Groups, Hermes, Recipients, Monitoring) are fully documented with request/response schemas, examples, and descriptions.
- **Premium WhatsApp Theme**: Custom CSS theme with WhatsApp brand colors (#25D366), gradient-styled HTTP method badges, polished topbar, and enhanced readability.
- **API Key Authentication**: Swagger UI includes "Authorize" button for persistent `X-API-Key` header injection — enables direct endpoint testing from the browser.
- **Universal Deployment**: Dynamic server URL with protocol/host variables — auto-detects the current environment. Works identically on `http://localhost:3000/docs` (local) and `https://yourdomain.com/docs` (VPS).
- **CSP Security Fix**: Exempted `/docs` path from strict Content-Security-Policy header to allow Swagger UI inline styles and scripts.

### Dependencies Added
- `@fastify/swagger` ^9.x
- `@fastify/swagger-ui` ^5.x

---

## [1.0.0] - 2026-06-19

### 🚀 First Production Release

Full-featured WhatsApp API Gateway with Docker deployment, session persistence, and Hermes Agent integration.

### Added

#### Phase 1 — Foundation & Infrastructure
- **Project Scaffold**: TypeScript project with `tsconfig`, ESLint, Prettier, and Zod-validated environment variables (`src/config/env.ts`).
- **Fastify App Bootstrap**: Created `src/app.ts` and `src/server.ts` with graceful shutdown hooks (SIGINT, SIGTERM).
- **Pino Logger**: Structured JSON logging with API key redaction and `pino-pretty` for development (`src/common/logger.ts`).
- **API Key Authentication**: Global `preHandler` hook validating `X-API-Key` headers on `/v1/*` routes (`src/common/auth.middleware.ts`).
- **Database (Prisma)**: PostgreSQL schema with tables for sessions, batches, message logs, audit logs, and recipients (`prisma/schema.prisma`).
- **Redis Connection**: BullMQ queue connection with health checking (`src/database/redis.ts`).
- **Docker Compose**: Full stack configuration for App + PostgreSQL 16 + Redis 7 with resource limits and health checks.
- **Health Check**: `GET /health` endpoint checking API, PostgreSQL, and Redis connectivity.
- Integration tests: `src/health/health.routes.test.ts` (3 tests).

#### Phase 2 — Session Management (Baileys Integration)
- **BaileysClient Wrapper**: Stateful WebSocket client with auto-reconnection (exponential backoff up to 30s, max 5 retries) and credential persistence (`src/whatsapp/baileys.client.ts`).
- **SessionManager Singleton**: In-memory client cache with automatic session restoration on server startup (`src/sessions/session.manager.ts`).
- **QR Code Service**: Base64 PNG QR code generation from Baileys connection events.
- **REST Endpoints**:
  - `POST /v1/sessions` — Create and initialize a new WhatsApp session.
  - `GET /v1/sessions` — List all sessions with status.
  - `GET /v1/sessions/:sessionId/status` — Get connection metadata.
  - `GET /v1/sessions/:sessionId/qr` — Get base64 QR code (JSON API).
  - `POST /v1/sessions/:sessionId/logout` — Disconnect and cleanup.
- Integration tests: `src/sessions/session.routes.test.ts` (5 tests).

#### Phase 3 — Message Sending & Queue
- **BullMQ Message Queue**: Producer/consumer pattern with configurable pacing delay (3s) and rate limiting (30 messages/minute).
- **Idempotency**: Duplicate message prevention via unique idempotency keys stored in the database.
- **JID Formatter**: Normalizes phone numbers (`08xxx`, `+62xxx`, `62xxx`) and group JIDs to WhatsApp-compatible format (`src/whatsapp/jid.util.ts`).
- **Secure Media Downloader**: HTTPS-only downloads with domain allowlist, MIME type validation (PDF/XLSX/CSV/TXT), and configurable size limits (`src/whatsapp/media.service.ts`).
- **Message Worker**: Consumes queue jobs, sends messages via Baileys, handles retries with status tracking.
- **REST Endpoints**:
  - `POST /v1/messages/send-text` — Enqueue a text message.
  - `POST /v1/messages/send-document` — Enqueue a document/report.
  - `GET /v1/messages/:messageId/status` — Query delivery status and error details.
- Integration tests: `src/messages/message.routes.test.ts` (4 tests).

#### Phase 4 — Hermes Integration
- **Batch Report Sending**: `POST /v1/hermes/send-daily-report` creates message batches, automatically resolving active recipients from the database when no explicit list is provided.
- **Batch Status Tracking**: `GET /v1/hermes/batch/:batchId/status` returns aggregated processing counts and individual message statuses.
- **Recipient Management API**: Full CRUD for managing notification recipients:
  - `POST /v1/recipients` — Register a new recipient.
  - `GET /v1/recipients` — List recipients (with `?active=true` filter).
  - `GET /v1/recipients/:id` — Get specific recipient.
  - `PUT /v1/recipients/:id` — Update recipient.
  - `DELETE /v1/recipients/:id` — Delete recipient.
- **Rate Limiting**: BullMQ-level rate limiting (30 messages/minute) with 3-second pacing delay between messages.
- Integration tests: `src/hermes/hermes.routes.test.ts` (6 tests).

#### Phase 5 — Hardening & Production Readiness
- **Audit Logging**: `AuditLogger` writes session and recipient lifecycle events to `audit_logs` table (`src/common/audit.logger.ts`).
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and more via Fastify `onSend` hook.
- **System Metrics**: `GET /v1/metrics` endpoint exposing active sessions, message log states, and queue lengths.
- **Docker Production Config**: Resource limits (CPU/memory), health checks, restart policies, and named volumes for data persistence.
- **Documentation**: Comprehensive `README.md`, `docs/DEPLOYMENT.md`, `.env.example`, and `.env.production` template.

#### Phase 6 — VPS Deployment
- **Docker Deployment**: Multi-stage Dockerfile with `node:22-alpine`, OpenSSL support for Prisma.
- **Server-rendered QR Page**: `GET /v1/sessions/:sessionId/qr-page?key=API_KEY` — browser-accessible QR scanner page with auto-refresh, served directly by the API server. No external HTML files needed.
- **Session Persistence**: Auth credentials and database data persist across container restarts via Docker named volumes (`wa_auth`, `pgdata`).
- **VPS Co-location**: Documented architecture for running alongside Hermes Agent on the same server, with isolated Docker containers and `localhost` communication.

### Fixed
- **`.gitignore` Scope**: Fixed `sessions/` pattern blocking `src/sessions/` source code from being committed. Changed to `/sessions/` (root-only).
- **Prisma on Alpine**: Added `openssl` package to Dockerfile to resolve Prisma Engine initialization failures on Alpine Linux.
- **CSP Blocking QR Page**: Excluded QR page route from the global strict `Content-Security-Policy` header to allow inline styles/scripts.
- **QR Page Browser Auth**: Moved QR page route outside API key middleware; uses query parameter (`?key=`) for browser-compatible authentication.
- **Flaky Integration Tests**: Resolved database race conditions using polling loops (20 attempts, 100ms delay) for status transition verification.

---

## [1.0.0-phase.5] - 2026-06-18
### Added
- **Audit Logging**: Created `AuditLogger` writing session (`SESSION_CREATE`, `SESSION_LOGOUT`) and recipient (`RECIPIENT_CREATE`, `RECIPIENT_UPDATE`, `RECIPIENT_DELETE`) events to the database `audit_logs` table.
- **Security Headers (Helmet)**: Registered standard security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, XSS) via Fastify `onSend` hook.
- **Docker Compose Enhancements**: Configured resource limits (CPU, memory) and health checks for Postgres, Redis, and Gateway API services.
- **Production Environment Template**: Created `.env.production` for production-specific configuration.
- **Production Deployment Documentation**: Published `docs/DEPLOYMENT.md` covering VPS installation, Nginx + SSL reverse proxy setup, security hardening, and database/cred backups.
### Fixed
- **Flaky Integration Test**: Resolved database race condition in `src/sessions/session.routes.test.ts` using a database polling loop (20 attempts, 100ms delay) to check for status transitions.

## [1.0.0-phase.4] - 2026-06-18
### Added
- **Hermes Integration Routes** (`POST /v1/hermes/send-daily-report` & `GET /v1/hermes/batch/:batchId/status`).
- **Recipient Database Management API** (`POST /v1/recipients`, `GET /v1/recipients`, `GET /v1/recipients/:id`, `PUT /v1/recipients/:id`, `DELETE /v1/recipients/:id`).
- **Pacing & Rate Limiting**: Implemented a 3-second pacing delay between messages in the worker and a hard limit of 30 messages/minute.
- **Unified Mocking**: Resolved Vitest process sharing mock conflicts using a dynamic `BaileysClient` mock.
- Integration tests in `src/hermes/hermes.routes.test.ts` (6 tests).

## [1.0.0-phase.3] - 2026-06-18
### Added
- **Message Sending & Queue Component**: Integrated BullMQ queue and worker.
- **Idempotency Prevention**: Implemented duplicate checking via custom database idempotency keys.
- **JID Formatter & Normalization**: Normalizes inputs (08..., +62..., groups JIDs).
- **Secure Media Downloader**: Created `MediaService` enforcing HTTPS, domain allowlists, file size limits (20MB), and supported MIME types (PDF, XLSX, CSV, TXT).
- **REST Endpoints**: Added `POST /v1/messages/send-text`, `POST /v1/messages/send-document`, and `GET /v1/messages/:messageId/status`.
- Integration tests in `src/messages/message.routes.test.ts` (4 tests).

## [1.0.0-phase.2] - 2026-06-18
### Added
- **WhatsApp Baileys Integration**: Implemented stateful `BaileysClient` class wrapping socket connections, creds saving, and auto-reconnections with exponential backoff.
- **Session Manager**: Singleton to track active sessions in memory, restore them on server startup, and handle clean logouts.
- **QR Code Retrieval**: Generated base64 PNG data URLs from connection QR events.
- **REST Endpoints**: Added `POST /v1/sessions`, `GET /v1/sessions/:sessionId/qr`, `GET /v1/sessions/:sessionId/status`, and `POST /v1/sessions/:sessionId/logout`.
- Integration tests in `src/sessions/session.routes.test.ts` (5 tests).

## [1.0.0-phase.1] - 2026-06-18
### Added
- **Project Scaffold**: Initialized TypeScript project, tsconfig options, ESLint, Prettier, and environment variables parser with Zod.
- **App Bootstrap**: Created Fastify app server in `src/app.ts` and `src/server.ts` with clean graceful shutdown hooks (SIGINT, SIGTERM).
- **Logging**: Configured Pino logger with redact rules for API keys and pretty-printing for development.
- **API Key Security**: Implemented auth preHandler hook verifying `X-API-Key` headers on `/v1/*` routes.
- **Database & Prisma**: Configured PostgreSQL schema (sessions, batches, messages, audit logs, recipients tables) and generated Prisma client.
- **Docker Compose**: Set up container configuration for local PostgreSQL, Redis, and Gateway server.
- **Health Check**: Created `GET /health` checking API, PostgreSQL, and Redis connectivity.
- Integration tests in `src/health/health.routes.test.ts` (3 tests).
