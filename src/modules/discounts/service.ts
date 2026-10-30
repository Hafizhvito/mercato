import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { Discount } from "./schema";

export type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export interface ValidateDiscountResult {
  valid: boolean;
  discount?: Discount;
  discountAmountMinor: number;
  reason?: string;
}

export class DiscountService {
  async getDiscountByCode(storeId: string, code: string): Promise<Discount | null> {
    const normalizedCode = code.trim().toUpperCase();
    const [found] = await db
      .select()
      .from(schema.discounts)
      .where(and(eq(schema.discounts.storeId, storeId), eq(schema.discounts.code, normalizedCode)))
      .limit(1);

    return found ?? null;
  }

  async validateAndCalculate(params: {
    storeId: string;
    code: string;
    subtotalMinor: number;
    shippingAmountMinor?: number;
  }): Promise<ValidateDiscountResult> {
    const discount = await this.getDiscountByCode(params.storeId, params.code);
    if (!discount) {
      return { valid: false, discountAmountMinor: 0, reason: "Coupon code does not exist" };
    }

    if (!discount.isActive) {
      return { valid: false, discountAmountMinor: 0, reason: "Coupon is no longer active" };
    }

    const now = new Date();
    if (now < discount.startsAt) {
      return { valid: false, discountAmountMinor: 0, reason: "Coupon promotion has not started" };
    }

    if (discount.expiresAt && now > discount.expiresAt) {
      return { valid: false, discountAmountMinor: 0, reason: "Coupon promotion has expired" };
    }

    if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
      return {
        valid: false,
        discountAmountMinor: 0,
        reason: "Coupon usage limit has been reached",
      };
    }

    if (params.subtotalMinor < discount.minSpend) {
      return {
        valid: false,
        discountAmountMinor: 0,
        reason: `Minimum spend of ${discount.minSpend} required to apply this coupon`,
      };
    }

    let discountAmountMinor = 0;

    if (discount.type === "percentage") {
      const calculated = Math.floor((params.subtotalMinor * discount.value) / 100);
      discountAmountMinor = discount.maxDiscount
        ? Math.min(calculated, discount.maxDiscount)
        : calculated;
    } else if (discount.type === "fixed") {
      discountAmountMinor = Math.min(discount.value, params.subtotalMinor);
    } else if (discount.type === "free_shipping") {
      discountAmountMinor = params.shippingAmountMinor ?? 0;
    }

    return {
      valid: true,
      discount,
      discountAmountMinor,
    };
  }

  /**
   * Atomically increments discount usage within a transaction with usage limit guard
   */
  async incrementUsage(discountId: string, tx: DbExecutor = db): Promise<boolean> {
    const result = await (tx as typeof db)
      .update(schema.discounts)
      .set({
        usageCount: sql`${schema.discounts.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.discounts.id, discountId),
          sql`(${schema.discounts.usageLimit} IS NULL OR ${schema.discounts.usageCount} < ${schema.discounts.usageLimit})`,
        ),
      )
      .returning();

    return result.length > 0;
  }
}

export const discountService = new DiscountService();
