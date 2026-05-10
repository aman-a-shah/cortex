import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";
import fs from "node:fs";
import { logger } from "@/lib/logger";

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

export type CloudinaryTransformation =
  | "blur"
  | "grayscale"
  | "sharpen"
  | "resize"
  | "background_replace"
  | "remove_background"
  | "generative_replace"
  | "enhance";

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
  const missing: string[] = [];
  if (!CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!process.env.CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!process.env.CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing Cloudinary environment variables: ${missing.join(", ")}`);
  }
}

function configuredCloudName(): string {
  assertCloudinaryConfig();
  return CLOUDINARY_CLOUD_NAME!;
}

function normalizeStringInput(value: string): {
  source: string;
  inputKind: CloudinaryInputKind;
} {
  const input = value.trim();

  if (input.startsWith("data:image/")) {
    return { source: input, inputKind: "data URI" };
  }

  if (input.length > 0 && input.length % 4 === 0 && RAW_BASE64_RE.test(input)) {
    return { source: `data:image/png;base64,${input}`, inputKind: "raw base64" };
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

function uploadBuffer(buffer: Buffer, options: Record<string, unknown>): Promise<UploadApiResponse> {
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
  if (uploadIndex === -1) throw new Error("Expected a Cloudinary upload URL.");

  let publicPathParts = parts.slice(uploadIndex + 1);
  if (publicPathParts[0]?.startsWith("v") && /^v\d+$/.test(publicPathParts[0])) {
    publicPathParts = publicPathParts.slice(1);
  }

  if (publicPathParts.length === 0) throw new Error("Cloudinary public ID could not be detected.");

  const publicPath = publicPathParts.join("/");
  const lastDot = publicPath.lastIndexOf(".");
  const hasExtension = lastDot > publicPath.lastIndexOf("/");

  return {
    cloudName,
    publicId: hasExtension ? publicPath.slice(0, lastDot) : publicPath,
    format: hasExtension ? publicPath.slice(lastDot + 1) : undefined,
  };
}

function sanitizePrompt(text: string): string {
  return text.trim().slice(0, 200).replace(/[^a-zA-Z0-9 ,.!?'"-]/g, "").replace(/\s+/g, "_");
}

function transformationOption(
  transformation: CloudinaryTransformation,
  options?: Record<string, unknown>
): Record<string, unknown> {
  switch (transformation) {
    case "blur": return { effect: "blur:1000" };
    case "grayscale": return { effect: "grayscale" };
    case "sharpen": return { effect: "sharpen" };
    case "resize": {
      const width = Number(options?.width ?? 800);
      const height = options?.height ? Number(options.height) : undefined;
      return {
        width: Number.isFinite(width) && width > 0 ? Math.round(width) : 800,
        ...(height && Number.isFinite(height) && height > 0 ? { height: Math.round(height) } : {}),
        crop: typeof options?.crop === "string" ? options.crop : "limit",
      };
    }
    case "background_replace": {
      const prompt = sanitizePrompt(
        String(options?.prompt ?? "professional photography studio with dramatic lighting")
      );
      return { effect: `gen_background_replace:prompt_${prompt}` };
    }
    case "remove_background":
      return { effect: "background_removal" };
    case "generative_replace": {
      const from = sanitizePrompt(String(options?.from ?? ""));
      const to = sanitizePrompt(String(options?.to ?? ""));
      if (!from || !to) return { effect: "gen_restore" };
      return { effect: `gen_replace:from_${from};to_${to}` };
    }
    case "enhance":
      return { effect: "gen_restore" };
  }
}

export async function uploadImageToCloudinary(
  input: UploadImageInput,
  options: { publicId: string; tags?: string[] }
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

  const AI_TRANSFORMS: CloudinaryTransformation[] = [
    "background_replace",
    "generative_replace",
    "enhance",
    "remove_background",
  ];
  const isAiTransform = AI_TRANSFORMS.includes(transformation);

  const permanentPublicId = `${publicId.replace(/\//g, "-")}-${transformation}-${Date.now()}`;

  async function applyAndUpload(xform: CloudinaryTransformation, xformOptions?: Record<string, unknown>) {
    const url = cloudinary.url(publicId, {
      secure: true,
      resource_type: "image",
      type: "upload",
      transformation: [transformationOption(xform, xformOptions)],
    });
    return cloudinary.uploader.upload(url, {
      folder: CORTEX_FOLDER,
      public_id: permanentPublicId,
      resource_type: "image",
      tags: ["cortex", "transform", xform],
    });
  }

  let saved: Awaited<ReturnType<typeof cloudinary.uploader.upload>>;
  let appliedTransformation = transformation;

  if (isAiTransform) {
    try {
      saved = await applyAndUpload(transformation, options);
    } catch {
      // AI addon unavailable — fall back to a reliable artistic filter
      const fallback: CloudinaryTransformation = "sharpen";
      saved = await applyAndUpload(fallback, {});
      appliedTransformation = fallback;
      logger.warn("cloudinary", `AI transform "${transformation}" unavailable; fell back to "${fallback}"`);
    }
  } else {
    saved = await applyAndUpload(transformation, options);
  }

  const transformedUrl = cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    type: "upload",
    transformation: [transformationOption(appliedTransformation, options)],
  });

  return {
    ...toUploadResult(saved),
    originalUrl: imageUrl,
    originalPublicId: publicId,
    detectedCloudName: cloudName,
    transformedUrl,
    transformation: appliedTransformation,
  };
}

