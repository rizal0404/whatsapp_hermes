# WhatsApp API Gateway

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.x-000000?logo=fastify&logoColor=white)](https://www.fastify.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Private-red)](#)

A production-grade microservice that provides an internal REST API for sending WhatsApp messages and document reports via **Baileys** (WhatsApp Web API). Features include session persistence, message queuing with retry logic, idempotency, recipient management, rate-limiting, and comprehensive logging.

Designed to work alongside the **Hermes Agent** as an orchestrator for automated report distribution.

---

## 🏗️ Architecture

```
                 +-------------------+
                 |    Hermes Agent   |
                 +---------+---------+
                           |
                           | HTTP /v1/hermes/... (Header: X-API-Key)
                           v
+-------------------------------------------------------------+
| WhatsApp Gateway API (Fastify + TypeScript)                 |
|                                                             |
|   +-------------------+      +--------------------------+   |
|   |  Session Manager  |      |   Recipient Management   |   |
|   +---------+---------+      +------------+-------------+   |
|             |                             |                 |
|             | Baileys                     | Prisma          |
|             v                             v                 |
|   +-------------------+      +------------+-------------+   |
|   |   WhatsApp Web    |      |  PostgreSQL Database     |   |
|   |   (WebSocket)     |      |  (sessions, batches,     |   |
|   +-------------------+      |   logs, recipients)      |   |
|                              +--------------------------+   |
|                                                             |
|   +-------------------+      +--------------------------+   |
|   |   Message Queue   |----->|   Queue Worker (BullMQ)  |   |
|   |   (BullMQ Producer)      |   - Pacing Delay (3s)    |   |
|   +-------------------+      |   - Rate limit (30/min)  |   |
|             |                +------------+-------------+   |
|             |                             |                 |
+-------------|-----------------------------|-----------------+
              |                             |
              | enqueue                     | fetch file & send
              v                             v
       +------------+                +--------------+
       |   Redis    |                | External File|
       |  BullMQ    |                |    Server    |
       +------------+                +--------------+
```

---

## 🚀 Tech Stack

| Component        | Technology                                  |
| ---------------- | ------------------------------------------- |
| **Runtime**      | Node.js v22+ (Alpine)                       |
| **Language**     | TypeScript 5.x                              |
| **Web Server**   | Fastify 4.x                                 |
| **WA Client**    | Baileys (`@whiskeysockets/baileys`)         |
| **Database**     | PostgreSQL 16 (Prisma ORM)                  |
| **Queue/Cache**  | Redis 7 (BullMQ)                            |
| **Validation**   | Zod                                         |
| **Logger**       | Pino (`pino-pretty` for dev)                |
| **Testing**      | Vitest                                      |
| **Container**    | Docker & Docker Compose                     |

---

## 📁 Project Structure

```
wa-gateway/
├── docker/
│   └── Dockerfile              # Multi-stage build (builder + runner)
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # SQL migration files
├── src/
│   ├── app.ts                  # Fastify app bootstrap & route registration
│   ├── server.ts               # Server entry point & graceful shutdown
│   ├── common/                 # Shared utilities
│   │   ├── auth.middleware.ts   # API key validation
│   │   ├── audit.logger.ts     # Audit trail logging
│   │   ├── errors.ts           # Custom error classes
│   │   ├── logger.ts           # Pino logger setup
│   │   └── response.ts         # Standardized API response helpers
│   ├── config/
│   │   └── env.ts              # Zod-validated environment variables
│   ├── database/
│   │   ├── prisma.ts           # Prisma client singleton
│   │   └── redis.ts            # Redis/BullMQ connection
│   ├── health/                 # GET /health endpoint
│   ├── hermes/                 # Hermes batch report integration
│   ├── messages/               # Message sending, queuing & worker
│   ├── monitoring/             # System metrics endpoint
│   ├── recipients/             # Recipient CRUD management
│   ├── sessions/               # WhatsApp session lifecycle
│   └── whatsapp/               # Baileys client wrapper & utilities
├── docker-compose.yml          # Full stack: App + PostgreSQL + Redis
├── .env.example                # Environment variable template
├── .env.production             # Production env template
├── package.json
└── tsconfig.json
```

---

## ⚙️ Prerequisites

- **Docker & Docker Compose** (for production deployment)
- **Node.js v22+** (for local development)

---

## 🛠️ Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rizal0404/whatsapp_hermes.git
   cd whatsapp_hermes
   npm install
   ```

2. **Setup environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `API_KEY` and other config values as needed.

3. **Start PostgreSQL and Redis** using Docker:
   ```bash
   docker compose up -d postgres redis
   ```

4. **Apply database migrations**:
   ```bash
   npx prisma migrate dev
   ```

5. **Run test suite**:
   ```bash
   npm run test
   ```

6. **Start development server** (with hot-reload):
   ```bash
   npm run dev
   ```

---

## 🐳 Docker Production Deployment

### Quick Start (Single VPS)

```bash
# 1. Clone to server
sudo git clone https://github.com/rizal0404/whatsapp_hermes.git /opt/wa-gateway
cd /opt/wa-gateway

# 2. Configure environment
sudo cp .env.example .env
sudo nano .env  # Set API_KEY, adjust settings

# 3. Build and start all services
sudo docker compose up -d --build

# 4. Run database migration
sudo docker compose exec wa-gateway npx prisma migrate deploy

# 5. Create a WhatsApp session
curl -X POST http://localhost:3000/v1/sessions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "main-session"}'

# 6. Scan QR code via browser
# Open: http://YOUR_SERVER_IP:3000/v1/sessions/main-session/qr-page?key=YOUR_API_KEY
```

### Session Persistence

WhatsApp sessions persist automatically across container restarts:
- **Auth credentials** are stored in a Docker volume (`wa_auth`)
- **Database records** are stored in a Docker volume (`pgdata`)
- Sessions auto-restore on startup via `SessionManager.initAllSessions()`

> ⚠️ **Never** use `docker compose down -v` in production — the `-v` flag deletes volumes and all session data.

### Safe Restart Commands

```bash
# Restart without losing data
sudo docker compose restart

# Or rebuild and restart
sudo docker compose down && sudo docker compose up -d --build
```

---

## 📡 API Reference

All endpoints under `/v1/*` require the header `X-API-Key: <your_api_key>` (except `/health` and `/v1/sessions/:id/qr-page`).

### Health Check

| Method | Endpoint   | Description                                     |
| ------ | ---------- | ----------------------------------------------- |
| `GET`  | `/health`  | Returns connectivity status (API, Postgres, Redis) |

### Sessions

| Method | Endpoint                              | Description                              |
| ------ | ------------------------------------- | ---------------------------------------- |
| `POST` | `/v1/sessions`                        | Create and initialize a new WA session   |
| `GET`  | `/v1/sessions`                        | List all sessions and their statuses     |
| `GET`  | `/v1/sessions/:sessionId/status`      | Get session connection metadata          |
| `GET`  | `/v1/sessions/:sessionId/qr`          | Get base64 PNG QR code (API response)    |
| `GET`  | `/v1/sessions/:sessionId/qr-page`     | Browser QR page (auth via `?key=`)       |
| `POST` | `/v1/sessions/:sessionId/logout`      | Disconnect & delete session credentials  |

#### Create Session
```bash
curl -X POST http://localhost:3000/v1/sessions \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "main-session", "label": "Main Office Phone"}'
```

#### Scan QR Code via Browser
Open in any browser:
```
http://YOUR_SERVER_IP:3000/v1/sessions/main-session/qr-page?key=YOUR_API_KEY
```

### Messages

| Method | Endpoint                          | Description                            |
| ------ | --------------------------------- | -------------------------------------- |
| `POST` | `/v1/messages/send-text`          | Enqueue a text message                 |
| `POST` | `/v1/messages/send-document`      | Enqueue a document/report              |
| `GET`  | `/v1/messages/:messageId/status`  | Query delivery status & error details  |

#### Send Text Message
```bash
curl -X POST http://localhost:3000/v1/messages/send-text \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "main-session",
    "to": "6281234567890",
    "message": "Hello from WhatsApp Gateway!",
    "idempotencyKey": "unique-uuid-key-here"
  }'
```

#### Send Document
```bash
curl -X POST http://localhost:3000/v1/messages/send-document \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "main-session",
    "to": "120363000000000000@g.us",
    "caption": "Daily Report",
    "fileUrl": "https://storage.example.com/report.pdf",
    "fileName": "daily-report.pdf",
    "mimeType": "application/pdf",
    "idempotencyKey": "unique-doc-key"
  }'
```

### Recipients

| Method   | Endpoint              | Description                                 |
| -------- | --------------------- | ------------------------------------------- |
| `POST`   | `/v1/recipients`      | Register a new recipient                    |
| `GET`    | `/v1/recipients`      | List all recipients (`?active=true` filter) |
| `GET`    | `/v1/recipients/:id`  | Get specific recipient                      |
| `PUT`    | `/v1/recipients/:id`  | Update recipient metadata                   |
| `DELETE` | `/v1/recipients/:id`  | Delete a recipient                          |

### Hermes Integration

| Method | Endpoint                            | Description                                  |
| ------ | ----------------------------------- | -------------------------------------------- |
| `POST` | `/v1/hermes/send-daily-report`      | Create batch report (auto-resolves recipients) |
| `GET`  | `/v1/hermes/batch/:batchId/status`  | Get batch processing status                  |

#### Send Daily Report (Hermes)
```bash
curl -X POST http://localhost:3000/v1/hermes/send-daily-report \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reportDate": "2026-06-19",
    "sessionId": "main-session",
    "message": "Laporan harian 19 Juni 2026 telah tersedia.",
    "document": {
      "fileUrl": "https://storage.example.com/reports/daily-2026-06-19.pdf",
      "fileName": "laporan-harian-2026-06-19.pdf",
      "mimeType": "application/pdf"
    }
  }'
```

### Metrics

| Method | Endpoint       | Description                                         |
| ------ | -------------- | --------------------------------------------------- |
| `GET`  | `/v1/metrics`  | Active sessions, message stats, queue lengths        |

---

## 🔒 Security

| Feature                | Description                                                               |
| ---------------------- | ------------------------------------------------------------------------- |
| **API Key Auth**       | Global middleware validates `X-API-Key` header on all `/v1/*` routes      |
| **Domain Allowlist**   | Media downloader only accepts URLs from configured `ALLOWED_FILE_DOMAINS` |
| **MIME & Size Limits** | Enforces PDF/XLSX/CSV/TXT formats, rejects files > `MAX_FILE_SIZE_MB`     |
| **Security Headers**   | CSP, X-Frame-Options, HSTS, X-Content-Type-Options, etc.                 |
| **Log Redaction**      | API keys and credentials are censored from Pino log output                |
| **Audit Trail**        | Session and recipient changes are logged to the `audit_logs` table        |

---

## 🔧 Environment Variables

| Variable                 | Default                   | Description                                  |
| ------------------------ | ------------------------- | -------------------------------------------- |
| `NODE_ENV`               | `development`             | Environment mode                             |
| `PORT`                   | `3000`                    | Server port                                  |
| `API_KEY`                | *(required)*              | API key for authentication                   |
| `DATABASE_URL`           | *(required)*              | PostgreSQL connection string                 |
| `REDIS_URL`              | `redis://localhost:6379`  | Redis connection string                      |
| `WA_AUTH_DIR`            | `./auth`                  | Directory for Baileys auth state files       |
| `QR_TTL_SECONDS`         | `30`                      | QR code cache TTL                            |
| `MAX_RETRY_ATTEMPTS`     | `3`                       | Max retry attempts for failed messages       |
| `MESSAGE_JOB_TTL_SECONDS`| `3600`                   | Job time-to-live in the queue                |
| `MAX_FILE_SIZE_MB`       | `20`                      | Maximum file size for document uploads       |
| `ALLOWED_FILE_DOMAINS`   | *(see .env.example)*      | Comma-separated allowed domains for media    |
| `LOG_LEVEL`              | `info`                    | Pino log level                               |

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test -- --coverage
```

Integration tests cover:
- Health check endpoint (3 tests)
- Session management routes (5 tests)
- Message sending routes (4 tests)
- Hermes batch integration (6 tests)

---

## 📋 VPS Co-location with Hermes Agent

When deploying alongside Hermes Agent on the same VPS:

```
VPS (43.133.129.54)
├── /home/hermes/          ← Hermes Agent (existing)
│   └── config.json        ← Point API URL to localhost:3000
└── /opt/wa-gateway/       ← WhatsApp Gateway (Docker)
    ├── docker-compose.yml
    ├── .env
    └── ...
```

- **Isolation**: WA Gateway runs entirely in Docker containers, no conflicts with Hermes
- **Communication**: Hermes calls `http://localhost:3000` (fast, no public network)
- **Security**: Port 3000 can be firewalled from external access after QR scan

---

## 📄 License

Private — All rights reserved.
