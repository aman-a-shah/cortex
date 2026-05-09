// Cloudinary integration for rich media in context entries

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadContextMedia(
  base64Data: string,
  department: string,
  contextId: string
): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(base64Data, {
    folder: `cortex/${department}`,
    public_id: `ctx-${contextId}`,
    resource_type: "image",
    tags: ["cortex", department, "context"],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function uploadAucctusVisual(
  base64Data: string,
  productName: string
): Promise<{ url: string; publicId: string }> {
  const slug = productName.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  const result = await cloudinary.uploader.upload(base64Data, {
    folder: "cortex/aucctus",
    public_id: `proto-${slug}-${Date.now()}`,
    resource_type: "image",
    tags: ["cortex", "aucctus", "prototype"],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export { cloudinary };
