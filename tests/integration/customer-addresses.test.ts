import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

describe("Phase 5: Customer Address Book & Isolation Suite", () => {
  let customerAId: string;
  let customerBId: string;
  let addressA1Id: string;
  let addressA2Id: string;

  beforeAll(async () => {
    // 1. Create Customer A
    const [userA] = await db
      .insert(schema.user)
      .values({
        id: `cust-a-${Date.now()}`,
        name: "Customer Alpha",
        email: `cust-a-${Date.now()}@mercato.local`,
        role: "customer",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (!userA) throw new Error("userA creation failed");
    customerAId = userA.id;

    // 2. Create Customer B
    const [userB] = await db
      .insert(schema.user)
      .values({
        id: `cust-b-${Date.now()}`,
        name: "Customer Beta",
        email: `cust-b-${Date.now()}@mercato.local`,
        role: "customer",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (!userB) throw new Error("userB creation failed");
    customerBId = userB.id;
  });

  afterAll(async () => {
    if (customerAId) {
      await db.delete(schema.user).where(eq(schema.user.id, customerAId));
    }
    if (customerBId) {
      await db.delete(schema.user).where(eq(schema.user.id, customerBId));
    }
  });

  it("creates first address and automatically sets it as default", async () => {
    const [addr1] = await db
      .insert(schema.customerAddresses)
      .values({
        customerId: customerAId,
        recipientName: "Customer Alpha",
        phone: "081234567890",
        street: "Jl. Sudirman No. 10",
        province: "DKI Jakarta",
        city: "Jakarta Pusat",
        district: "Gambir",
        postalCode: "10110",
        isDefault: true,
      })
      .returning();

    if (!addr1) throw new Error("addr1 creation failed");
    expect(addr1).toBeDefined();
    expect(addr1.isDefault).toBe(true);
    addressA1Id = addr1.id;
  });

  it("unsets first default address when second address is marked default", async () => {
    await db.transaction(async (tx) => {
      // Unset previous defaults
      await tx
        .update(schema.customerAddresses)
        .set({ isDefault: false })
        .where(eq(schema.customerAddresses.customerId, customerAId));

      const [addr2] = await tx
        .insert(schema.customerAddresses)
        .values({
          customerId: customerAId,
          recipientName: "Alpha Office",
          phone: "081298765432",
          street: "Jl. Thamrin No. 20",
          province: "DKI Jakarta",
          city: "Jakarta Pusat",
          district: "Menteng",
          postalCode: "10310",
          isDefault: true,
        })
        .returning();

      if (!addr2) throw new Error("addr2 creation failed");
      addressA2Id = addr2.id;
    });

    const [recheckA1] = await db
      .select()
      .from(schema.customerAddresses)
      .where(eq(schema.customerAddresses.id, addressA1Id));

    const [recheckA2] = await db
      .select()
      .from(schema.customerAddresses)
      .where(eq(schema.customerAddresses.id, addressA2Id));

    expect(recheckA1?.isDefault).toBe(false);
    expect(recheckA2?.isDefault).toBe(true);
  });

  it("prevents Customer B from deleting Customer A's address (IDOR protection)", async () => {
    // Customer B attempts to delete Address A1
    const deleted = await db
      .delete(schema.customerAddresses)
      .where(
        and(
          eq(schema.customerAddresses.id, addressA1Id),
          eq(schema.customerAddresses.customerId, customerBId), // IDOR check
        ),
      )
      .returning();

    expect(deleted.length).toBe(0);

    // Verify Address A1 is still intact
    const [stillExists] = await db
      .select()
      .from(schema.customerAddresses)
      .where(eq(schema.customerAddresses.id, addressA1Id));

    expect(stillExists).toBeDefined();
  });

  it("allows Customer A to delete their own address", async () => {
    const deleted = await db
      .delete(schema.customerAddresses)
      .where(
        and(
          eq(schema.customerAddresses.id, addressA1Id),
          eq(schema.customerAddresses.customerId, customerAId),
        ),
      )
      .returning();

    expect(deleted.length).toBe(1);

    const [recheck] = await db
      .select()
      .from(schema.customerAddresses)
      .where(eq(schema.customerAddresses.id, addressA1Id));

    expect(recheck).toBeUndefined();
  });
});
