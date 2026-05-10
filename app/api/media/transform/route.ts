import { NextRequest, NextResponse } from "next/server";
import {
  safeCloudinaryError,
  transformCloudinaryImage,
  type CloudinaryTransformation,
} from "@/lib/cloudinary";

const TRANSFORMATIONS = new Set<CloudinaryTransformation>([
  "blur",
  "grayscale",
  "sharpen",
  "resize",
]);

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, transformation, options } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { success: false, error: "imageUrl required" },
        { status: 400 }
      );
    }

    if (!TRANSFORMATIONS.has(transformation)) {
      return NextResponse.json(
        { success: false, error: "unsupported transformation" },
        { status: 400 }
      );
    }

    const result = await transformCloudinaryImage(
      imageUrl,
      transformation,
      options && typeof options === "object" ? options : undefined
    );

    console.log(
      `[cloudinary:transform] originalImageUrl=${imageUrl} detectedCloudName=${result.detectedCloudName} publicId=${result.originalPublicId} transformation=${transformation} finalTransformedUrl=${result.url}`
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[cloudinary:transform] failed", safeCloudinaryError(err));
    return NextResponse.json(
      { success: false, error: safeCloudinaryError(err) },
      { status: 400 }
    );
  }
}
