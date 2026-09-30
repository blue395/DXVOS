# Deploying DXV OS (Netlify + Supabase)

Netlify runs the app; Supabase provides the Postgres database. The app uses Supabase
**only as a database** (via Prisma) — not Supabase Auth, Storage or its client library.

Roughly 30 minutes, once. After that, every merge to `main` deploys automatically.

---

## 1. Supabase — create the database

1. **New project.** Region: **London (eu-west-2)** — keeps DXV's data in the UK.
   Set a strong database password and save it in your password manager.
2. **Turn off the Data API.** Project Settings → **Data API** → disable it.
   Supabase otherwise exposes tables over a public web API. (The app's migrations also
   enable Row Level Security on every table as a second lock — belt and braces.)
3. **Copy two connection strings.** Click **Connect** (top of the project page) →
   *Connection string* tab. Replace `[YOUR-PASSWORD]` in each with your DB password.
   - **Transaction pooler** (port **6543**) → this becomes `DATABASE_URL` — used by the running app.
   - **Session pooler** (port **5432**) → this becomes `DIRECT_URL` — used for migrations.

   Use the *pooler* strings, not "Direct connection": that one is IPv6-only and
   Netlify's build machines can't reach it.
4. **Don't set `DATABASE_CA_CERT` (yet).** The certificate under Database settings → SSL
   is for *direct* connections; the connection pooler (port 6543) presents a different chain,
   so supplying it makes every query fail with `self-signed certificate in certificate chain`.
   Without it, the connection is still encrypted, just not identity-verified. (Follow-up: find
   the pooler's CA chain so verification can be switched on.)

## 2. Netlify — create the site

1. **Add new site → Import an existing project → GitHub →** `blue395/DXVOS`.
   Branch to deploy: `main`. Leave build settings as detected — they come from `netlify.toml`.
2. **Before the first deploy**, add environment variables
   (Site configuration → **Environment variables**):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Transaction pooler string (port 6543) |
   | `DIRECT_URL` | Session pooler string (port 5432) |
   | `SESSION_SECRET` | 40+ random characters — e.g. generate a long password in your password manager. Never reuse it anywhere. |
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | A fixed key so pages left open across a deploy keep working (otherwise every deploy changes the IDs of all buttons/forms and open pages fail with "Server Action … was not found"). Must be **exactly 32 random bytes, base64-encoded** (44 characters ending in `=`): generate with `openssl rand -base64 32`. Scope: Builds and Functions. Never change it casually. On Windows, generate in PowerShell: `$b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)`. (`netlify.toml` tells the secrets scan to skip this key: Next.js keeps it in a server-only file.) |
   
3. **Turn off Deploy Previews for now.** Site configuration → Build & deploy →
   *Deploy Previews* → "Don't deploy pull requests". Previews would otherwise run
   unmerged code against the **production** database. (We can add a separate
   staging database later if you want previews.)
4. **(If your plan allows) Functions region → London.** Site configuration → Functions →
   Region → `eu-west-2`. Puts the app next to the database — faster, and data stays in the UK.
   On plans without this option, the app runs in the US and each page is a little slower.
5. **Deploy.** Production builds run `prisma migrate deploy` first (creating the tables),
   then build the app. Check the deploy log ends in success.

## 3. Create the admin logins

There's no sign-up page (by design), so create each admin directly in the database.
In Supabase → **SQL Editor**, run once per person, with their details:

```sql
insert into "User" (id, email, name, "passwordHash", role)
values (
  gen_random_uuid()::text,
  'name@diversityxventures.com',        -- lowercase
  'Full Name',
  extensions.crypt('A-LONG-STRONG-PASSWORD', extensions.gen_salt('bf', 12)),
  'ADMIN'
);
```

Postgres hashes the password (bcrypt) — only the hash is stored, and it never passes
through anyone else. **Afterwards, delete the query from the SQL Editor's history/saved
snippets**, since it contains the plain password. Share passwords with Anna and Kevin
via your password manager, not email.

Then open the Netlify URL (`https://<site-name>.netlify.app`) and sign in.

## 4. Custom domain — app.diversityxventures.com

1. Netlify → Domain management → **Add a domain** → `app.diversityxventures.com`.
   Netlify shows the DNS record it needs.
2. Squarespace → Domains → diversityxventures.com → **DNS settings** → add a record:
   **CNAME**, host `app`, value `<site-name>.netlify.app`.
3. Wait for DNS (minutes to a few hours). Netlify issues the HTTPS certificate automatically.

The brand site on the root domain is unaffected — only the `app.` subdomain points to Netlify.

## 5. AI deck reading & eligibility screen

Uploading a deck pre-fills the New Venture form and drafts the eligibility screen
(prompt in `src/lib/deck-ai/prompt.ts`, model Claude Sonnet 5). Needs four more
Netlify environment variables, then a redeploy.

1. **Anthropic API key.** At [console.anthropic.com](https://console.anthropic.com): create an
   account/organisation for DXV, add billing (Settings → Billing; set a monthly spend limit),
   then Settings → **API keys** → *Create key* named "DXV OS". Copy it once; it's shown only once.
2. **Supabase keys.** Supabase → Project Settings → **API Keys**:
   the **Publishable key** (`sb_publishable_…`) and a **Secret key** (`sb_secret_…`, create one
   named "dxv-os-server"). The project URL is on the project home page (`https://<ref>.supabase.co`).
3. **Netlify → Environment variables:**

   | Key | Value | Contains secret values? |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | the Anthropic key | ☑ Yes |
   | `SUPABASE_SECRET_KEY` | the Supabase **secret** key | ☑ Yes |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | ☐ **No** |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the Supabase **publishable** key | ☐ **No** |

   The two `NEXT_PUBLIC_` values are *meant* to be public (they're built into the browser
   code, which uploads decks straight to Supabase). Marking them secret makes the build fail.
4. **Merge and deploy.** The deploy's migration creates the private `decks` storage bucket
   (PDF only, 20 MB max). Check it exists under Supabase → **Storage**. If not, create it by
   hand: name `decks`, **Private**, file size limit 20 MB, allowed MIME type `application/pdf`.

How it runs: the browser uploads the PDF directly to Supabase with a one-time signed link;
a Netlify **background function** (`netlify/functions/analyze-deck-background.mts`, up to 15
minutes) reads it with Claude and saves the result; the page checks every few seconds.
A private copy of each deck is kept for re-running the screen (download it from the deal page).

**Local development without keys:** leave the Supabase variables unset (decks are saved in
`.data/decks/`) and run `DECK_AI_MOCK=true npm run dev` to get a canned AI result.

## 6. AI investment assessment

No new settings: it uses the same `ANTHROPIC_API_KEY` and the stored decks from §5. It runs in
a second background function, `analyze-memo-background` (logs under Netlify → Logs → Functions).

## 7. DXV Brain

Uses the same `ANTHROPIC_API_KEY`, with Claude Opus 5.5 and Anthropic's **web search** tool. Web search is on for
an Anthropic organisation unless an admin has turned it off: check at
https://platform.claude.com/settings/capabilities (Claude Console, Settings → Capabilities; admins only). If it's
off, every Brain question fails with a Claude API error (400), so keep it on. The same page can restrict which
domains it searches. Replies run in the
background function `brain-reply-background` (logs under Netlify → Logs → Functions). Web searches cost $10 per 1,000 searches, on
top of tokens.

## 8. Documents

No new settings. The deploy's migration creates a second private bucket, `documents` (PDF, Word,
Excel; 50 MB max). Check it exists under Supabase → Storage; if not, create it by hand with those
settings (Private). Storage use grows with every file: the free plan includes 1 GB, Pro 100 GB.
Stored files aren't included in Supabase's database backups.

## 9. Email: "Forgot password?" and sign-in links

The sign-in page offers **Forgot your password?** and **Email me a sign-in link** once email is set
up. DXV OS sends from DXV's Google Workspace account `angels@diversityx.vc` through Google's mail
server, using an *app password* (a separate password just for DXV OS, which you can revoke any time
without changing the account's own password). Until these settings exist, the links stay hidden and
the page says to ask the team for a reset link.

1. **Turn on 2-Step Verification** for `angels@diversityx.vc` (Google Account → Security). App
   passwords only exist on accounts with it. If the option is missing, a Workspace admin must allow
   it: Admin console → Security → Authentication → 2-Step Verification → *Allow users to turn on*.
2. **Create the app password:** signed in as `angels@diversityx.vc`, open
   <https://myaccount.google.com/apppasswords>, name it `DXV OS`, **Create**. Google shows a
   16-letter password once: copy it straight into Netlify (next step), never into chat or email.
   (If the page says app passwords aren't available, a Workspace admin has turned them off:
   Admin console → Security → *Less secure apps & app passwords*.)
3. **Netlify → Site configuration → Environment variables**, add:

   | Key | Value | Secret? |
   |---|---|---|
   | `SMTP_HOST` | `smtp.gmail.com` | |
   | `SMTP_PORT` | `465` | |
   | `SMTP_USER` | `angels@diversityx.vc` | |
   | `SMTP_PASS` | the 16-letter app password (spaces don't matter) | ☑ Yes |
   | `MAIL_FROM` | `DXV <angels@diversityx.vc>` | |
   | `APP_URL` | the address people use, e.g. `https://app.diversityxventures.com` (no trailing slash) | |

   `APP_URL` is the address put in emailed links. It's fixed on purpose, never taken from the
   request, so nobody can trick DXV OS into emailing a link to another website.
4. **Redeploy** (Deploys → Trigger deploy), then test: sign out → *Email me a sign-in link* → your
   own email. The email arrives from `angels@diversityx.vc`; replies go to that inbox.

Limits: Google Workspace sends up to about 2,000 emails a day per account, far above DXV's needs.
To move to a dedicated email service later (e.g. Resend, Postmark), change the five `SMTP_`/`MAIL_`
values to theirs: no code change.

## Day to day

- **Deploying:** merge a PR into `main` → Netlify builds, applies any new migrations, deploys.
- **Rolling back the app:** Netlify → Deploys → pick an earlier deploy → *Publish deploy*.
  (This doesn't undo database migrations — those only ever move forward.)
- **Backups:** Supabase takes daily backups (retention depends on plan).
- **Never** run `npm run db:seed` against production — it's sample data for development.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Build fails at `prisma migrate deploy` with `P1001 Can't reach database` | `DIRECT_URL` wrong or using the "Direct connection" (IPv6) string — use the Session pooler |
| Build fails with `prepared statement ... already exists` during migrate | `DIRECT_URL` is the Transaction pooler (6543) — it must be the Session pooler (5432) |
| Pages show "A server error occurred"; function log says `self-signed certificate in certificate chain` | `DATABASE_CA_CERT` is set — delete it and redeploy (see §1.4) |
| Sign-in always says "Incorrect email or password" | Email in the `User` row isn't lowercase, or role isn't `ADMIN` |
| Sign-in works then immediately logs out | `SESSION_SECRET` missing or shorter than 32 characters |
| "Server Action … was not found on the server" after a deploy | A page opened before the deploy. Reload it. If it happens on every deploy, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` isn't set (see above); the app also offers a Reload banner. |
| Deck upload says "Deck storage isn't configured" | `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` missing — add them and redeploy |
| Upload fails with "Bucket not found" | The `decks` bucket wasn't created — see §5.4 |
| Screen fails: "ANTHROPIC_API_KEY isn't set" | Add the key (§5.3) and redeploy |
| Sign-in page has no "Forgot your password?" link | Email isn't set up: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `APP_URL` (or Netlify's `URL`) are all needed (§9) |
| "We couldn't send the email just now" | Check the function log: `Invalid login` / `535` means the app password is wrong or was revoked (§9.2) |
| Screen fails: "Claude API error (401)" / "(403)" | Key wrong or revoked, or no billing set up on the Anthropic account |
| Screen stays "Reading…" then times out | Check Netlify → Logs → Functions → `analyze-deck-background` for the error |
| Build fails: secrets scanning found `NEXT_PUBLIC_SUPABASE_…` | It was marked secret — untick "Contains secret values" for the two `NEXT_PUBLIC_` variables |
