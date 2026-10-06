"use server";

// Server actions for the Angels area (spec §8). Every action checks requireAdmin()
// itself. Certifications and notes are append-only; angels are archived, never deleted.
// Older free-text votes link to angels through confirmed aliases (AngelAlias), so the
// votes themselves are never edited.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAngelRecord } from "@/lib/angel-erasure";
import { z } from "zod";
import { AngelStatus, CertificationType } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUploadTargetIn, objectExists, objectPath, type UploadTarget } from "@/lib/deck-storage";
import { checkUpload, DOCUMENTS_BUCKET } from "@/lib/documents";
import { certificationExpiry, deleteConfirmed, normaliseAngelName, parseList } from "@/lib/pipeline";
import type { ImportRow } from "@/lib/angel-import";
import type { ActionResult } from "@/lib/action-result";

const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

const AngelSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional()
    .refine((s) => !s || z.email().safeParse(s).success, "Email isn't valid"),
  phone: optionalText,
  linkedinUrl: optionalText.refine((s) => !s || /^https?:\/\//.test(s), "LinkedIn links must start with https://"),
  location: optionalText,
  bio: optionalText,
  status: z.enum(AngelStatus),
  sectors: z.string().optional(),
  tags: z.string().optional(),
  whatsappGroups: z.string().optional(),
  source: optionalText,
  joinedAt: z
    .string()
    .trim()
    .transform((s) => (s ? new Date(`${s}T12:00:00Z`) : null))
    .nullable()
    .optional(),
});

function angelData(formData: FormData) {
  const parsed = AngelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    } as const;
  const { sectors, tags, whatsappGroups, ...rest } = parsed.data;
  return {
    data: {
      ...rest,
      sectors: parseList(sectors),
      tags: parseList(tags),
      whatsappGroups: parseList(whatsappGroups),
    },
  } as const;
}

async function emailTaken(email: string | null | undefined, exceptId?: string) {
  if (!email) return false;
  const other = await db.angel.findUnique({
    where: { email },
    select: { id: true },
  });
  return !!other && other.id !== exceptId;
}

function revalidateAngels(id?: string) {
  revalidatePath("/angels");
  if (id) revalidatePath(`/angels/${id}`);
  revalidatePath("/");
}

export async function createAngel(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const r = angelData(formData);
  if ("error" in r) return { error: r.error };
  if (await emailTaken(r.data.email)) return { error: "An angel with that email already exists." };
  const angel = await db.angel.create({
    data: {
      ...r.data,
      joinedAt: r.data.joinedAt ?? (r.data.status === "MEMBER" ? new Date() : null),
      createdById: user.id,
    },
  });
  revalidateAngels();
  redirect(`/angels/${angel.id}`);
}

export async function updateAngel(angelId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const r = angelData(formData);
  if ("error" in r) return { error: r.error };
  if (await emailTaken(r.data.email, angelId)) return { error: "Another angel already has that email." };
  const current = await db.angel.findUnique({
    where: { id: angelId },
    select: { joinedAt: true, email: true, user: { select: { id: true, role: true } } },
  });
  if (!current) return { error: "Angel not found." };
  // Their email is also their portal login: keep the two in step. (A partner's team login
  // is linked to their angel record but keeps its own login email.)
  const loginEmailChange = current.user?.role === "ANGEL" && r.data.email !== current.email;
  if (loginEmailChange) {
    if (!r.data.email) return { error: "They have a portal login, so they need an email." };
    const other = await db.user.findUnique({ where: { email: r.data.email }, select: { id: true } });
    if (other && other.id !== current.user!.id) return { error: "That email is already someone else's login." };
  }
  await db.$transaction([
    db.angel.update({
      where: { id: angelId },
      data: {
        ...r.data,
        // Becoming a member for the first time stamps the join date (unless one was given).
        joinedAt: r.data.joinedAt ?? current.joinedAt ?? (r.data.status === "MEMBER" ? new Date() : null),
        updatedById: user.id,
      },
    }),
    ...(loginEmailChange
      ? [
          db.user.update({ where: { id: current.user!.id }, data: { email: r.data.email! } }),
          db.angelEvent.create({ data: { angelId, kind: "login-email-changed", detail: `${current.email} to ${r.data.email}`, actorId: user.id } }),
        ]
      : []),
  ]);
  revalidateAngels(angelId);
  return { ok: true };
}

