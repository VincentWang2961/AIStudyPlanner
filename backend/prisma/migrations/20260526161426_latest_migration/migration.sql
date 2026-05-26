-- AlterTable
ALTER TABLE "units" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "token_usage" (
    "date" TEXT NOT NULL,
    "tokens_used" BIGINT NOT NULL DEFAULT 0,
    "request_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "token_usage_pkey" PRIMARY KEY ("date")
);
