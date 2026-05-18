-- AlterTable
ALTER TABLE "units" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;
