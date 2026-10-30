import { eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { assertSafeTarget } from "./script-safety";

const isTestTarget = process.argv.includes("--test");

async function main() {
  const rawTargetUrl = isTestTarget ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

  if (!rawTargetUrl) {
    console.error(
      `Error: ${isTestTarget ? "TEST_DATABASE_URL" : "DATABASE_URL"} is not defined in environment.`,
    );
    process.exit(1);
  }

  // 1. Production & Target Safety Guard
  const safety = assertSafeTarget({
    targetUrl: rawTargetUrl,
    scriptName: "db:rewrite-legacy-images",
  });

  const isConfirmed = safety.confirmed;

  console.log("==================================================");
  console.log("Mercato Legacy Image URL Rewrite Tool");
  console.log(`Target: ${isTestTarget ? "TEST" : "DEV"} Database (${safety.maskedTarget})`);
  console.log(
    `Mode: ${isConfirmed ? "APPLY CHANGES" : `DRY RUN (pass --confirm-target=${safety.maskedTarget} to apply)`}`,
  );
  console.log("==================================================\n");

  // Normalize sslmode
  const connectionString = rawTargetUrl.replace(
    /sslmode=(?:require|prefer|verify-ca)/g,
    "sslmode=verify-full",
  );

  const pool = new Pool({ connectionString, max: 2 });
  const targetDb = drizzle(pool, { schema });

  try {
    // 2. Scan Collections
    const allCollections = await targetDb.select().from(schema.collections);
    const externalCollections = allCollections.filter(
      (c) => c.imageUrl && (c.imageUrl.startsWith("http://") || c.imageUrl.startsWith("https://")),
    );

    console.log(`Table: collections`);
    console.log(`  - Scanned: ${allCollections.length} rows`);
    console.log(`  - External URLs found: ${externalCollections.length} rows`);

    const collectionMap: Record<string, string> = {
      terlaris: "/images/collections/terlaris.svg",
      "batik-nusantara": "/images/collections/batik-nusantara.svg",
      "gaya-hidup-modern": "/images/collections/gaya-hidup-modern.svg",
      "koleksi-hari-raya": "/images/collections/koleksi-hari-raya.svg",
    };

    let collectionsRewritten = 0;
    if (isConfirmed && externalCollections.length > 0) {
      for (const col of externalCollections) {
        const localPath = collectionMap[col.slug] || "/images/collections/terlaris.svg";
        await targetDb
          .update(schema.collections)
          .set({ imageUrl: localPath, updatedAt: new Date() })
          .where(eq(schema.collections.id, col.id));
        collectionsRewritten++;
      }
    }
    console.log(`  - Rewritten: ${collectionsRewritten} rows\n`);

    // 3. Scan Product Images
    const allProductImages = await targetDb
      .select({
        id: schema.productImages.id,
        productId: schema.productImages.productId,
        url: schema.productImages.url,
        productSlug: schema.products.slug,
      })
      .from(schema.productImages)
      .leftJoin(schema.products, eq(schema.productImages.productId, schema.products.id));

    const externalProductImages = allProductImages.filter(
      (pi) => pi.url && (pi.url.startsWith("http://") || pi.url.startsWith("https://")),
    );

    console.log(`Table: product_images`);
    console.log(`  - Scanned: ${allProductImages.length} rows`);
    console.log(`  - External URLs found: ${externalProductImages.length} rows`);

    let productImagesRewritten = 0;
    if (isConfirmed && externalProductImages.length > 0) {
      for (const pi of externalProductImages) {
        const slug = pi.productSlug || "";
        const localPath = slug ? `/images/products/${slug}.svg` : "/images/placeholder.svg";
        await targetDb
          .update(schema.productImages)
          .set({ url: localPath })
          .where(eq(schema.productImages.id, pi.id));
        productImagesRewritten++;
      }
    }
    console.log(`  - Rewritten: ${productImagesRewritten} rows\n`);

    // 4. Scan User Images
    const allUsers = await targetDb
      .select({ id: schema.user.id, image: schema.user.image })
      .from(schema.user);
    const externalUsers = allUsers.filter(
      (u) => u.image && (u.image.includes("unsplash.com") || u.image.startsWith("http")),
    );

    console.log(`Table: user`);
    console.log(`  - Scanned: ${allUsers.length} rows`);
    console.log(`  - External URLs found: ${externalUsers.length} rows`);

    let usersRewritten = 0;
    if (isConfirmed && externalUsers.length > 0) {
      for (const u of externalUsers) {
        await targetDb
          .update(schema.user)
          .set({ image: null, updatedAt: new Date() })
          .where(eq(schema.user.id, u.id));
        usersRewritten++;
      }
    }
    console.log(`  - Rewritten: ${usersRewritten} rows\n`);

    // 5. Post-Rewrite Verification
    const remainingCols = await targetDb
      .select()
      .from(schema.collections)
      .where(
        or(
          like(schema.collections.imageUrl, "http://%"),
          like(schema.collections.imageUrl, "https://%"),
        ),
      );

    const remainingProdImgs = await targetDb
      .select()
      .from(schema.productImages)
      .where(
        or(like(schema.productImages.url, "http://%"), like(schema.productImages.url, "https://%")),
      );

    console.log("==================================================");
    console.log("Verification Summary:");
    console.log(`  - Remaining external collections: ${remainingCols.length}`);
    console.log(`  - Remaining external product images: ${remainingProdImgs.length}`);

    if (isConfirmed) {
      if (remainingCols.length === 0 && remainingProdImgs.length === 0) {
        console.log("Status: SUCCESS - All legacy external image host URLs eliminated.");
      } else {
        console.warn("Status: WARNING - Some external image URLs remain in database.");
      }
    } else {
      console.log("Status: DRY RUN COMPLETE - Rerun with --confirm to apply.");
    }
    console.log("==================================================\n");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Execution failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
