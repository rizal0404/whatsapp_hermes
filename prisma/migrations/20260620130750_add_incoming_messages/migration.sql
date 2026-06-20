-- CreateTable
CREATE TABLE "incoming_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" VARCHAR(100) NOT NULL,
    "remote_jid" VARCHAR(100) NOT NULL,
    "sender_jid" VARCHAR(100) NOT NULL,
    "sender_name" VARCHAR(255),
    "wa_message_id" VARCHAR(255) NOT NULL,
    "trigger_type" VARCHAR(50) NOT NULL,
    "message_type" VARCHAR(50) NOT NULL,
    "content" TEXT,
    "quoted_message_id" VARCHAR(255),
    "quoted_content" TEXT,
    "is_group" BOOLEAN NOT NULL DEFAULT false,
    "group_name" VARCHAR(255),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "message_timestamp" TIMESTAMPTZ NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "incoming_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gateway_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "incoming_messages_session_id_is_read_idx" ON "incoming_messages"("session_id", "is_read");

-- CreateIndex
CREATE INDEX "incoming_messages_session_id_trigger_type_idx" ON "incoming_messages"("session_id", "trigger_type");

-- CreateIndex
CREATE INDEX "incoming_messages_session_id_is_group_idx" ON "incoming_messages"("session_id", "is_group");

-- CreateIndex
CREATE INDEX "incoming_messages_message_timestamp_idx" ON "incoming_messages"("message_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "incoming_messages_session_id_wa_message_id_key" ON "incoming_messages"("session_id", "wa_message_id");
