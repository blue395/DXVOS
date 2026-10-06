"use server";

// Public (no login): the founder application form. All checks live in
// src/lib/founder-submissions.ts; this file only passes the visitor's IP along.
import { headers } from "next/headers";
import { completeSubmission, startSubmission, type CompleteResult, type RawSubmission, type StartResult } from "@/lib/founder-submissions";

export async function startFounderSubmission(input: RawSubmission): Promise<StartResult> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return startSubmission(input, ip);
}

export async function completeFounderSubmission(submissionId: string, completionToken: string): Promise<CompleteResult> {
  return completeSubmission(String(submissionId), String(completionToken));
}
