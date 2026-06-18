# Changelog - WhatsApp API Gateway

All notable changes to this project will be documented in this file.

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
