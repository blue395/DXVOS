"use server";

// Public: sign up to (or sign back in to) the Angel Foundations course. Always the same answer,
// whether or not we know the email, and padded to a fixed minimum time (no fishing for who has
// an account). Spam: hidden trap field, a signed "form shown at" stamp, limits per connection.

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/action-result";
import { clientIp } from "@/lib/client-ip";
import { courseSignUp } from "@/lib/course-learners";
import { JoinSchema, joinFormTime } from "@/lib/join-links";
import { formTimingOk } from "@/lib/founder-intake";
import { appOrigin, mailConfigured } from "@/lib/mail";

const MIN_REQUEST_MS = 1500;

export async function signUpForCourse(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const started = Date.now();
  try {
    const shownAt = joinFormTime(String(formData.get("formToken") ?? ""));
    if (formData.get("website") || shownAt === null || !formTimingOk(shownAt, Date.now())) return { error: "Please wait a moment and try again." };
    const parsed = JoinSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
    if (formData.get("adult") !== "on") return { error: "Please confirm you're 18 or over: the course is for adults only." };
    if (formData.get("privacy") !== "on") return { error: "Please read the course privacy notice and tick the box." };
    if (!mailConfigured() || !appOrigin()) return { error: "Sign-up isn't available just now. Please email angels@diversityx.vc." };
    await courseSignUp(parsed.data, clientIp(await headers()));
    return { ok: true };
  } catch (e) {
    console.error("Course sign-up failed", e instanceof Error ? e.name : "error");
    return { error: "We couldn't send the email just now. Please try again in a few minutes." };
  } finally {
    const wait = MIN_REQUEST_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
}
