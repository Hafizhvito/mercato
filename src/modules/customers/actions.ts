"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

async function getAuthenticatedUser() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    throw new Error("Authentication required: Please log in to manage your account.");
  }
  return session.user;
}

export interface SaveAddressInput {
  id?: string;
  recipientName: string;
  phone: string;
  street: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  isDefault?: boolean;
}

/**
 * Creates or updates a saved customer address.
 * Automatically unsets other default addresses if isDefault is set to true.
 */
export async function saveCustomerAddressAction(input: SaveAddressInput) {
  const user = await getAuthenticatedUser();

  if (!input.recipientName?.trim()) throw new Error("Nama penerima wajib diisi.");
  if (!input.phone?.trim()) throw new Error("Nomor telepon penerima wajib diisi.");
  if (!input.street?.trim()) throw new Error("Alamat jalan wajib diisi.");
  if (!input.province?.trim()) throw new Error("Provinsi wajib dipilih.");
  if (!input.city?.trim()) throw new Error("Kota / Kabupaten wajib dipilih.");
  if (!input.district?.trim()) throw new Error("Kecamatan wajib dipilih.");
  if (!input.postalCode?.trim()) throw new Error("Kode pos wajib diisi.");

  const isDefault = Boolean(input.isDefault);

  const result = await db.transaction(async (tx) => {
    // If setting as default, clear existing default addresses for this customer
    if (isDefault) {
      await tx
        .update(schema.customerAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.customerAddresses.customerId, user.id));
    }

    if (input.id) {
      // Verify ownership before updating
      const [existing] = await tx
        .select()
        .from(schema.customerAddresses)
        .where(
          and(
            eq(schema.customerAddresses.id, input.id),
            eq(schema.customerAddresses.customerId, user.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error("Alamat tidak ditemukan atau Anda tidak memiliki akses ke alamat ini.");
      }

      const [updated] = await tx
        .update(schema.customerAddresses)
        .set({
          recipientName: input.recipientName.trim(),
          phone: input.phone.trim(),
          street: input.street.trim(),
          province: input.province.trim(),
          city: input.city.trim(),
          district: input.district.trim(),
          postalCode: input.postalCode.trim(),
          isDefault,
          updatedAt: new Date(),
        })
        .where(eq(schema.customerAddresses.id, input.id))
        .returning();

      return updated;
    } else {
      // Check if this is the user's first address, make it default if so
      const existingAddresses = await tx
        .select({ id: schema.customerAddresses.id })
        .from(schema.customerAddresses)
        .where(eq(schema.customerAddresses.customerId, user.id));

      const shouldBeDefault = isDefault || existingAddresses.length === 0;

      const [created] = await tx
        .insert(schema.customerAddresses)
        .values({
          customerId: user.id,
          recipientName: input.recipientName.trim(),
          phone: input.phone.trim(),
          street: input.street.trim(),
          province: input.province.trim(),
          city: input.city.trim(),
          district: input.district.trim(),
          postalCode: input.postalCode.trim(),
          isDefault: shouldBeDefault,
        })
        .returning();

      return created;
    }
  });

  revalidatePath("/[locale]/account/addresses", "page");
  revalidatePath("/[locale]/checkout", "page");

  return { success: true, address: result };
}

/**
 * Deletes a customer saved address, verifying customer ownership.
 */
export async function deleteCustomerAddressAction(addressId: string) {
  const user = await getAuthenticatedUser();

  const [deleted] = await db
    .delete(schema.customerAddresses)
    .where(
      and(
        eq(schema.customerAddresses.id, addressId),
        eq(schema.customerAddresses.customerId, user.id),
      ),
    )
    .returning();

  if (!deleted) {
    throw new Error("Alamat tidak ditemukan atau Anda tidak berhak menghapus alamat ini.");
  }

  // If deleted address was default, set another address as default if one exists
  if (deleted.isDefault) {
    const [nextAddr] = await db
      .select({ id: schema.customerAddresses.id })
      .from(schema.customerAddresses)
      .where(eq(schema.customerAddresses.customerId, user.id))
      .limit(1);

    if (nextAddr) {
      await db
        .update(schema.customerAddresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(schema.customerAddresses.id, nextAddr.id));
    }
  }

  revalidatePath("/[locale]/account/addresses", "page");
  return { success: true };
}

/**
 * Sets a specific address as the default address for the customer.
 */
export async function setDefaultCustomerAddressAction(addressId: string) {
  const user = await getAuthenticatedUser();

  await db.transaction(async (tx) => {
    // Verify address exists and belongs to user
    const [addr] = await tx
      .select()
      .from(schema.customerAddresses)
      .where(
        and(
          eq(schema.customerAddresses.id, addressId),
          eq(schema.customerAddresses.customerId, user.id),
        ),
      )
      .limit(1);

    if (!addr) {
      throw new Error("Alamat tidak ditemukan atau Anda tidak berhak mengubah alamat ini.");
    }

    // Reset others
    await tx
      .update(schema.customerAddresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(schema.customerAddresses.customerId, user.id));

    // Set target
    await tx
      .update(schema.customerAddresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(schema.customerAddresses.id, addressId));
  });

  revalidatePath("/[locale]/account/addresses", "page");
  return { success: true };
}

/**
 * Updates customer profile information (name).
 */
export async function updateCustomerProfileAction(input: { name: string }) {
  const user = await getAuthenticatedUser();

  const trimmedName = input.name?.trim();
  if (!trimmedName || trimmedName.length < 2) {
    throw new Error("Nama profil minimal 2 karakter.");
  }

  await db
    .update(schema.user)
    .set({
      name: trimmedName,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, user.id));

  revalidatePath("/[locale]/account", "page");
  return { success: true };
}
