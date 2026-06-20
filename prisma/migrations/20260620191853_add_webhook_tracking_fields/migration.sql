-- AlterTable
ALTER TABLE "incoming_messages" ADD COLUMN     "webhook_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "webhook_delivered_at" TIMESTAMPTZ,
ADD COLUMN     "webhook_last_error" TEXT,
ADD COLUMN     "webhook_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "incoming_messages_webhook_status_idx" ON "incoming_messages"("webhook_status");
