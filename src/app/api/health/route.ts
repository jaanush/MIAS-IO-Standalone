import { NextResponse } from "next/server";
import { isDeployPending } from "../deploy/notify/route";

export async function GET() {
  const deploy = isDeployPending();
  return NextResponse.json({
    status: "ok",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    ...(deploy.deployPending ? { deployPending: true, deployMessage: deploy.deployMessage } : {}),
  });
}
