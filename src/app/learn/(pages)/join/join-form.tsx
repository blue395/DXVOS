"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { COURSE_CONSENTS } from "@/content/course";
import { signUpForCourse } from "./actions";
import { learnLink } from "../card";

export function CourseJoinForm({ formToken }: { formToken: string }) {
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div role="status" className="rounded-lg border-2 border-[#fbe45b] p-4">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-sm">
          We&apos;ve sent you a link from angels@diversityx.vc. Open it to confirm your email and start the course. It may take a minute, and it&apos;s worth
          checking your spam folder.
        </p>
      </div>
    );
  return (
    <ActionForm action={signUpForCourse} resetOnSuccess={false} onSuccess={() => setSent(true)} className="space-y-4">
      <input type="hidden" name="formToken" value={formToken} />
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Your name">
        <input name="name" required maxLength={120} autoComplete="name" className={inputClass} />
      </Field>
      <Field label="Email address">
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="adult" required className="mt-1" />
        <span>{COURSE_CONSENTS.AGE.wording}</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="privacy" required className="mt-1" />
        <span>
          {COURSE_CONSENTS.PRIVACY_NOTICE.wording.replace(" course privacy notice.", " ")}
          <Link href="/learn/privacy" target="_blank" className={learnLink}>
            course privacy notice
          </Link>
          .
        </span>
      </label>
      <SubmitButton pendingLabel="Sending…" doneLabel="Sent">
        Email me a link to start
      </SubmitButton>
    </ActionForm>
  );
}
