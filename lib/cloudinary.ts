import { v2 as cloudinary } from "cloudinary";
<<<<<<< HEAD
import { logger } from "@/lib/logger";
=======
import type { UploadApiResponse } from "cloudinary";
import fs from "node:fs";
>>>>>>> 4bb561209135c2baebc0794bba7497e6a8b70e2f

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

<<<<<<< HEAD
type UploadResult = { url: string; publicId: string } | { error: string };
=======
export type CloudinaryInputKind =
  | "data URI"
  | "raw base64"
  | "file path"
  | "multipart file";

export type CloudinaryUploadResult = {
  success: true;
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
};

export type CloudinaryTransformation = "blur" | "grayscale" | "sharpen" | "resize";

export type CloudinaryTransformResult = CloudinaryUploadResult & {
  originalUrl: string;
  originalPublicId: string;
  detectedCloudName: string;
  transformedUrl: string;
  transformation: CloudinaryTransformation;
};

type UploadImageInput =
  | { kind?: "string"; value: string }
  | { kind: "multipart file"; value: Buffer };

const RAW_BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const IMAGE_PATH_RE = /\.(avif|gif|jpe?g|png|webp)$/i;
const CORTEX_FOLDER = "cortex";

function assertCloudinaryConfig() {
  const missing = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing Cloudinary environment variables: ${missing.join(", ")}`);
  }
}

function configuredCloudName(): string {
  assertCloudinaryConfig();
  return process.env.CLOUDINARY_CLOUD_NAME!;
}

function normalizeStringInput(value: string): {
  source: string;
  inputKind: CloudinaryInputKind;
} {
  const input = value.trim();

  if (input.startsWith("data:image/")) {
    return { source: input, inputKind: "data URI" };
  }

  if (
    input.length > 0 &&
    input.length % 4 === 0 &&
    RAW_BASE64_RE.test(input)
  ) {
    return {
      source: `data:image/png;base64,${input}`,
      inputKind: "raw base64",
    };
  }

  const looksLikePath =
    input.length < 1024 &&
    (/^[a-zA-Z]:[\\/]/.test(input) ||
      input.startsWith("./") ||
      input.startsWith("../") ||
      input.startsWith("/") ||
      input.startsWith("\\") ||
      IMAGE_PATH_RE.test(input));

  if (looksLikePath && fs.existsSync(input) && fs.statSync(input).isFile()) {
    return { source: input, inputKind: "file path" };
  }

  throw new Error("Unsupported image input. Expected data URI, raw base64, file path, or multipart file.");
}

function uploadBuffer(
  buffer: Buffer,
  options: Record<string, unknown>
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error("Cloudinary upload failed"));
        return;
      }

      resolve(result);
    });

    stream.end(buffer);
  });
}

function toUploadResult(result: UploadApiResponse): CloudinaryUploadResult {
  return {
    success: true,
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}

function extractCloudinaryImageId(imageUrl: string): {
  cloudName: string;
  publicId: string;
  format?: string;
} {
  const url = new URL(imageUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  const cloudName = parts[0];
  const resourceType = parts[1];
  const deliveryType = parts[2];

  if (!cloudName || resourceType !== "image" || !deliveryType) {
    throw new Error("Expected a Cloudinary image URL.");
  }

  const uploadIndex = parts.findIndex((part) => part === "upload");
  if (uploadIndex === -1) {
    throw new Error("Expected a Cloudinary upload URL.");
  }

  let publicPathParts = parts.slice(uploadIndex + 1);
  if (publicPathParts[0]?.startsWith("v") && /^v\d+$/.test(publicPathParts[0])) {
    publicPathParts = publicPathParts.slice(1);
  }

  if (publicPathParts.length === 0) {
    throw new Error("Cloudinary public ID could not be detected.");
  }

  const publicPath = publicPathParts.join("/");
  const lastDot = publicPath.lastIndexOf(".");
  const hasExtension = lastDot > publicPath.lastIndexOf("/");

  return {
    cloudName,
    publicId: hasExtension ? publicPath.slice(0, lastDot) : publicPath,
    format: hasExtension ? publicPath.slice(lastDot + 1) : undefined,
  };
}

function transformationOption(
  transformation: CloudinaryTransformation,
  options?: Record<string, unknown>
): Record<string, unknown> {
  switch (transformation) {
    case "blur":
      return { effect: "blur:1000" };
    case "grayscale":
      return { effect: "grayscale" };
    case "sharpen":
      return { effect: "sharpen" };
    case "resize": {
      const width = Number(options?.width ?? 800);
      const height = options?.height ? Number(options.height) : undefined;
      return {
        width: Number.isFinite(width) && width > 0 ? Math.round(width) : 800,
        ...(height && Number.isFinite(height) && height > 0
          ? { height: Math.round(height) }
          : {}),
        crop: typeof options?.crop === "string" ? options.crop : "limit",
      };
    }
  }
}

export async function uploadImageToCloudinary(
  input: UploadImageInput,
  options: {
    publicId: string;
    tags?: string[];
  }
): Promise<CloudinaryUploadResult & { inputKind: CloudinaryInputKind }> {
  assertCloudinaryConfig();

  const uploadOptions = {
    folder: CORTEX_FOLDER,
    public_id: options.publicId,
    resource_type: "image" as const,
    tags: options.tags ?? ["cortex"],
  };

  if (input.kind === "multipart file") {
    const result = await uploadBuffer(input.value, uploadOptions);
    return { ...toUploadResult(result), inputKind: "multipart file" };
  }

  const { source, inputKind } = normalizeStringInput(input.value);
  const result = await cloudinary.uploader.upload(source, uploadOptions);
  return { ...toUploadResult(result), inputKind };
}

export async function transformCloudinaryImage(
  imageUrl: string,
  transformation: CloudinaryTransformation,
  options?: Record<string, unknown>
): Promise<CloudinaryTransformResult> {
  const expectedCloudName = configuredCloudName();
  const { cloudName, publicId } = extractCloudinaryImageId(imageUrl);

  if (cloudName !== expectedCloudName) {
    throw new Error(
      `Image cloud name "${cloudName}" does not match configured CLOUDINARY_CLOUD_NAME "${expectedCloudName}".`
    );
  }

  const transformedUrl = cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    type: "upload",
    transformation: [transformationOption(transformation, options)],
  });

  const permanentPublicId = `${publicId.replace(/\//g, "-")}-${transformation}-${Date.now()}`;
  const saved = await cloudinary.uploader.upload(transformedUrl, {
    folder: CORTEX_FOLDER,
    public_id: permanentPublicId,
    resource_type: "image",
    tags: ["cortex", "transform", transformation],
  });

  return {
    ...toUploadResult(saved),
    originalUrl: imageUrl,
    originalPublicId: publicId,
    detectedCloudName: cloudName,
    transformedUrl,
    transformation,
  };
}
>>>>>>> 4bb561209135c2baebc0794bba7497e6a8b70e2f

export async function uploadContextMedia(
  imageInput: string | Buffer,
  department: string,
  contextId: string
<<<<<<< HEAD
): Promise<UploadResult> {
  if (!base64Data.trim()) return { error: "base64Data is empty" };
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: `cortex/${department}`,
      public_id: `ctx-${contextId}`,
      resource_type: "image",
      tags: ["cortex", department, "context"],
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    logger.error("cloudinary", "uploadContextMedia failed", err);
    return { error: err instanceof Error ? err.message : "upload failed" };
  }
=======
): Promise<CloudinaryUploadResult & { inputKind: CloudinaryInputKind }> {
  return uploadImageToCloudinary(
    Buffer.isBuffer(imageInput)
      ? { kind: "multipart file", value: imageInput }
      : { value: imageInput },
    {
      publicId: `ctx-${department}-${contextId}`,
      tags: ["cortex", department, "context"],
    }
  );
>>>>>>> 4bb561209135c2baebc0794bba7497e6a8b70e2f
}

export async function uploadAucctusVisual(
  imageInput: string | Buffer,
  productName: string
<<<<<<< HEAD
): Promise<UploadResult> {
  if (!base64Data.trim()) return { error: "base64Data is empty" };
  try {
    const slug = productName.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: "cortex/aucctus",
      public_id: `proto-${slug}-${Date.now()}`,
      resource_type: "image",
      tags: ["cortex", "aucctus", "prototype"],
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    logger.error("cloudinary", "uploadAucctusVisual failed", err);
    return { error: err instanceof Error ? err.message : "upload failed" };
  }
=======
): Promise<CloudinaryUploadResult & { inputKind: CloudinaryInputKind }> {
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return uploadImageToCloudinary(
    Buffer.isBuffer(imageInput)
      ? { kind: "multipart file", value: imageInput }
      : { value: imageInput },
    {
      publicId: `proto-${slug || "visual"}-${Date.now()}`,
      tags: ["cortex", "aucctus", "prototype"],
    }
  );
}

export function toCleanCloudinaryResponse(
  result: CloudinaryUploadResult
): CloudinaryUploadResult {
  return {
    success: true,
    url: result.url,
    publicId: result.publicId,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}

export function safeCloudinaryError(error: unknown): string {
  const redact = (message: string) =>
    message.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[data-uri]");

  if (error instanceof Error) {
    return redact(error.message);
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return redact(message);
  }

  return "Unknown Cloudinary upload error";
>>>>>>> 4bb561209135c2baebc0794bba7497e6a8b70e2f
}

export { cloudinary };
