"use server";

// Public (no login): the founder application form. All checks live in
// src/lib/founder-submissions.ts; this file only passes the visitor's IP along.
import { clientIp } from "@/lib/client-ip";
import { headers } from "next/headers";
import { completeSubmission, startSubmission, type CompleteResult, type RawSubmission, type StartResult } from "@/lib/founder-submissions";

export async function startFounderSubmission(input: RawSubmission): Promise<StartResult> {
  const ip = clientIp(await headers());
  return startSubmission(input, ip);
}

export async function completeFounderSubmission(submissionId: string, completionToken: string): Promise<CompleteResult> {
  return completeSubmission(String(submissionId), String(completionToken));
}
