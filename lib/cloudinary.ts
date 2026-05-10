import { v2 as cloudinary } from "cloudinary";
import { logger } from "@/lib/logger";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type UploadResult = { url: string; publicId: string } | { error: string };

export async function uploadContextMedia(
  base64Data: string,
  department: string,
  contextId: string
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
}

export async function uploadAucctusVisual(
  base64Data: string,
  productName: string
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
}

export { cloudinary };
