// Create (or reset the password of) an admin user.
//   npm run admin:create -- anna@diversityxventures.com "Anna"
// A strong random password is generated and printed once; share it securely.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

async function main() {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const name = nameParts.join(" ").trim();
  if (!email || !name) {
    console.error('Usage: npm run admin:create -- <email> "<Full name>"');
    process.exit(1);
  }

  const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "ADMIN" },
    update: { name, passwordHash },
  });

  console.log(`Admin ready: ${user.name} <${user.email}>`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Password: ${password}`);
}

main().finally(() => db.$disconnect());
