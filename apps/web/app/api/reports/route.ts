import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const reports = await prisma.labReport.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedFile: {
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
            createdAt: true,
          },
        },
        extractedResults: {
          select: {
            id: true,
            testName: true,
            resultValue: true,
            unit: true,
            referenceRange: true,
            flag: true,
            confidence: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error("Fetch reports error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message.includes("connect") ? "Database connection error." : message, reports: [] },
      { status: 500 }
    );
  }
}