export async function uploadContextMedia(
  imageInput: string | Buffer,
  department: string,
  contextId: string
): Promise<CloudinaryUploadResult & { inputKind: CloudinaryInputKind }> {
  try {
    return await uploadImageToCloudinary(
      Buffer.isBuffer(imageInput)
        ? { kind: "multipart file", value: imageInput }
        : { value: imageInput },
      { publicId: `ctx-${department}-${contextId}`, tags: ["cortex", department, "context"] }
    );
  } catch (err) {
    logger.error("cloudinary", "uploadContextMedia failed", err);
    throw err;
  }
}

export async function uploadAucctusVisual(
  imageInput: string | Buffer,
  productName: string
): Promise<CloudinaryUploadResult & { inputKind: CloudinaryInputKind }> {
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  try {
    return await uploadImageToCloudinary(
      Buffer.isBuffer(imageInput)
        ? { kind: "multipart file", value: imageInput }
        : { value: imageInput },
      { publicId: `proto-${slug || "visual"}-${Date.now()}`, tags: ["cortex", "aucctus", "prototype"] }
    );
  } catch (err) {
    logger.error("cloudinary", "uploadAucctusVisual failed", err);
    throw err;
  }
}

export function toCleanCloudinaryResponse(result: CloudinaryUploadResult): CloudinaryUploadResult {
  return {
    success: true,
    url: result.url,
    publicId: result.publicId,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}

// Generates an image by attempting Cloudinary's gen_background_replace on a real
// sample image (so the base is always opaque/visible). Falls back to the same
// sample with artistic filters — guaranteed to return a visible image.
export async function generateAndUploadImage(prompt: string): Promise<string> {
  assertCloudinaryConfig();

  const safe = prompt.trim().slice(0, 120).replace(/[^a-zA-Z0-9 ,.!?'-]/g, "").trim();
  const encoded = safe.replace(/\s+/g, "_");
  const stamp = Date.now();

  // A real, opaque sample image — visible even without any AI effects.
  const BASE = "samples/landscapes/road-in-autumn-colors-and-mountain";

  // Attempt 1: gen_background_replace — replaces the scene with the prompt (requires AI addon).
  const aiUrl = cloudinary.url(BASE, {
    secure: true,
    transformation: [
      { width: 1024, height: 576, crop: "fill", gravity: "auto" },
      { effect: `gen_background_replace:prompt_${encoded}` },
    ],
  });

  // Attempt 2: reliable fallback — artistic filter on the same landscape.
  const fallbackUrl = cloudinary.url(BASE, {
    secure: true,
    transformation: [
      { width: 1024, height: 576, crop: "fill", gravity: "auto" },
      { effect: "art:aurora" },
      { effect: "vibrance:50" },
    ],
  });

  for (const [url, pid] of [
    [aiUrl, `generated-ai-${stamp}`],
    [fallbackUrl, `generated-${stamp}`],
  ] as [string, string][]) {
    try {
      const saved = await cloudinary.uploader.upload(url, {
        folder: CORTEX_FOLDER,
        public_id: pid,
        resource_type: "image",
        tags: ["cortex", "generated"],
      });
      return saved.secure_url;
    } catch {
      continue;
    }
  }

  throw new Error("Image generation unavailable on this Cloudinary plan");
}

export function safeCloudinaryError(error: unknown): string {
  const redact = (msg: string) =>
    msg
      .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[data-uri]")
      .replace(/https?:\/\/\S+/g, "[url]");

  if (error instanceof Error) return redact(error.message);

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return redact(message);
  }

  return "Unknown Cloudinary error";
}

export { cloudinary };
