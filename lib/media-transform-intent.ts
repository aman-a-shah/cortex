import type { CloudinaryTransformation } from "@/lib/cloudinary";

export type MediaTransformIntent = {
  imageUrl: string;
  transformation: CloudinaryTransformation;
  options?: Record<string, unknown>;
};

const CLOUDINARY_IMAGE_URL_RE =
  /https:\/\/res\.cloudinary\.com\/[^\s)\]]+\/image\/upload\/[^\s)\]]+/i;

function detectTransformation(message: string): CloudinaryTransformation | null {
  const lower = message.toLowerCase();

  if (/\bblur\b|\bblurry\b|\bblurred\b/.test(lower)) return "blur";
  if (/\bgrayscale\b|\bgrey\s*scale\b|\bgray\s*scale\b|\bblack and white\b/.test(lower)) {
    return "grayscale";
  }
  if (/\bsharpen\b|\bsharper\b/.test(lower)) return "sharpen";
  if (/\bresize\b|\bscale\b|\bmake (it|this) (smaller|larger)\b/.test(lower)) {
    return "resize";
  }

  return null;
}

function cleanUrl(url: string): string {
  return url.replace(/[,.!?;:]+$/, "");
}

function resizeOptions(message: string): Record<string, unknown> | undefined {
  const size = message.match(/\b(\d{2,5})\s*x\s*(\d{2,5})\b/i);
  if (size) {
    return { width: Number(size[1]), height: Number(size[2]) };
  }

  const width = message.match(/\b(?:width|wide|to)\s*(\d{2,5})\s*(?:px)?\b/i);
  return width ? { width: Number(width[1]) } : undefined;
}

export function detectMediaTransformIntent(
  message: string
): MediaTransformIntent | null {
  const transformation = detectTransformation(message);
  if (!transformation) return null;

  const urlMatch = message.match(CLOUDINARY_IMAGE_URL_RE);
  if (!urlMatch) return null;

  return {
    imageUrl: cleanUrl(urlMatch[0]),
    transformation,
    ...(transformation === "resize" ? { options: resizeOptions(message) } : {}),
  };
}
