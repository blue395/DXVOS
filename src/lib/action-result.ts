// Shape every form-backed server action returns, so ActionForm can show errors inline.
export type ActionResult = { ok?: boolean; error?: string };
