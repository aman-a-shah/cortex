import { NextRequest, NextResponse } from "next/server";
import { uploadContextMedia, uploadAucctusVisual } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const { base64Data, department, contextId, type, productName } =
    await req.json();

  if (!base64Data) {
    return NextResponse.json({ error: "base64Data required" }, { status: 400 });
  }

  if (type === "aucctus" && productName) {
    const result = await uploadAucctusVisual(base64Data, productName);
    if ("error" in result) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
  }

  if (!department || !contextId) {
    return NextResponse.json({ error: "department and contextId required" }, { status: 400 });
  }

  const result = await uploadContextMedia(base64Data, department, contextId);
  if ("error" in result) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
