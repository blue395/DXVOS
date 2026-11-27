// The member portal's menu: ONE list, used by the portal header and by the ribbon on the
// learning pages (/learn, a page of its own), so the two never drift apart (Blue, 2026-11-27).

export type PortalLink = { href: string; label: string; exact?: boolean; fullPage?: boolean };

export const PORTAL_LINKS: PortalLink[] = [
  { href: "/portal", label: "Home", exact: true },
  { href: "/portal/deals", label: "Deals" },
  { href: "/portal/portfolio", label: "My portfolio" },
  { href: "/learn", label: "Learning", fullPage: true }, // Angel Foundations course: every member gets it
  { href: "/portal/profile", label: "My profile" },
  { href: "/portal/help", label: "Help" },
];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The portal's green ribbon as plain HTML, for the top of the learning pages. Same links, same
 * look: the menu in the bar from laptop width, behind a burger below it (no script needed).
 */
export function portalRibbonHtml(opts: { name: string; partner: boolean; showLinks: boolean; active: string }) {
  const links = opts.showLinks ? PORTAL_LINKS : [];
  const link = (l: PortalLink, menu: boolean) =>
    `<a href="${l.href}" class="${menu ? "dxr-mlink" : "dxr-link"}${l.href === opts.active ? " on" : ""}"${l.href === opts.active ? ' aria-current="page"' : ""}>${esc(l.label)}</a>`;
  const partner = opts.partner ? `<a href="/" class="dxr-partner" title="Back to DXV OS">Partner View</a>` : "";
  const signOut = `<form method="post" action="/api/auth/sign-out" class="dxr-form"><button type="submit" class="dxr-out">Sign out</button></form>`;
  return `<style>
.dxr{background:#1a3c35;color:#fff;font-family:var(--font-ui);font-size:.875rem;position:relative;z-index:40}
.dxr-in{max-width:72rem;margin:0 auto;padding:.75rem max(16px,env(safe-area-inset-left,0px));display:flex;align-items:center;gap:1rem}
.dxr a{text-decoration:none;color:inherit}
.dxr-brand{display:flex;align-items:center;gap:.5rem;font-weight:600;font-size:1rem;flex-shrink:0}
.dxr-badge{background:#fbe45b;color:#1a3c35;border-radius:4px;padding:.1rem .4rem;font-size:.75rem;font-weight:700;letter-spacing:.1em}
.dxr-nav{display:none;align-items:center;gap:.25rem;flex:1;min-width:0}
.dxr-link{padding:.375rem .75rem;border-radius:4px;color:rgba(255,255,255,.85)!important;white-space:nowrap}
.dxr-link:hover{background:rgba(255,255,255,.1)}
.dxr-link.on,.dxr-mlink.on{background:#fbe45b;color:#1a3c35!important;font-weight:500}
.dxr-right{margin-left:auto;display:flex;align-items:center;gap:.75rem}
.dxr-partner{background:#fbe45b;color:#1a3c35!important;border-radius:4px;padding:.25rem .5rem;font-weight:500;white-space:nowrap}
.dxr-partner:hover{background:#fff}
.dxr-name{display:none;color:rgba(255,255,255,.7);white-space:nowrap}
.dxr-wide{display:none}
.dxr-form{margin:0}
.dxr-out{background:none;border:0;color:rgba(255,255,255,.8);padding:.25rem .5rem;border-radius:4px;cursor:pointer;font:inherit}
.dxr-out:hover{background:rgba(255,255,255,.1);color:#fff}
.dxr-menu summary{list-style:none;cursor:pointer;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:6px}
.dxr-menu summary::-webkit-details-marker{display:none}
.dxr-menu summary:hover{background:rgba(255,255,255,.1)}
.dxr-menu .x{display:none}.dxr-menu[open] .x{display:block}.dxr-menu[open] .b{display:none}
.dxr-panel{position:absolute;left:0;right:0;top:100%;background:#1a3c35;border-top:1px solid rgba(255,255,255,.1);padding:.5rem 16px 1rem;display:flex;flex-direction:column;gap:.25rem;box-shadow:0 12px 24px rgba(0,0,0,.25)}
.dxr-mlink{display:block;padding:.625rem .75rem;border-radius:6px;font-size:1rem;color:rgba(255,255,255,.85)!important}
.dxr-mlink:hover{background:rgba(255,255,255,.1)}
.dxr-panel hr{border:0;border-top:1px solid rgba(255,255,255,.15);margin:.5rem 0;width:100%}
.dxr-panel .dxr-out{font-size:1rem;padding:.625rem .75rem;text-align:left;width:100%}
.dxr-panel p{margin:0;padding:.25rem .75rem;color:rgba(255,255,255,.6)}
@media (min-width:1024px){.dxr-nav,.dxr-wide{display:flex}.dxr-menu{display:none}}
@media (min-width:1280px){.dxr-name{display:inline}}
</style>
<header class="dxr"><div class="dxr-in">
<a href="/portal" class="dxr-brand"><span class="dxr-badge">DXV</span><span>Members</span></a>
<nav class="dxr-nav" aria-label="Members">${links.map((l) => link(l, false)).join("")}</nav>
<div class="dxr-right">${partner}<span class="dxr-wide" style="align-items:center;gap:.75rem"><span class="dxr-name">${esc(opts.name)}</span>${signOut}</span>
<details class="dxr-menu"><summary aria-label="Menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><g class="b"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></g><g class="x"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></g></svg></summary>
<nav class="dxr-panel" aria-label="Main menu">${links.map((l) => link(l, true)).join("")}${links.length ? "<hr>" : ""}<p>Signed in as ${esc(opts.name)}</p>${signOut}</nav></details>
</div></div></header>`;
}
