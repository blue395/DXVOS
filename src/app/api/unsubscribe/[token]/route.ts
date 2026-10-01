// One-click unsubscribe (RFC 8058): Gmail, Outlook and others POST here from their own
// "Unsubscribe" button, using the List-Unsubscribe header on bulk emails.
import { NextResponse, type NextRequest } from "next/server";
import { setEmailOptOut } from "@/lib/email-optout";
import { angelFromUnsubscribeToken } from "@/lib/unsubscribe";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const angelId = await angelFromUnsubscribeToken(token);
  if (!angelId || !(await setEmailOptOut(angelId, true, "One-click unsubscribe in their email app"))) {
    return NextResponse.json({ error: "Unknown link" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