/** Hide an angel (a duplicate or a mistake). Nothing is deleted; restore brings it back. */
export async function setAngelArchived(angelId: string, archived: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  await db.$transaction([
    db.angel.update({
      where: { id: angelId },
      data: { archivedAt: archived ? new Date() : null, updatedById: user.id },
    }),
    // Their member login is signed out, and restoring never revives an old session.
    db.user.updateMany({ where: { angelId, role: "ANGEL" }, data: { sessionVersion: { increment: 1 } } }),
  ]);
  revalidateAngels(angelId);
  return { ok: true };
}

export async function addAngelNote(angelId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a note first." };
  if (body.length > 5000) return { error: "That note is too long." };
  await db.angelNote.create({ data: { angelId, body, authorId: user.id } });
  revalidatePath(`/angels/${angelId}`);
  return { ok: true };
}

// ── Certification ───────────────────────────────────────────────────────────

const UploadSchema = z.object({
  angelId: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int(),
});

export type CertUploadResult = { error: string } | { storagePath: string; mimeType: string; target: UploadTarget };

/** Where the browser uploads a signed statement (before the certification is recorded). */
export async function startCertificationUpload(input: z.input<typeof UploadSchema>): Promise<CertUploadResult> {
  await requireAdmin();
  const parsed = UploadSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid file." };
  const check = checkUpload(parsed.data.fileName, parsed.data.fileSize);
  if ("error" in check) return { error: check.error };
  if (
    !(await db.angel.findUnique({
      where: { id: parsed.data.angelId },
      select: { id: true },
    }))
  )
    return { error: "Angel not found." };
  const storagePath = `angels/${parsed.data.angelId}/${objectPath(randomUUID(), parsed.data.fileName)}`;
  try {
    const target = await createUploadTargetIn(DOCUMENTS_BUCKET, storagePath, `/api/dev/angel-upload?path=${encodeURIComponent(storagePath)}`);
    return { storagePath, mimeType: check.mimeType, target };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Couldn't prepare the upload.",
    };
  }
}

const CertSchema = z.object({
  type: z.enum(CertificationType, { message: "Choose the statement type" }),
  signedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date it was signed"),
  note: optionalText,
  storagePath: optionalText,
  fileName: optionalText,
  sizeBytes: z.coerce.number().int().optional(),
});

export async function recordCertification(angelId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = CertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { type, note, storagePath, fileName, sizeBytes } = parsed.data;
  const signedOn = new Date(`${parsed.data.signedOn}T12:00:00Z`);
  if (signedOn.getTime() > Date.now() + 86_400_000) return { error: "The signed date can't be in the future." };

  let file = {};
  if (storagePath) {
    // Only a file uploaded for this angel, which really arrived.
    const check = fileName ? checkUpload(fileName, sizeBytes ?? 0) : { error: "Missing file name." };
    if (!storagePath.startsWith(`angels/${angelId}/`) || "error" in check) return { error: "That file can't be attached." };
    if (!(await objectExists(DOCUMENTS_BUCKET, storagePath))) return { error: "The file didn't finish uploading. Try again." };
    file = {
      bucket: DOCUMENTS_BUCKET,
      storagePath,
      fileName,
      mimeType: check.mimeType,
      sizeBytes,
    };
  }

  await db.angelCertification.create({
    data: {
      angelId,
      type,
      signedOn,
      expiresOn: certificationExpiry(type, signedOn),
      note,
      recordedById: user.id,
      ...file,
    },
  });
  revalidateAngels(angelId);
  return { ok: true };
}

// ── Linking older votes (aliases) ───────────────────────────────────────────

export async function confirmAngelAlias(typedName: string, angelId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const normalized = normaliseAngelName(typedName);
  if (!normalized) return { error: "No name to link." };
  if (
    !(await db.angel.findUnique({
      where: { id: angelId },
      select: { id: true },
    }))
  )
    return { error: "Choose an angel." };
  await db.angelAlias.upsert({
    where: { normalized },
    create: { normalized, angelId, confirmedById: user.id },
    update: { angelId, confirmedById: user.id },
  });
  revalidateAngels(angelId);
  revalidatePath("/angels/link");
  return { ok: true };
}

