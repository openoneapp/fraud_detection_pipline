-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "fraud_type" TEXT,
ADD COLUMN     "is_fraud" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "risk_score" INTEGER NOT NULL DEFAULT 0;
