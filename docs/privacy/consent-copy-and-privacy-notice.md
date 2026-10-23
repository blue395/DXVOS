# DXV OS: Consent copy and privacy notice

Oct 23, 2026 · @Blue

This is the member-facing wording for DXV OS: the consent screen, in-app notices and the full privacy notice. Items in \[square brackets\] need your details; have a solicitor review before publishing.

## Consent screen copy

Show this as its own step after account creation, separate from the terms and privacy notice. Nothing is pre-ticked, every question is optional, and joining and deal access are the same whatever the member chooses. Wording version: `diversity-consent-v1`.

**Heading:** Help us see who we're reaching (optional)

**Intro:**

Diversity X Ventures exists to widen who invests in impact startups. If you choose, you can tell us about yourself so we can see whether we're reaching the people we want to, and improve how we do it.

This is entirely your choice. Joining, deal access and how we treat you are exactly the same whether you answer or not. You can skip any question, change your answers or delete them at any time in your profile.

**How we use your answers:** only as combined statistics, in groups of at least 10 people, to report on our impact and to improve our programmes. We never show your individual answers to founders, other angels, funders or anyone outside a small named DXV team, and we never use them to decide anything about you.

**Questions** (each with "Prefer not to say" pre-selected as the default, not a blank):

| Question | Options |
| --- | --- |
| Do you have a disability, or are you neurodivergent? | Yes, disability · Yes, neurodivergent · Yes, both · No · Prefer not to say |
| How would you describe your sexual orientation? | \[list\] · Prefer to self-describe: \[free text\] · Prefer not to say |
| What is your ethnic group? | \[list\] · Prefer to self-describe: \[free text\] · Prefer not to say |
| What is your religion or belief? | \[list\] · None · Prefer not to say |
| How do you describe your gender? | \[list\] · Prefer to self-describe: \[free text\] · Prefer not to say |
| Background: did you go to a state school; are you the first in your family to go to university? | \[options\] · Prefer not to say |

If a free-text box is offered, add: "Please don't include anything that identifies another person."

**Consent checkboxes**, shown only for the categories the member has actually answered, one per category:

- [ ] I explicitly consent to Diversity X Ventures storing my answer about **disability or neurodivergence** (health information) and using it in combined statistics as described above.
- [ ] I explicitly consent to Diversity X Ventures storing my answer about **sexual orientation** and using it in combined statistics as described above.
- [ ] I explicitly consent to Diversity X Ventures storing my answer about **ethnic group** and using it in combined statistics as described above.
- [ ] I explicitly consent to Diversity X Ventures storing my answer about **religion or belief** and using it in combined statistics as described above.
- [ ] I agree to Diversity X Ventures storing my answers about **gender and background** and using them in combined statistics as described above.

**Below the boxes:**

You can withdraw consent at any time in **Profile > My diversity information**, and we'll delete these answers. Withdrawing doesn't affect anything we did before. Our \[privacy notice\] explains more, including who we are and your rights.

**Buttons:** Save my answers · Skip for now

**Rule for the build:** if a member picks an answer but does not tick the matching consent box, do not save that answer. Say "We haven't saved this answer because consent wasn't given. You can add it any time".

## Other in-app copy

| Where | Copy |
| --- | --- |
| Sign-up: age check | I confirm I am 18 or over. |
| Sign-up: terms and notice | By creating an account you agree to our \[terms\]. Read how we use your data in our \[privacy notice\]. (Link only: do not bundle consent for diversity data here.) |
| Sign-up: marketing emails | \[ \] Send me DXV news, deals and events by email. You can unsubscribe at any time. (Unticked. Only if you plan marketing beyond service emails.) |
| Profile: My diversity information, heading | Your answers are private. They are only used in combined statistics (groups of 10 or more) and are never shown to founders, angels or funders. |
| Profile: change an answer | Update your answer. We'll ask you to confirm consent again for the changed category. |
| Profile: withdraw consent | Remove my diversity information. This deletes your answers and stops us using them. It doesn't affect your membership. |
| Withdraw confirmation | Done. Your diversity answers have been deleted. They may remain in backups for up to \[30 days\], and combined statistics already published can't be traced to you. |
| Profile: download my data | Download everything we hold about you. |
| Profile: delete my account | Delete my account and all my data. |
| Footer | Privacy notice · Terms · Contact \[privacy email\] |
| Cookie note, if only essential cookies | We use only the cookies needed to keep you signed in. No tracking. (If you add analytics, replace with a proper consent banner with Accept and Reject as equal choices.) |

## Developer notes: recording consent

You must be able to show who agreed to what, when and under which wording. Store one row per category per member in a consent table, separate from the answers table.