export async function removeAngelAlias(aliasId: string): Promise<ActionResult> {
  await requireAdmin();
  const alias = await db.angelAlias.findUnique({ where: { id: aliasId } });
  if (!alias) return { ok: true };
  await db.angelAlias.delete({ where: { id: aliasId } }); // a link, not a record: fixing a wrong match
  revalidateAngels(alias.angelId);
  revalidatePath("/angels/link");
  return { ok: true };
}

// ── CSV import ──────────────────────────────────────────────────────────────

export type ImportResult =
  | { error: string }
  | {
      created: number;
      updated: number;
      certifications: number;
      skipped: number;
    };

/**
 * Import mapped CSV rows (up to 500 per call; the page sends batches). Matches existing
 * angels by email (else by exact name, when only one angel has it); fills in blank
 * fields and adds sectors, never overwriting what's there. A certification type +
 * signed date adds a certification unless that exact one is already recorded.
 */
export async function importAngels(rows: ImportRow[], defaultStatus: AngelStatus): Promise<ImportResult> {
  const user = await requireAdmin();
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > 500) return { error: "Import at most 500 rows at a time." };
  if (!Object.values(AngelStatus).includes(defaultStatus)) return { error: "Choose a status." };

  // Few round trips (each costs ~80ms in production): read everything once, then write in bulk.
  const existing = await db.angel.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      linkedinUrl: true,
      location: true,
      bio: true,
      source: true,
      sectors: true,
    },
  });
  type Existing = (typeof existing)[number];
  const byEmail = new Map(existing.filter((a) => a.email).map((a) => [a.email!, a]));
  const byName = Map.groupBy(existing, (a) => normaliseAngelName(a.name));

  let skipped = 0;
  const toCreate: ImportRow[] = [];
  const updates = new Map<string, { angel: Existing; rows: ImportRow[] }>();
  const seenNew = new Set<string>(); // the same person twice in one file
  for (const raw of rows) {
    const row = sanitise(raw);
    if (!row) {
      skipped++;
      continue;
    }
    const sameName = byName.get(normaliseAngelName(row.name));
    const match = (row.email ? byEmail.get(row.email) : undefined) ?? (!row.email && sameName?.length === 1 ? sameName[0] : undefined);
    if (match) {
      const u = updates.get(match.id) ?? { angel: match, rows: [] };
      u.rows.push(row);
      updates.set(match.id, u);
      continue;
    }
    const key = row.email ?? `name:${normaliseAngelName(row.name)}`;
    if (seenNew.has(key)) {
      skipped++;
      continue;
    }
    seenNew.add(key);
    toCreate.push(row);
  }

  // Ids assigned here so each new angel pairs with its row (for certifications below).
  const created = toCreate.map(() => ({ id: randomUUID() }));
  if (toCreate.length) {
    await db.angel.createMany({
      data: toCreate.map((row, i) => {
        const status = row.status ?? defaultStatus;
        return {
          id: created[i].id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          linkedinUrl: row.linkedinUrl,
          location: row.location,
          bio: row.bio,
          source: row.source,
          sectors: parseList(row.sectors),
          status,
          joinedAt: status === "MEMBER" ? (row.joinedAt ? new Date(row.joinedAt) : new Date()) : null,
          createdById: user.id,
        };
      }),
    });
  }

  // Existing angels: fill in blanks and add sectors, only where something changes.
  const writes = [];
  for (const { angel: a, rows: rs } of updates.values()) {
    const first = <K extends keyof ImportRow>(k: K) => rs.find((r) => r[k])?.[k] ?? null;
    const sectors = parseList([...a.sectors, ...rs.flatMap((r) => parseList(r.sectors))].join(","));
    const data = {
      phone: a.phone ?? first("phone"),
      linkedinUrl: a.linkedinUrl ?? first("linkedinUrl"),
      location: a.location ?? first("location"),
      bio: a.bio ?? first("bio"),
      source: a.source ?? first("source"),
      sectors,
    };
    const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) => JSON.stringify(data[k]) !== JSON.stringify(a[k]));
    if (changed)
      writes.push(
        db.angel.update({
          where: { id: a.id },
          data: { ...data, updatedById: user.id },
        }),
      );
  }
  if (writes.length) await db.$transaction(writes);

  // Certifications: the row's type + signed date, unless that exact one is already recorded.
  const withCert = [
    ...toCreate.map((row, i) => ({ angelId: created[i].id, row })),
    ...[...updates.values()].flatMap(({ angel, rows: rs }) => rs.map((row) => ({ angelId: angel.id, row }))),
  ].filter(({ row }) => row.certType && row.certSignedOn && new Date(row.certSignedOn).getTime() <= Date.now() + 86_400_000);
  const have = withCert.length
    ? await db.angelCertification.findMany({
        where: { angelId: { in: withCert.map((c) => c.angelId) } },
        select: { angelId: true, type: true, signedOn: true },
      })
    : [];
  const key = (angelId: string, type: string, signedOn: Date) => `${angelId}|${type}|${signedOn.toISOString()}`;
  const known = new Set(have.map((c) => key(c.angelId, c.type, c.signedOn)));
  const certs = [];
  for (const { angelId, row } of withCert) {
    const signedOn = new Date(row.certSignedOn!);
    const k = key(angelId, row.certType!, signedOn);
    if (known.has(k)) continue;
    known.add(k);
    certs.push({
      angelId,
      type: row.certType!,
      signedOn,
      expiresOn: certificationExpiry(row.certType!, signedOn),
      note: "Imported from CSV",
      recordedById: user.id,
    });
  }
  if (certs.length) await db.angelCertification.createMany({ data: certs });

  revalidateAngels();
  return {
    created: created.length,
    updated: updates.size,
    certifications: certs.length,
    skipped,
  };
}

