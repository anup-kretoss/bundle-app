// app/db.server.ts
import { PrismaClient } from "@prisma/client";

// Fix BigInt JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL || "file:./dev.sqlite",
      log: ['error']
    });
    
    // Test connection on first use
    global.prismaGlobal.$connect()
      .then(() => console.log('✅ Database connected'))
      .catch(err => console.error('❌ Database connection error:', err));
  }
  prisma = global.prismaGlobal;
} else {
  prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: ['error']
  });
}

export default prisma;