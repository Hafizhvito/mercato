import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/lib/logger";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  key: string;
  url: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export interface StorageService {
  uploadFile(
    fileBuffer: Buffer,
    options: { originalName: string; contentType: string },
  ): Promise<UploadResult>;
  getPresignedUploadUrl(options: {
    originalName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignedUploadResult>;
  deleteFile(key: string): Promise<void>;
}

/**
 * Validate image buffer header against known magic byte signatures
 */
export function validateFileSignature(buffer: Buffer, declaredMimeType: string): boolean {
  if (buffer.length < 8) return false;

  const hexHeader = buffer.subarray(0, 8).toString("hex").toLowerCase();

  switch (declaredMimeType) {
    case "image/jpeg":
      return hexHeader.startsWith("ffd8ff");
    case "image/png":
      return hexHeader.startsWith("89504e47");
    case "image/gif":
      return hexHeader.startsWith("47494638");
    case "image/webp":
      return (
        hexHeader.startsWith("52494646") && buffer.subarray(8, 12).toString("utf-8") === "WEBP"
      );
    case "image/avif":
      return buffer.length >= 12 && buffer.subarray(4, 12).toString("utf-8").includes("ftypavif");
    default:
      return false;
  }
}

/**
 * Extract safe file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

/**
 * Local filesystem storage adapter for local development
 */
export class LocalStorageService implements StorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    options: { originalName: string; contentType: string },
  ): Promise<UploadResult> {
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds maximum limit of 5MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(options.contentType as AllowedMimeType)) {
      throw new Error(`Unsupported MIME type: ${options.contentType}`);
    }

    if (!validateFileSignature(fileBuffer, options.contentType)) {
      throw new Error("File header does not match declared MIME signature");
    }

    const ext = getExtensionFromMimeType(options.contentType);
    const key = `${crypto.randomUUID()}.${ext}`;
    const destinationPath = path.join(this.uploadDir, key);

    await fs.promises.writeFile(destinationPath, fileBuffer);

    logger.info({ key }, "Saved upload to local filesystem");
    return {
      key,
      url: `/uploads/${key}`,
    };
  }

  async getPresignedUploadUrl(options: {
    originalName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignedUploadResult> {
    if (options.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds maximum limit of 5MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(options.contentType as AllowedMimeType)) {
      throw new Error(`Unsupported MIME type: ${options.contentType}`);
    }

    const ext = getExtensionFromMimeType(options.contentType);
    const key = `${crypto.randomUUID()}.${ext}`;

    // For local dev, direct upload endpoint handles standard multipart POST
    return {
      uploadUrl: `/api/upload?key=${key}`,
      publicUrl: `/uploads/${key}`,
      key,
    };
  }

  async deleteFile(key: string): Promise<void> {
    const sanitizedKey = path.basename(key);
    const filePath = path.join(this.uploadDir, sanitizedKey);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info({ key: sanitizedKey }, "Deleted file from local storage");
    }
  }
}

/**
 * Cloudflare R2 / AWS S3 compatible storage adapter
 */
export class S3StorageService implements StorageService {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  }) {
    this.bucket = config.bucketName;
    this.publicUrl = config.publicUrl.replace(/\/$/, "");

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async uploadFile(
    fileBuffer: Buffer,
    options: { originalName: string; contentType: string },
  ): Promise<UploadResult> {
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds maximum limit of 5MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(options.contentType as AllowedMimeType)) {
      throw new Error(`Unsupported MIME type: ${options.contentType}`);
    }

    if (!validateFileSignature(fileBuffer, options.contentType)) {
      throw new Error("File header does not match declared MIME signature");
    }

    const ext = getExtensionFromMimeType(options.contentType);
    const key = `products/${crypto.randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: options.contentType,
      }),
    );

    return {
      key,
      url: `${this.publicUrl}/${key}`,
    };
  }

  async getPresignedUploadUrl(options: {
    originalName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignedUploadResult> {
    if (options.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds maximum limit of 5MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(options.contentType as AllowedMimeType)) {
      throw new Error(`Unsupported MIME type: ${options.contentType}`);
    }

    const ext = getExtensionFromMimeType(options.contentType);
    const key = `products/${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 300,
    });

    return {
      uploadUrl,
      publicUrl: `${this.publicUrl}/${key}`,
      key,
    };
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    logger.info({ key }, "Deleted object from R2 storage");
  }
}

function initializeStorageService(): StorageService {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const isR2Configured =
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    bucketName &&
    publicUrl &&
    !accountId.includes("sample");

  if (isR2Configured) {
    return new S3StorageService({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
    });
  }

  return new LocalStorageService();
}

export const storageService = initializeStorageService();
