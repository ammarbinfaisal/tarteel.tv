import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getIngestConfig() {
  const endpoint = process.env.INGEST_ENDPOINT || process.env.NEXT_PUBLIC_INGEST_ENDPOINT || "http://localhost:3001/ingest";
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  return { endpoint, adminUser, adminPass };
}

export async function POST(request: Request) {
  try {
    const { endpoint, adminUser, adminPass } = getIngestConfig();
    if (!adminUser || !adminPass) {
      return NextResponse.json(
        { success: false, error: "Admin credentials are not configured on the server." },
        { status: 500 },
      );
    }

    const payload = await request.formData();
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString("base64");
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: payload,
    });

    let result: unknown;
    try {
      result = await upstream.json();
    } catch {
      result = { success: false, error: "Ingest service returned non-JSON response." };
    }

    return NextResponse.json(result, { status: upstream.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest request failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
