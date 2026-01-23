/*
  Warnings:

  - Made the column `rules` on table `Bundle` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "collectionTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "rules" TEXT NOT NULL,
    "discountCodes" JSONB
);
INSERT INTO "new_Bundle" ("collectionId", "collectionTitle", "createdAt", "id", "name", "rules", "updatedAt") SELECT "collectionId", "collectionTitle", "createdAt", "id", "name", "rules", "updatedAt" FROM "Bundle";
DROP TABLE "Bundle";
ALTER TABLE "new_Bundle" RENAME TO "Bundle";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
