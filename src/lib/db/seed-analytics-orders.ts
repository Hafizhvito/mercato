import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { assertSafeTarget } from "@/lib/db/script-safety";

export async function seedAnalyticsOrders() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required.");
  }

  const safety = assertSafeTarget({
    targetUrl: databaseUrl,
    scriptName: "db:seed-analytics-orders",
  });

  if (!safety.confirmed) {
    console.log(
      `\n[SAFETY CHECK]: Script "db:seed-analytics-orders" requires explicit confirmation.\n` +
        `Target Database: ${safety.maskedTarget}\n` +
        `To proceed, rerun the command with:\n` +
        `  pnpm db:seed-analytics-orders --confirm-target=${safety.maskedTarget}\n`,
    );
    process.exit(1);
  }

  console.log(
    `[SEED ANALYTICS]: Seeding ~200 demo historical orders into ${safety.maskedTarget}...`,
  );

  const [store] = await db.select().from(schema.stores).limit(1);
  if (!store) {
    throw new Error("No store found. Please run catalog seed first.");
  }

  // Idempotency: Tag fake orders with 'MRC-SIM-' prefix and clean prior fake orders
  const existingSim = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(
      and(eq(schema.orders.storeId, store.id), sql`${schema.orders.orderNumber} LIKE 'MRC-SIM-%'`),
    );

  if (existingSim.length > 0) {
    console.log(
      `[SEED ANALYTICS]: Found ${existingSim.length} existing demo orders (prefix 'MRC-SIM-'). Cleaning prior demo orders to ensure clean idempotency...`,
    );
    await db
      .delete(schema.orders)
      .where(
        and(
          eq(schema.orders.storeId, store.id),
          sql`${schema.orders.orderNumber} LIKE 'MRC-SIM-%'`,
        ),
      );
  }

  const variants = await db
    .select({
      id: schema.productVariants.id,
      sku: schema.productVariants.sku,
      title: schema.productVariants.title,
      price: schema.productVariants.price,
      productId: schema.productVariants.productId,
      productName: schema.products.name,
    })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
    .limit(10);

  if (variants.length === 0) {
    throw new Error("No product variants found in database. Please run catalog seed first.");
  }

  // Fictional test customers using strictly @example.test addresses
  const mockCustomers = [
    { name: "Budi Santoso", email: "budi.santoso@example.test", phone: "081234567890" },
    { name: "Siti Rahmawati", email: "siti.rahma@example.test", phone: "081398765432" },
    { name: "Ahmad Wijaya", email: "ahmad.wijaya@example.test", phone: "085612345678" },
    { name: "Dewi Lestari", email: "dewi.lestari@example.test", phone: "087811223344" },
    { name: "Rian Hidayat", email: "rian.hidayat@example.test", phone: "082155667788" },
    { name: "Nurul Indah", email: "nurul.indah@example.test", phone: "081299887766" },
    { name: "Fajar Pratama", email: "fajar.pratama@example.test", phone: "085733445566" },
    { name: "Maya Anggraini", email: "maya.anggraini@example.test", phone: "087711992288" },
  ];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let seededOrdersCount = 0;
  let seededRefundsCount = 0;

  // Generate 200 orders spread across the past 60 days
  const TOTAL_ORDERS = 200;

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    // Spread evenly across 60 days (0 to 59 days ago)
    const daysAgo = (i % 60) + 1;
    // Vary the hour to test daytime and boundary UTC timestamps (e.g. 17:30 UTC)
    const hourOffset = (i * 7) % 24;
    const orderDate = new Date(now - daysAgo * dayMs + hourOffset * 60 * 60 * 1000);
    const customer = mockCustomers[i % mockCustomers.length] ?? mockCustomers[0];
    if (!customer) continue;

    const orderNumber = `MRC-SIM-${daysAgo.toString().padStart(2, "0")}-${(i + 1).toString().padStart(3, "0")}`;

    // Select 1 to 3 items
    const item1 = variants[i % variants.length] ?? variants[0];
    const item2 = variants[(i + 1) % variants.length] ?? variants[0];
    const item3 = variants[(i + 2) % variants.length] ?? variants[0];
    if (!item1) continue;

    const itemCount = (i % 3) + 1;
    const items = [item1];
    if (itemCount >= 2 && item2) items.push(item2);
    if (itemCount === 3 && item3) items.push(item3);

    const subtotal = items.reduce((acc, it) => acc + it.price, 0);
    const shippingAmount = i % 2 === 0 ? 15000 : 25000;
    const totalAmount = subtotal + shippingAmount;

    // Distribute statuses realistically
    // ~60% delivered, ~20% shipped, ~10% paid/processing, ~5% cancelled, ~5% refunded
    const mod = i % 20;
    let status = "delivered";
    let paymentStatus = "paid";

    if (mod === 0) {
      status = "cancelled";
      paymentStatus = "unpaid";
    } else if (mod === 1) {
      status = "refunded";
      paymentStatus = "refunded";
    } else if (mod === 2 || mod === 3) {
      status = "processing";
      paymentStatus = "paid";
    } else if (mod >= 4 && mod <= 7) {
      status = "shipped";
      paymentStatus = "paid";
    } else {
      status = "delivered";
      paymentStatus = "paid";
    }

    const [order] = await db
      .insert(schema.orders)
      .values({
        storeId: store.id,
        orderNumber,
        guestEmail: customer.email,
        guestAccessToken: `token-sim-${i}-${Date.now()}`,
        idempotencyKey: `idem-sim-${i}-${Date.now()}`,
        checkoutSessionId: `sess-sim-${i}-${Date.now()}`,
        status,
        paymentStatus,
        paymentProvider: "midtrans",
        currency: "IDR",
        subtotal,
        shippingAmount,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingTrackingNumber:
          status === "shipped" || status === "delivered" ? `JNE${Date.now() + i}` : null,
        shippedAt: status === "shipped" || status === "delivered" ? orderDate : null,
        deliveredAt: status === "delivered" ? orderDate : null,
        shippingAddress: {
          recipientName: customer.name,
          phone: customer.phone,
          street: `Jl. Simulasi No. ${i + 1}`,
          district: "Kebayoran Baru",
          city: "Jakarta Selatan",
          province: "DKI Jakarta",
          postalCode: "12180",
          country: "Indonesia",
        },
        createdAt: orderDate,
        updatedAt: orderDate,
      })
      .returning();

    if (!order) continue;

    // Insert order items
    await db.insert(schema.orderItems).values(
      items.map((it) => ({
        orderId: order.id,
        productId: it.productId,
        variantId: it.id,
        sku: it.sku,
        productName: it.productName,
        variantTitle: it.title,
        quantity: 1,
        unitPrice: it.price,
        totalPrice: it.price,
      })),
    );

    // If refunded status, insert refund record
    if (status === "refunded") {
      await db.insert(schema.refunds).values({
        orderId: order.id,
        amount: totalAmount,
        currency: "IDR",
        reason: "Simulated customer satisfaction refund",
        restocked: true,
        status: "completed",
        createdAt: new Date(orderDate.getTime() + 2 * 60 * 60 * 1000),
      });
      seededRefundsCount++;
    }

    seededOrdersCount++;
  }

  console.log(
    `[SEED ANALYTICS]: Successfully generated ${seededOrdersCount} orders and ${seededRefundsCount} refunds!`,
  );
}

// Auto-run if executed directly via node/tsx
if (process.argv[1]?.includes("seed-analytics-orders")) {
  seedAnalyticsOrders()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