| Field | Purpose |
| --- | --- |
| `member_id` | Random ID of the member |
| `category` | `health`, `sexual_orientation`, `ethnicity`, `religion`, `gender_background` |
| `status` | `given` or `withdrawn` |
| `wording_version` | For example `diversity-consent-v1`; keep each version's exact text in the repository |
| `given_at` / `withdrawn_at` | UTC timestamps |
| `method` | Sign-up screen, profile edit, or admin on request |

Rules for the build:

- Write the consent row and the answer in one transaction, so an answer can never exist without a consent row
- On withdrawal, delete the answer, set the consent row to `withdrawn` and stop any pending use in reports
- When the wording changes materially, bump the version and ask existing members to re-confirm; do not treat old consent as covering new purposes
- Do not record "Prefer not to say" as an answer; store nothing
- Keep consent rows out of analytics and logs
- Show members their own consent history in the profile

## Privacy notice

*Publish at a public URL and link it from sign-up and the footer. Last updated: \[date\]. Version: \[1\].*

### Who we are

Diversity X Ventures ("DXV", "we") is an angel syndicate that helps people invest in early-stage impact startups led by underestimated founders. The data controller for DXV OS is \[legal entity name\], \[registered number\], \[address\]. Our data protection lead is \[name\]; contact \[privacy email\].

### What this notice covers

How we handle personal data of members and prospective members who use DXV OS. We are the controller of that data.

### The data we collect and why

| Data | Where it comes from | What we use it for | Our legal basis |
| --- | --- | --- | --- |
| Name, email, sign-in details | You | Creating and running your account | Contract \[or legitimate interests: confirm\] |
| Membership and deal activity (deals viewed, expressions of interest, ticket sizes) | You | Running the syndicate, deal processes and communications | Contract \[or legitimate interests: confirm\] |
| Service emails | You | Telling you about deals, events and your account | Contract; for marketing, your consent or legitimate interests under email rules \[confirm\] |
| Security and audit logs (account ID, IP address, actions) | Generated by the platform | Keeping DXV OS secure and investigating problems | Legitimate interests (security) |
| **Optional diversity information** (disability or neurodivergence, sexual orientation, ethnicity, religion or belief, gender, background) | You, if you choose to answer | Producing combined statistics on who we reach, reporting on our impact and improving our programmes | **Your consent**, and your **explicit consent** for the special categories (health, sexual orientation, ethnicity, religion) |

### Your diversity information

- Answering is optional. Your membership and access are the same whether you answer or not.
- We use it only in combined statistics. We do not publish any figure for a group of fewer than 10 people.
- We do not show it to founders, other angels, funders or partners, and we do not use it to make decisions about you or to profile you.
- Only a small named group of DXV team members can see individual answers, and only when needed to run the platform or your requests.
- You can change or delete your answers at any time in your profile. Withdrawing consent doesn't affect anything lawful we did before.

### Who we share data with

We share data only with service providers that process it for us under contract: \[hosting (Netlify), sign-in (Google), database and authentication provider, email provider, and any others\]. We do not sell your data. We may disclose data where the law requires it. If we run a deal through an SPV, we will tell you what investor information is shared with the SPV and its advisers before you invest.

### Transfers outside the UK

&#91;Some of our providers may process data outside the UK. Where they do, we use safeguards approved for UK data, such as the UK addendum to standard contractual clauses, or an approved adequacy arrangement. Contact us for details.\]

### How long we keep your data

- Diversity answers: until you withdraw consent, leave, or \[12 months\] after you were last active
- Account and activity data: while you are a member, and up to \[6 years\] afterwards where we need it for records \[confirm\]
- Consent records: as long as the related data, plus \[6 years\] \[confirm\]
- Security logs: \[90 days\]
- Backups: roll off within \[30 days\]

### Your rights

You can ask us to give you a copy of your data, correct it, delete it, restrict or stop using it, or move it elsewhere. You can withdraw consent at any time. Most of this you can do yourself in your profile; otherwise email \[privacy email\]. We will reply within one month. Rights can have limits in some cases, and we will explain if we cannot do what you ask.

### How we protect your data

We keep diversity answers apart from the rest of your profile, restrict who can see them, use encryption, keep access logs, require multi-factor sign-in for the team, and have our systems independently tested. \[Adjust once confirmed.\]

### Automated decisions

We do not make decisions about you using automated processing or profiling, and we do not use your diversity information for that.

### Cookies

We use only the cookies needed to keep you signed in. \[Update if you add analytics.\]

### Children

DXV OS is for people aged 18 and over. We do not knowingly collect data from anyone younger.

### Complaints

If you are unhappy with how we handle your data, please tell us first at \[privacy email\]. You can also complain to the Information Commissioner's Office at ico.org.uk or on 0303 123 1113.

### Changes

If we change how we use your data, we will update this notice and tell you. If we want to use your diversity information for a new purpose, we will ask for your consent again first.
