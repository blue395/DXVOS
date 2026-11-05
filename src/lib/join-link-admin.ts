import "server-only";
// What Angels → Invite an angel shows for shareable sign-up links: the links (with the
// shareable address, since it can always be rebuilt) and the requests waiting for a partner.
import { db } from "./db";
import { joinLinkToken } from "./join-links";
import { joinLinkState } from "./pipeline";
import { linkOrigin } from "./send-link";

export async function loadJoinLinkAdmin() {
  const [links, pending, origin] = await Promise.all([
    db.memberJoinLink.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { createdBy: { select: { name: true } }, requests: { select: { status: true } } },
    }),
    db.memberJoinRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { confirmedAt: "asc" },
      include: { link: { select: { label: true } }, angel: { select: { id: true, name: true, status: true } } },
    }),
    linkOrigin(),
  ]);
  return {
    links: links.map((l) => {
      const n = (s: string[]) => l.requests.filter((r) => s.includes(r.status)).length;
      const used = n(["PENDING", "APPROVED", "DECLINED"]);
      return {
        id: l.id,
        label: l.label,
        url: `${origin}/join/open/${joinLinkToken(l.id)}`,
        state: joinLinkState(l, used),
        expiresAt: l.expiresAt,
        maxUses: l.maxUses,
        used,
        approved: n(["APPROVED"]),
        waiting: n(["PENDING"]),
        createdBy: l.createdBy.name,
      };
    }),
    pending,
  };
}
