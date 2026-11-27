"use client";

import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { COURSE_CONSENTS } from "@/content/course";
import { changeSyndicateContact, deleteMyCourseData, signOutOfCourse } from "../actions";

export function SyndicateContactForm({ given }: { given: boolean }) {
  return (
    <ActionForm action={changeSyndicateContact} resetOnSuccess={false} className="space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="syndicateContact" defaultChecked={given} className="mt-1" />
        <span>{COURSE_CONSENTS.SYNDICATE_CONTACT.wording}</span>
      </label>
      <SubmitButton variant="secondary">Save</SubmitButton>
    </ActionForm>
  );
}

export function DeleteCourseDataForm({ learnerOnly }: { learnerOnly: boolean }) {
  return (
    <ActionForm action={deleteMyCourseData} resetOnSuccess={false} className="space-y-3">
      <label className="block text-sm">
        Type <strong>DELETE</strong> to confirm
        <input name="confirm" autoComplete="off" required className={`${inputClass} mt-1 max-w-xs`} />
      </label>
      <SubmitButton variant="secondary" pendingLabel="Deleting…" doneLabel="Deleted">
        {learnerOnly ? "Delete my account and course data" : "Delete my course data"}
      </SubmitButton>
    </ActionForm>
  );
}

export function CourseSignOut() {
  return (
    <ActionButton run={signOutOfCourse} variant="secondary" pendingLabel="Signing out…">
      Sign out
    </ActionButton>
  );
}
