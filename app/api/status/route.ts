import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    mockMode: process.env.USE_MOCK_VLM === "true",
  });
}
