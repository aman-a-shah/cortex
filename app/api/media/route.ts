import { NextRequest, NextResponse } from "next/server";
import { uploadContextMedia, uploadAucctusVisual } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const { base64Data, department, contextId, type, productName } =
    await req.json();

  if (!base64Data) {
    return NextResponse.json({ error: "base64Data required" }, { status: 400 });
  }

  try {
    if (type === "aucctus" && productName) {
      const result = await uploadAucctusVisual(base64Data, productName);
      return NextResponse.json(result);
    }

    if (!department || !contextId) {
      return NextResponse.json(
        { error: "department and contextId required" },
        { status: 400 }
      );
    }

    const result = await uploadContextMedia(base64Data, department, contextId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cloudinary]", err);
    return NextResponse.json(
      { error: "upload failed" },
      { status: 500 }
    );
  }
}
