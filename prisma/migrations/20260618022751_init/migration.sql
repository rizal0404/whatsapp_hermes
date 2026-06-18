-- CreateTable
CREATE TABLE "wa_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL,
    "phone_number" VARCHAR(50),
    "last_connected_at" TIMESTAMPTZ,
    "last_disconnected_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wa_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_key" VARCHAR(255),
    "source" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "message_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" VARCHAR(100) NOT NULL,
    "batch_id" UUID,
    "session_id" VARCHAR(100) NOT NULL,
    "recipient" VARCHAR(100) NOT NULL,
    "recipient_type" VARCHAR(50) NOT NULL,
    "message_type" VARCHAR(50) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempt" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "queued_at" TIMESTAMPTZ,
    "processing_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor" VARCHAR(100),
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "to" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wa_sessions_session_id_key" ON "wa_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_batches_batch_key_key" ON "message_batches"("batch_key");

-- CreateIndex
CREATE UNIQUE INDEX "message_logs_message_id_key" ON "message_logs"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_logs_idempotency_key_key" ON "message_logs"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_to_key" ON "recipients"("to");

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "message_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
