import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadRateLimiter } from "@/lib/cache/ratelimit";
import {
  ALLOWED_MIME_TYPES,
  type AllowedMimeType,
  MAX_FILE_SIZE_BYTES,
  storageService,
  validateFileSignature,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (
      !session ||
      (session.user.role !== "admin" &&
        session.user.role !== "owner" &&
        session.user.role !== "staff")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await uploadRateLimiter.limit(`upload:${session.user.id}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Please wait a moment." },
        { status: 429 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 });
    }

    const contentType = file.type;
    if (!ALLOWED_MIME_TYPES.includes(contentType as AllowedMimeType)) {
      return NextResponse.json(
        { error: "Invalid image format. Allowed: JPEG, PNG, WEBP, GIF, AVIF" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!validateFileSignature(buffer, contentType)) {
      return NextResponse.json(
        { error: "File contents do not match declared image type" },
        { status: 400 },
      );
    }

    const uploadResult = await storageService.uploadFile(buffer, {
      originalName: file.name,
      contentType,
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      key: uploadResult.key,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
