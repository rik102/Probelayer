import { NextResponse } from "next/server";
import { runSimulation, type SimulationRequest } from "@/lib/simulation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SimulationRequest> & {
      targetUrl?: string;
    };

    const targetUrl = body.targetUrl?.trim();
    if (!targetUrl) {
      return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
    }

    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http and https URLs are supported" }, { status: 400 });
    }

    const result = await runSimulation({
      targetUrl: parsed.toString(),
      scenario: body.scenario ?? "balanced",
      personas: body.personas ?? [],
      dialSettings: body.dialSettings
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Simulation failed" },
      { status: 500 }
    );
  }
}

