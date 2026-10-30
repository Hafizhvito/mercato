import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

const TARGET_LEGACY_EMAIL = "admin@mercato.local";

async function main() {
  console.log("Starting Mercato Legacy Admin Account Cleanup Utility...");

  // 1. Guard against running in production
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Security Violation: Cleanup script cannot be executed in production environments.",
    );
    process.exit(1);
  }

  // 2. Guard against production database URL indicators
  const dbUrl = env.DATABASE_URL.toLowerCase();
  if (dbUrl.includes("production") || dbUrl.includes("-prod") || dbUrl.includes("prod-")) {
    console.error(
      "Security Violation: Target database indicates production environment. Aborting.",
    );
    process.exit(1);
  }

  // 3. Require explicit confirmation flag
  const args = process.argv.slice(2);
  const hasConfirmArg = args.includes("--confirm");
  const hasConfirmEnv = process.env.CONFIRM_CLEANUP === "true";

  if (!hasConfirmArg && !hasConfirmEnv) {
    console.error(
      "\nConfirmation Required:\n" +
        `This utility permanently purges the legacy demo account '${TARGET_LEGACY_EMAIL}'.\n` +
        "You must supply the explicit confirmation flag:\n" +
        "  pnpm db:cleanup-legacy-admin --confirm\n" +
        "or\n" +
        "  CONFIRM_CLEANUP=true pnpm db:cleanup-legacy-admin\n",
    );
    process.exit(1);
  }

  // 4. Find legacy user
  const [legacyUser] = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.email, TARGET_LEGACY_EMAIL))
    .limit(1);

  if (!legacyUser) {
    console.log(`Legacy account '${TARGET_LEGACY_EMAIL}' was not found. No cleanup necessary.`);
    process.exit(0);
  }

  console.log(
    `Found legacy account for '${TARGET_LEGACY_EMAIL}' (ID: ${legacyUser.id}). Purging...`,
  );

  // 5. Delete credential accounts and user record
  await db.delete(schema.account).where(eq(schema.account.userId, legacyUser.id));
  await db.delete(schema.session).where(eq(schema.session.userId, legacyUser.id));
  await db.delete(schema.user).where(eq(schema.user.id, legacyUser.id));

  console.log(
    `Successfully purged legacy account '${TARGET_LEGACY_EMAIL}' and associated sessions/credentials.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing legacy cleanup:", err);
  process.exit(1);
});
