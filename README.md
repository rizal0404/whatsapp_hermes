# WhatsApp API Gateway (Node.js TypeScript + Baileys + BullMQ)

A secure, production-grade microservice that provides an internal REST API for sending WhatsApp text and document reports, complete with session persistence, robust message queuing, idempotency key verification, recipient database management, rate-limiting, Pino logging, and health checking.

Designed to interface with the **Hermes Agent** as an orchestrator.

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

- **Runtime**: Node.js v20+ / v22+
- **Language**: TypeScript
- **Web Server**: Fastify
- **WhatsApp Web Client**: Baileys (@whiskeysockets/baileys)
- **Database**: PostgreSQL (Prisma ORM)
- **Queue & Cache**: Redis (BullMQ)
- **Validation**: Zod
- **Logger**: Pino (pino-pretty for development)
- **Testing**: Vitest

---

## ⚙️ Prerequisites

- **Docker & Docker Compose** (for running Postgres & Redis)
- **Node.js** (v20+ recommended)

---

## 🛠️ Local Development Setup

1. **Clone the repository** & navigate to directory:
   ```bash
   npm install
   ```

2. **Setup environment variables**:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` as needed (default ports are configured for local services).*

3. **Start local Postgres and Redis** using Docker:
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Apply database migrations**:
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Run test suite** (Vitest integration tests):
   ```bash
   npm run test
   ```

6. **Start development server** with hot-reload:
   ```bash
   npm run dev
   ```

---

## 📡 API Reference

All requests must include the header `X-API-Key: <your_api_key>` (except `/health`).

### Health Check
- **`GET /health`**
  Returns connectivity status for the API, Postgres, and Redis.

### Sessions
- **`POST /v1/sessions`**
  Creates and initializes a new WhatsApp session.
  - Body:
    ```json
    { "sessionId": "main-office", "label": "Main Office Phone" }
    ```
- **`GET /v1/sessions`**
  Lists all created sessions and their current status.
- **`GET /v1/sessions/:sessionId/status`**
  Gets connection status metadata.
- **`GET /v1/sessions/:sessionId/qr`**
  Returns base64 encoded PNG QR code if requiring scan, or `qr: null` if connected.
- **`POST /v1/sessions/:sessionId/logout`**
  Gracefully disconnects from WhatsApp Web, deletes credential files, and updates DB status to `LOGGED_OUT`.

### Messages
- **`POST /v1/messages/send-text`**
  Enqueues a text message.
  - Body:
    ```json
    {
      "sessionId": "main-office",
      "to": "6281234567890",
      "message": "Hello World",
      "idempotencyKey": "unique-uuid-key-here"
    }
    ```
- **`POST /v1/messages/send-document`**
  Enqueues a PDF, Excel, CSV or TXT report download and sending.
  - Body:
    ```json
    {
      "sessionId": "main-office",
      "to": "120363000000000000@g.us",
      "caption": "Daily Report",
      "fileUrl": "https://raw.githubusercontent.com/pdf-association/pdf-test-files/master/Classic/classic.pdf",
      "fileName": "classic.pdf",
      "mimeType": "application/pdf",
      "idempotencyKey": "unique-doc-key-here"
    }
    ```
- **`GET /v1/messages/:messageId/status`**
  Queries delivery logs, attempts, and error details.

### Recipients Management
- **`POST /v1/recipients`**
  Registers a new recipient in the gateway.
  - Body:
    ```json
    {
      "name": "Operations Group A",
      "to": "120363071378877140@g.us",
      "isActive": true
    }
    ```
- **`GET /v1/recipients`**
  Lists all recipients. Optional query param `?active=true`.
- **`GET /v1/recipients/:id`**
  Retrieves a specific recipient.
- **`PUT /v1/recipients/:id`**
  Updates recipient metadata.
- **`DELETE /v1/recipients/:id`**
  Deletes a recipient.

### Hermes Integration
- **`POST /v1/hermes/send-daily-report`**
  Creates a message batch. If `recipients` array is omitted, the gateway automatically resolves all active recipients registered in its database.
  - Body:
    ```json
    {
      "reportDate": "2026-06-18",
      "sessionId": "main-office",
      "message": "Laporan harian 18 Juni 2026 telah tersedia.",
      "document": {
        "fileUrl": "https://storage.example.com/reports/daily-2026-06-18.pdf",
        "fileName": "laporan-harian-2026-06-18.pdf",
        "mimeType": "application/pdf"
      }
    }
    ```
- **`GET /v1/hermes/batch/:batchId/status`**
  Returns batch-level aggregated processing counts and individual message statuses.

### Metrics
- **`GET /v1/metrics`**
  Exposes system metrics including active sessions, message log states, and job queue lengths.

---

## 🔒 Security Hardening

1. **API Key Authentication**: Global middleware validates the `X-API-Key` header.
2. **Domain Allowlist**: The media downloader only processes URLs matching domains in `ALLOWED_FILE_DOMAINS` (e.g. `raw.githubusercontent.com`).
3. **MIME & Size Limits**: Strict checks enforce PDF/XLSX/CSV/TXT formats and reject files exceeding `MAX_FILE_SIZE_MB`.
4. **Pino Redactions**: Hardcoded API keys and credential tokens are censored from the application log output.
