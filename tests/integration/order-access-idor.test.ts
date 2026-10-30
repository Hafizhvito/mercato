import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { orderService } from "@/modules/orders/service";

describe("Phase 4 Security: Order Access Control & IDOR Prevention", () => {
  it("enforces strict access control: guest token, ownership, and blocks IDOR enumeration", async () => {
    // 1. Resolve store
    const [store] = await db.select().from(schema.stores).limit(1);
    expect(store).toBeDefined();
    if (!store) return;

    // 2. Fetch or create a variant with sufficient stock
    const timestamp = Date.now();
    const [product] = await db
      .insert(schema.products)
      .values({
        storeId: store.id,
        name: `IDOR Test Product ${timestamp}`,
        slug: `idor-test-product-${timestamp}`,
        status: "published",
      })
      .returning();

    const [variant] = await db
      .insert(schema.productVariants)
      .values({
        storeId: store.id,
        productId: product?.id ?? "",
        title: "Standard",
        sku: `SKU-IDOR-${timestamp}`,
        price: 150000,
        stock: 50,
      })
      .returning();

    if (!variant || !product) {
      throw new Error("IDOR test fixture initialization failed");
    }

    const customerAId = crypto.randomUUID();
    const customerBId = crypto.randomUUID();

    await db.insert(schema.user).values([
      {
        id: customerAId,
        name: "Customer A",
        email: `cust-a-${timestamp}@example.com`,
        role: "customer",
      },
      {
        id: customerBId,
        name: "Customer B",
        email: `cust-b-${timestamp}@example.com`,
        role: "customer",
      },
    ]);

    // 3. Create Order for Customer A
    const orderResultA = await orderService.createOrder({
      storeId: store.id,
      customerId: customerAId,
      idempotencyKey: `idemp-idor-custA-${Date.now()}`,
      checkoutSessionId: `sess-idor-custA-${Date.now()}`,
      items: [{ productId: variant.productId, variantId: variant.id, quantity: 1 }],
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 18000,
      shippingAddress: {
        recipientName: "Budi Santoso",
        phone: "08123456789",
        street: "Jl. Sudirman No. 10",
        district: "Gambir",
        city: "Jakarta Pusat",
        province: "DKI Jakarta",
        postalCode: "10110",
        country: "Indonesia",
      },
    });

    const orderA = orderResultA.order;
    expect(orderA.guestAccessToken).toBeDefined();
    expect(orderA.guestAccessToken.length).toBeGreaterThanOrEqual(32);

    // Scenario 1: Customer A accesses their own order -> ALLOWED
    const accessOwn = await orderService.verifyOrderAccess({
      orderNumber: orderA.orderNumber,
      storeId: store.id,
      userId: customerAId,
    });
    expect(accessOwn.authorized).toBe(true);
    expect(accessOwn.order?.id).toBe(orderA.id);

    // Scenario 2: Customer B tries to view Customer A's order without token (IDOR attempt) -> BLOCKED
    const idorCustomerB = await orderService.verifyOrderAccess({
      orderNumber: orderA.orderNumber,
      storeId: store.id,
      userId: customerBId,
    });
    expect(idorCustomerB.authorized).toBe(false);
    expect(idorCustomerB.reason).toBe("UNAUTHORIZED");

    // Scenario 3: Anonymous guest without token tries to guess orderNumber -> BLOCKED
    const unauthenticatedNoToken = await orderService.verifyOrderAccess({
      orderNumber: orderA.orderNumber,
      storeId: store.id,
    });
    expect(unauthenticatedNoToken.authorized).toBe(false);
    expect(unauthenticatedNoToken.reason).toBe("UNAUTHORIZED");

    // Scenario 4: Anonymous guest with incorrect/forged token -> BLOCKED
    const forgedToken = await orderService.verifyOrderAccess({
      orderNumber: orderA.orderNumber,
      storeId: store.id,
      token: "forged-guessable-token-12345",
    });
    expect(forgedToken.authorized).toBe(false);
    expect(forgedToken.reason).toBe("UNAUTHORIZED");

    // Scenario 5: Guest with genuine unguessable token -> ALLOWED
    const guestValidToken = await orderService.verifyOrderAccess({
      orderNumber: orderA.orderNumber,
      storeId: store.id,
      token: orderA.guestAccessToken,
    });
    expect(guestValidToken.authorized).toBe(true);
    expect(guestValidToken.order?.id).toBe(orderA.id);

    // Scenario 6: Admin or Staff with administrative privileges -> ALLOWED
    const adminAccess = await orderService.verifyOrderAccess({
      orderNumber: orderA.orderNumber,
      storeId: store.id,
      userRole: "admin",
    });
    expect(adminAccess.authorized).toBe(true);
    expect(adminAccess.order?.id).toBe(orderA.id);
  });
});
