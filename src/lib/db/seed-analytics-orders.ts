import { eq } from "drizzle-orm";
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

  console.log(`[SEED ANALYTICS]: Seeding historical orders into ${safety.maskedTarget}...`);

  const [store] = await db.select().from(schema.stores).limit(1);
  if (!store) {
    throw new Error("No store found. Please run catalog seed first.");
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

  const mockCustomers = [
    { name: "Budi Santoso", email: "budi.santoso@example.com", phone: "081234567890" },
    { name: "Siti Rahmawati", email: "siti.rahma@example.com", phone: "081398765432" },
    { name: "Ahmad Wijaya", email: "ahmad.wijaya@example.com", phone: "085612345678" },
    { name: "Dewi Lestari", email: "dewi.lestari@example.com", phone: "087811223344" },
  ];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let seededOrdersCount = 0;

  // Generate 15 historical orders over the past 30 days
  const sampleDaysAgo = [1, 2, 3, 5, 7, 9, 12, 14, 16, 19, 21, 23, 25, 27, 29];

  for (let i = 0; i < sampleDaysAgo.length; i++) {
    const daysAgo = sampleDaysAgo[i] ?? 1;
    const orderDate = new Date(now - daysAgo * dayMs);
    const customer = mockCustomers[i % mockCustomers.length] ?? mockCustomers[0];
    if (!customer) continue;
    const orderNumber = `MRC-SIM-${Date.now().toString().slice(-6)}-${i + 1}`;

    // Select 1 or 2 items
    const item1 = variants[i % variants.length] ?? variants[0];
    const item2 = variants[(i + 1) % variants.length] ?? variants[0];
    if (!item1 || !item2) continue;
    const hasSecondItem = i % 2 === 0;

    const subtotal = item1.price + (hasSecondItem ? item2.price : 0);
    const shippingAmount = 15000;
    const totalAmount = subtotal + shippingAmount;

    const statuses = ["delivered", "shipped", "paid", "processing", "delivered"];
    const status = statuses[i % statuses.length] ?? "paid";

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
        paymentStatus: "paid",
        paymentProvider: "midtrans",
        currency: "IDR",
        subtotal,
        shippingAmount,
        discountAmount: 0,
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
          street: "Jl. Merdeka No. 45",
          district: "Gambir",
          city: "Jakarta Pusat",
          province: "DKI Jakarta",
          postalCode: "10110",
          country: "Indonesia",
        },
        createdAt: orderDate,
        updatedAt: orderDate,
      })
      .returning();

    if (!order) continue;

    // Insert order items
    await db.insert(schema.orderItems).values([
      {
        orderId: order.id,
        productId: item1.productId,
        variantId: item1.id,
        sku: item1.sku,
        productName: item1.productName,
        variantTitle: item1.title,
        quantity: 1,
        unitPrice: item1.price,
        totalPrice: item1.price,
      },
      ...(hasSecondItem
        ? [
            {
              orderId: order.id,
              productId: item2.productId,
              variantId: item2.id,
              sku: item2.sku,
              productName: item2.productName,
              variantTitle: item2.title,
              quantity: 1,
              unitPrice: item2.price,
              totalPrice: item2.price,
            },
          ]
        : []),
    ]);

    seededOrdersCount++;
  }

  console.log(`[SEED ANALYTICS]: Successfully generated ${seededOrdersCount} historical orders!`);
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
