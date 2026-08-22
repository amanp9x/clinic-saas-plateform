-- Hand-added: Prisma's schema DSL cannot express a partial unique index. This is the real,
-- DB-enforced, unbypassable "at most one active refund request per payment" guarantee — mirrors
-- the identical pattern already used for SlotHold (Phase 8) and SettlementRequest (Phase 25).
CREATE UNIQUE INDEX "refund_requests_payment_active_key"
  ON "refund_requests" ("paymentId")
  WHERE "status" = 'REQUESTED';
