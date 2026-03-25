import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@kronomondo.org";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";

  const passwordHash = await bcryptjs.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "admin" },
    create: {
      email: adminEmail,
      passwordHash,
      role: "admin",
      preferredLanguage: "tr",
      translationLanguage: "tr",
    },
  });

  console.log(`Admin user created/updated: ${admin.email}`);

  // Create default system settings
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      defaultLanguage: "tr",
      supportedLanguages: ["tr", "en", "de", "fr", "es"],
    },
  });

  console.log("System settings initialized");

  // Create admin user settings
  await prisma.userSettings.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
