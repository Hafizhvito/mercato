import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { paymentService } from "@/modules/payments/service";

export async function POST(req: Request) {
  try {
    const rawHeaders = await headers();
    const headersObj: Record<string, string> = {};
    rawHeaders.forEach((val, key) => {
      headersObj[key.toLowerCase()] = val;
    });

    const rawBody = await req.text();
    let body = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Keep empty if unparseable
    }

    const result = await paymentService.handleWebhook("stripe", body, headersObj, rawBody);
    return NextResponse.json({ received: true, result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
