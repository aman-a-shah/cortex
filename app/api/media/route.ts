import { NextRequest, NextResponse } from "next/server";
import {
  safeCloudinaryError,
  toCleanCloudinaryResponse,
  uploadAucctusVisual,
  uploadContextMedia,
  type CloudinaryInputKind,
} from "@/lib/cloudinary";

type MediaUploadPayload = {
  imageInput: string | Buffer;
  inputKind: CloudinaryInputKind;
  department?: string;
  contextId?: string;
  type?: string;
  productName?: string;
};

const RAW_BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function classifyStringInput(value: string): CloudinaryInputKind {
  const input = value.trim();

  if (input.startsWith("data:image/")) return "data URI";
  if (input.length > 0 && input.length % 4 === 0 && RAW_BASE64_RE.test(input)) {
    return "raw base64";
  }

  return "file path";
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

async function parsePayload(req: NextRequest): Promise<MediaUploadPayload> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") ?? formData.get("image") ?? formData.get("media");
    const stringInput =
      getFormString(formData, "base64Data") ??
      getFormString(formData, "image") ??
      getFormString(formData, "filePath") ??
      getFormString(formData, "imagePath");

    if (file instanceof File && file.size > 0) {
      return {
        imageInput: Buffer.from(await file.arrayBuffer()),
        inputKind: "multipart file",
        department: getFormString(formData, "department"),
        contextId: getFormString(formData, "contextId"),
        type: getFormString(formData, "type"),
        productName: getFormString(formData, "productName"),
      };
    }

    if (stringInput) {
      return {
        imageInput: stringInput,
        inputKind: classifyStringInput(stringInput),
        department: getFormString(formData, "department"),
        contextId: getFormString(formData, "contextId"),
        type: getFormString(formData, "type"),
        productName: getFormString(formData, "productName"),
      };
    }
  }

  const body = await req.json();
  const imageInput =
    body.base64Data ?? body.image ?? body.imageData ?? body.filePath ?? body.imagePath;

  return {
    imageInput,
    inputKind: typeof imageInput === "string" ? classifyStringInput(imageInput) : "data URI",
    department: body.department,
    contextId: body.contextId,
    type: body.type,
    productName: body.productName,
  };
}

export async function POST(req: NextRequest) {
  let payload: MediaUploadPayload;

  try {
    payload = await parsePayload(req);
  } catch (err) {
    console.error("[cloudinary] failed to parse upload request", safeCloudinaryError(err));
    return NextResponse.json(
      { success: false, error: "invalid upload request" },
      { status: 400 }
    );
  }

  const { imageInput, inputKind, department, contextId, type, productName } = payload;

  if (!imageInput) {
    return NextResponse.json(
      { success: false, error: "image input required" },
      { status: 400 }
    );
  }

<<<<<<< HEAD
  if (type === "aucctus" && productName) {
    const result = await uploadAucctusVisual(base64Data, productName);
    if ("error" in result) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
=======
  try {
    console.log(`[cloudinary] uploading image input kind: ${inputKind}`);

    if (type === "aucctus" && productName) {
      const result = await uploadAucctusVisual(imageInput, productName);
      console.log(`[cloudinary] upload complete from ${result.inputKind}`);
      return NextResponse.json(toCleanCloudinaryResponse(result));
    }

    if (!department || !contextId) {
      return NextResponse.json(
        { success: false, error: "department and contextId required" },
        { status: 400 }
      );
    }

    const result = await uploadContextMedia(imageInput, department, contextId);
    console.log(`[cloudinary] upload complete from ${result.inputKind}`);
    return NextResponse.json(toCleanCloudinaryResponse(result));
  } catch (err) {
    console.error(
      `[cloudinary] upload failed for input kind: ${inputKind}`,
      safeCloudinaryError(err)
    );
    return NextResponse.json(
      { success: false, error: "upload failed" },
      { status: 500 }
    );
>>>>>>> 4bb561209135c2baebc0794bba7497e6a8b70e2f
  }

  if (!department || !contextId) {
    return NextResponse.json({ error: "department and contextId required" }, { status: 400 });
  }

  const result = await uploadContextMedia(base64Data, department, contextId);
  if ("error" in result) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
