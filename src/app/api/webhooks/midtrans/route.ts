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

    const body = await req.json();
    const result = await paymentService.handleWebhook("midtrans", body, headersObj);

    return NextResponse.json({ status: "success", result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Midtrans webhook error";
    return NextResponse.json({ status: "error", message }, { status: 400 });
  }
}
