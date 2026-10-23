import "server-only";
// TEAM_GOOGLE_DOMAINS (Netlify setting): when set, team logins sign in only with Google on
// those Workspace domains (2-step verification enforced by Google). See teamSignInRefusal().
import { parseDomains, teamSignInRefusal } from "./pipeline";

export const teamGoogleDomains = () => parseDomains(process.env.TEAM_GOOGLE_DOMAINS);
export const teamRefusal = (role: string, method: "password" | "link" | "provider", provider?: { name: "GOOGLE" | "MICROSOFT"; hostedDomain: string | null }) =>
  teamSignInRefusal(role, method, teamGoogleDomains(), provider);
