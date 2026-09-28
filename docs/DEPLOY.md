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
4. **(Recommended) Download the SSL certificate.** Project Settings → **Database** →
   *SSL Configuration* → **Download certificate**. Open the file in a text editor —
   you'll paste its contents into Netlify as `DATABASE_CA_CERT`. With it, the app verifies
   it's really talking to Supabase; without it, the connection is still encrypted but not verified.

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
   | `DATABASE_CA_CERT` | *(recommended)* the full contents of the certificate file, including the `-----BEGIN/END CERTIFICATE-----` lines |

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
| Pages error with `self-signed certificate in certificate chain` | `DATABASE_CA_CERT` is incomplete/wrong — re-paste the whole file, or remove the variable |
| Sign-in always says "Incorrect email or password" | Email in the `User` row isn't lowercase, or role isn't `ADMIN` |
| Sign-in works then immediately logs out | `SESSION_SECRET` missing or shorter than 32 characters |
