import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

async function main() {
  console.log("Starting Mercato database seed process...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME ?? "Mercato Owner";

  if (!adminEmail || !adminPassword) {
    console.error(
      "\nError: Admin credentials must not be hardcoded.\n" +
        "Please provide SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD via environment variables or .env.local.\n" +
        "Example:\n" +
        '  SEED_ADMIN_EMAIL="admin@mercato.local" SEED_ADMIN_PASSWORD="YourSecurePassword123!" pnpm db:seed\n',
    );
    process.exit(1);
  }

  // 1. Provision default store
  console.log("Seeding primary store...");
  const [existingStore] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.slug, "mercato-indonesia"))
    .limit(1);

  let storeId: string;
  if (!existingStore) {
    const [createdStore] = await db
      .insert(schema.stores)
      .values({
        name: "Mercato Indonesia",
        slug: "mercato-indonesia",
        currency: "IDR",
        locale: "id",
        description: "Toko resmi Mercato untuk pasar Indonesia.",
      })
      .returning();

    if (!createdStore) {
      throw new Error("Failed to create primary store record");
    }
    storeId = createdStore.id;
    console.log(`Created primary store: ${createdStore.name} (${storeId})`);
  } else {
    storeId = existingStore.id;
    console.log(`Store already exists: ${existingStore.name} (${storeId})`);
  }

  // 2. Provision or update administrator / owner user
  console.log(`Checking existing user record for ${adminEmail}...`);
  const [existingUser] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, adminEmail.toLowerCase()))
    .limit(1);

  if (!existingUser) {
    console.log(`Creating owner account for ${adminEmail}...`);
    try {
      const response = await auth.api.signUpEmail({
        body: {
          email: adminEmail.toLowerCase(),
          password: adminPassword,
          name: adminName,
        },
      });

      if (response?.user?.id) {
        // Upgrade role to owner, mark email verified, and associate primary store
        await db
          .update(schema.user)
          .set({
            role: "owner",
            emailVerified: true,
            storeId: storeId,
          })
          .where(eq(schema.user.id, response.user.id));

        console.log(`Successfully provisioned owner account: ${adminEmail}`);
      }
    } catch (err) {
      console.error("Failed to provision administrator account via Better Auth:", err);
      process.exit(1);
    }
  } else {
    console.log(`Admin user ${adminEmail} already exists. Updating role and resetting password...`);
    const hashedPassword = await hashPassword(adminPassword);

    await db
      .update(schema.user)
      .set({
        name: adminName,
        role: "owner",
        emailVerified: true,
        storeId: storeId,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, existingUser.id));

    const [existingAccount] = await db
      .select()
      .from(schema.account)
      .where(
        and(
          eq(schema.account.userId, existingUser.id),
          eq(schema.account.providerId, "credential"),
        ),
      )
      .limit(1);

    if (existingAccount) {
      await db
        .update(schema.account)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(schema.account.id, existingAccount.id));
      console.log(`Successfully updated existing credentials for owner: ${adminEmail}`);
    } else {
      await db.insert(schema.account).values({
        id: crypto.randomUUID(),
        accountId: existingUser.id,
        providerId: "credential",
        userId: existingUser.id,
        password: hashedPassword,
      });
      console.log(
        `Created credential account record with updated password for owner: ${adminEmail}`,
      );
    }
  }

  console.log("Database seed completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