const clip = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Rows come from the browser: re-check every value. */
function sanitise(r: ImportRow): ImportRow | null {
  const name = clip(r?.name, 120);
  if (!name) return null;
  const email = clip(r.email, 200)?.toLowerCase() ?? null;
  const signed = r.certSignedOn ? new Date(r.certSignedOn) : null;
  const joined = r.joinedAt ? new Date(r.joinedAt) : null;
  return {
    name,
    email: email && z.email().safeParse(email).success ? email : null,
    phone: clip(r.phone, 60),
    linkedinUrl: clip(r.linkedinUrl, 300)?.match(/^https?:\/\//) ? clip(r.linkedinUrl, 300) : null,
    location: clip(r.location, 120),
    sectors: clip(r.sectors, 500),
    source: clip(r.source, 200),
    status: r.status && Object.values(AngelStatus).includes(r.status) ? r.status : null,
    certType: r.certType && Object.values(CertificationType).includes(r.certType) ? r.certType : null,
    certSignedOn: signed && !isNaN(signed.getTime()) ? signed.toISOString() : null,
    joinedAt: joined && !isNaN(joined.getTime()) && joined.getTime() <= Date.now() + 86_400_000 ? joined.toISOString() : null,
    bio: clip(r.bio, 5000),
  };
}

/** Confirm several suggested links at once (the "Link all suggested" button). */
export async function confirmAngelAliases(pairs: { typedName: string; angelId: string }[]): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!Array.isArray(pairs) || !pairs.length || pairs.length > 500) return { error: "Nothing to link." };
  const ids = new Set((await db.angel.findMany({ where: { id: { in: pairs.map((p) => p.angelId) } }, select: { id: true } })).map((a) => a.id));
  const writes = pairs
    .map((p) => ({ normalized: normaliseAngelName(String(p.typedName ?? "")), angelId: p.angelId }))
    .filter((p) => p.normalized && ids.has(p.angelId))
    .map((p) =>
      db.angelAlias.upsert({
        where: { normalized: p.normalized },
        create: { ...p, confirmedById: user.id },
        update: { angelId: p.angelId, confirmedById: user.id },
      }),
    );
  await db.$transaction(writes);
  revalidateAngels();
  revalidatePath("/angels/link");
  return { ok: true };
}

/**
 * Delete an angel (Blue: smart delete). No history: removed outright. With history: their
 * personal details are erased and deal records kept. The name must be typed to confirm.
 */
export async function deleteAngel(angelId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const angel = await db.angel.findUnique({ where: { id: angelId }, select: { name: true } });
  if (!angel) return { error: "Angel not found." };
  if (!deleteConfirmed(angel.name, String(formData.get("confirm") ?? ""))) return { error: `To confirm, type their name exactly: ${angel.name}` };
  const r = await deleteAngelRecord(angelId, me);
  if ("error" in r) return { error: r.error };
  revalidateAngels(angelId);
  redirect(`/angels?deleted=${r.mode}`);
}
