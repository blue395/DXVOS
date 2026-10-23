# DXV OS: Data protection launch pack

Oct 23, 2026 · @Blue

This pack covers what DXV needs in place before real angels enter diversity data into DXV OS. Items in \[square brackets\] are for you to confirm. It is a working draft for your sign-off, not legal advice.

## Launch checklist

Do not let real members enter diversity data until every box in sections A to C is ticked. Section D can follow within 30 days of launch.

**A. Legal basis and transparency (blockers)**

- [ ] Controller entity confirmed and named everywhere (see Decisions)
- [ ] Purposes for diversity data written down and signed off (see Data use rules)
- [ ] DPIA completed and signed off by the controller (see DPIA)
- [ ] Privacy notice published at a public URL and linked from sign-up and the footer
- [ ] Explicit consent screen live: separate from T&Cs, nothing pre-ticked, every diversity field optional with "Prefer not to say"
- [ ] Consent records stored per member: what they agreed to, when, and which wording version
- [ ] Withdraw-consent control in the member's profile, as easy as giving consent
- [ ] 18+ confirmation at sign-up

**B. Security (blockers)**

- [ ] Diversity data stored separately from the main profile with tighter access
- [ ] Row-level security tested: a member can read only their own row; no cross-member reads
- [ ] Admin access limited to named people, with MFA enforced
- [ ] Encryption in transit and at rest confirmed with each provider
- [ ] No diversity data in logs, analytics, error trackers, email notifications or AI prompts
- [ ] Dev and test use synthetic data only
- [ ] Independent security review or penetration test of the live build, with high findings fixed
- [ ] Backups configured and restore tested; backups covered by the retention rules

**C. Contracts and records (blockers)**

- [ ] Data processing agreement in place with every processor (see Processor register)
- [ ] International transfers checked and a UK transfer mechanism recorded where needed
- [ ] ROPA completed (see Records of processing)
- [ ] Retention schedule approved and deletion jobs built or scheduled (see Retention)
- [ ] ICO data protection fee paid or exemption confirmed for the controller entity
- [ ] Rights request procedure and breach plan agreed, with named owners

**D. Within 30 days of launch**

- [ ] Test a full access request and an erasure request end to end
- [ ] Run a breach tabletop exercise using the plan below
- [ ] Review the first aggregate diversity report against the small-number rule
- [ ] Diary an annual review of the DPIA, ROPA, retention and processor list
- [ ] Check the effect of the Data (Use and Access) Act 2025 changes on the notice and procedures

## Decisions only you can make

The documents below carry these as placeholders. Settle them first, because they change the wording of the notice, the DPIA and the contracts.

| # | Decision | Why it matters | Your answer |
| --- | --- | --- | --- |
| 1 | Which legal entity is the data controller (DXV, Impact Co.Lab, or another)? Is it a CIC, Ltd, or unincorporated? | Names the controller in the notice, fixes who pays the ICO fee, signs processor contracts and is accountable | \[ \] |
| 2 | Who is the named data protection lead, and what is the contact email? | Required contact point in the notice and for rights requests | \[ \] |
| 3 | What stack holds the data (database, auth, email, hosting)? | Drives the processor register, transfer checks and the security review | \[ \] |
| 4 | What exact diversity fields will you collect at launch? | Minimisation: drop any field with no defined use | \[ \] |
| 5 | What will the data be used for? (aggregate impact reporting, tender evidence, programme design) | Purposes must be specific and stated before collection | \[ \] |
| 6 | Will anyone outside DXV ever see individual-level diversity answers? | Recommended answer: no. If yes, it needs its own consent wording | \[ \] |
| 7 | How long do you keep data after someone leaves? | Sets the retention schedule | \[ \] |
| 8 | Will any AI feature process member data? | It must be listed as a processor and covered by the DPIA | \[ \] |
| 9 | Will you take investor KYC or certification data in DXV OS? | Adds FCA and anti-money-laundering questions and possibly criminal-record data, which this pack does not cover | \[ \] |
| 10 | Will you use any analytics or non-essential cookies? | Needs a cookie consent banner under PECR | \[ \] |

## Data use rules

Diversity answers are used only in aggregate, and no individual answer leaves the small group of named people with access. These rules should be adopted by DXV and enforced in the build.

**Permitted**

- Aggregate reporting on the make-up of the angel community, for impact reports, funders and tenders
- Designing education and outreach, for example finding which groups are under-represented
- Counting and statistics inside DXV OS admin, with no individual drill-down

**Not permitted**

- Showing any member's answers to founders, other angels, funders or partners
- Deciding who can join, who sees a deal or who is invited to anything based on these answers
- Automated profiling or scoring using these answers
- Combining them with outside data to infer anything further about a person
- Using them for marketing, or sharing them with anyone outside DXV or its processors

**Small-number rule for reports**

With around 50 members, a group like "disabled and LGBTQ+" may be one or two people, so a statistic can identify someone.

- Never publish a figure for a group of fewer than 10 people; report it as "fewer than 10" or merge it into a wider category
- Do not publish two overlapping breakdowns that let a small group be found by subtraction
- Report single characteristics, not cross-tabs, unless every cell has 10 or more people
- Have a second named person check every external report before release
- Re-check the threshold as membership grows; revisit it if the community is smaller than 100

## Data protection impact assessment (DPIA)

Result: the processing is justifiable if diversity data is optional, consent-based, kept separate and used only in aggregate. Residual risk is medium until the security review is done, then low. Special category data triggers a DPIA, so this must be signed off before launch.

**1. Description of the processing**

- **Controller:** \[entity name and registered number\]
- **What:** DXV OS is an online platform where angels sign up, take part in deals and learning, and may volunteer information about diversity and personal characteristics.
- **Data subjects:** adult angel investors (members), and DXV team users.
- **Data collected:** identity and contact details, sign-in credentials via Google or email, membership and activity records, and optional diversity data: \[list fields, for example disability or neurodiversity, sexual orientation, ethnicity, religion, gender identity, socioeconomic background, school type, first-generation university status\].
- **Special category data:** health (disability, neurodiversity), sexual orientation, ethnicity and religion where collected. Gender identity and socioeconomic indicators are treated with the same care.
- **Source:** supplied directly by the member through the sign-up form or profile.
- **Recipients:** named DXV admins; processors listed in the Processor register. No founders, other angels or funders see individual answers.
- **Scale:** around \[50 to 200\] members at launch, so small-group re-identification is the main risk.

**2. Lawful basis and necessity**

- **Article 6 basis:** consent (6(1)(a)).
- **Article 9 condition:** explicit consent (9(2)(a)), given separately for each category of special category data.
- **Why this data:** DXV's mission is to widen who invests in impact startups; aggregate evidence of who it reaches is how DXV shows and improves that.
- **Less intrusive alternative considered:** an anonymous survey with no link to the member account. This is the lowest-risk option; \[adopt it, or record why account-linked data is needed, for example to track change over time\].
- **Proportionality:** every field is optional and carries no effect on membership; only fields with a stated use are collected.

**3. Risks and mitigations**

| Risk | Likelihood | Severity | Mitigation | Residual |
| --- | --- | --- | --- | --- |
| Unauthorised access to diversity data (account takeover, misconfigured access rules) | Medium | High | Separate table, row-level security, MFA for admins, audit logs, penetration test | Low |
| Re-identification through small groups in reports | High | High | Small-number rule of 10, no cross-tabs, second-person check | Low |
| Consent not valid (bundled, unclear, pressured) | Medium | High | Separate screen, optional fields, "Prefer not to say", named categories, recorded wording version | Low |
| Data used for a new purpose or shared outside DXV | Medium | High | Written use rules, no individual disclosure, change needs a fresh DPIA and consent | Low |
| Data leaks through logs, analytics, emails or AI tools | Medium | High | Exclude fields from logs and prompts, no real data in dev or test, processor review | Low |
| Data kept too long, or not erased when consent is withdrawn | Medium | Medium | Retention schedule, deletion on withdrawal, backup expiry | Low |
| Provider outside the UK without safeguards | Low | Medium | Processor register, DPAs, transfer mechanism recorded | Low |
| Member cannot exercise rights | Medium | Medium | Self-service download, edit and delete; rights procedure with owner and one-month deadline | Low |
| Harm if a breach exposes sexual orientation, health or ethnicity | Low | Very high | Breach plan, minimised data, encryption, prompt notification of affected members | Medium |

**4. Consultation**

- [ ] Ask a sample of members for feedback on the consent wording before launch
- [ ] Take advice from a data protection solicitor or a qualified adviser on this DPIA
- [ ] Consult the ICO before processing if a high residual risk remains after these measures

**5. Sign-off**

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Data protection lead | \[name\] | \[approve or reject\] | \[date\] |
| Controller representative | \[name\] | \[approve or reject\] | \[date\] |
| Security reviewer | \[name\] | \[confirm review done\] | \[date\] |

Review this DPIA every 12 months, and whenever fields, purposes, processors or the stack change.

## Records of processing (ROPA)

This is the record you must keep because you handle special category data. Controller: \[entity name, address, contact\]. Data protection lead: \[name, email\].

| Activity | Data subjects | Personal data | Special category? | Article 6 basis | Article 9 condition | Recipients | Transfers outside UK | Retention |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Account and membership | Angels | Name, email, sign-in method, profile | No | Contract or legitimate interests \[confirm\] | n/a | DXV admins, hosting and auth providers | \[per processor\] | Life of membership plus \[x\] |
| Deal access and activity | Angels | Deals viewed, interest shown, EOI, ticket sizes | No | Contract or legitimate interests \[confirm\] | n/a | DXV admins | \[per processor\] | Life of membership plus \[x\] |
| Voluntary diversity data | Angels | \[list fields\] | Yes: health, sexual orientation, ethnicity, religion; others treated as sensitive | Consent | Explicit consent | Named DXV admins only; aggregate outputs only | \[per processor\] | Until consent is withdrawn or membership ends, plus \[x\] |
| Consent records | Angels | Consent choices, timestamps, wording version | No | Legal obligation (accountability) | n/a | DXV admins | \[per processor\] | Life of the related data plus \[6 years\] \[confirm\] |
| Service emails | Angels | Name, email | No | Contract; marketing via consent or soft opt-in \[confirm\] | n/a | Email provider | \[per processor\] | Until unsubscribed or membership ends |
| Security logs and audit trail | Angels, team | Account ID, IP, actions, timestamps | No | Legitimate interests (security) | n/a | Hosting and logging providers | \[per processor\] | \[90 days\] |
| Rights requests and breaches | Angels, team | Requester details, request and response records | Possibly | Legal obligation | Legal claims where relevant \[confirm\] | DXV data protection lead | None expected | \[3 years after closure\] \[confirm\] |

## Retention schedule

The periods are proposed defaults to confirm, not legal minimums. The principle: keep nothing longer than you can justify, and make deletion automatic.

| Data | Keep for | Deletion trigger | How |
| --- | --- | --- | --- |
| Diversity data | While consent stands and the member is active | Consent withdrawn, member leaves, or \[12 months\] after last activity | Delete the row; aggregate figures already published stay, as they are anonymous |
| Account and profile data | Life of membership | Member leaves or asks for erasure | Delete the account; keep a minimal suppression record so they are not re-added |
| Deal activity and EOIs | Life of membership plus \[6 years\] | End of period | Delete or anonymise. Check whether investment records need a longer period for tax or SPV purposes |
| Consent records | Life of the related data plus \[6 years\] | End of period | Delete |
| Marketing preferences | Until unsubscribed | Unsubscribe or erasure | Keep the suppression entry only |
| Security and audit logs | \[90 days\] | Rolling | Automatic log expiry |
| Rights requests | \[3 years\] after closure | End of period | Delete |
| Backups | \[30 days\] rolling | Rolling | Backups expire naturally; do not restore deleted data without re-deleting it |
| Inactive members | \[24 months\] with no activity | Warning email, then deletion | Scheduled job |

## Processor and sub-processor register

Every provider that touches member data needs a written data processing agreement before launch. Only Netlify and Google sign-in are visible from the public login page; add the rest from your stack.

| Provider | Role | Data touched | Includes diversity data? | Data location | DPA signed | Transfer mechanism | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Netlify | Hosting | App traffic, possibly logs | \[confirm: it should not\] | \[region\] | \[ \] | \[ \] | \[name\] |
| Google | Sign-in (OAuth) | Email, name | No | \[region\] | \[ \] | \[ \] | \[name\] |
| \[Database and auth provider\] | Storage, authentication | All member data | Yes | \[region\] | \[ \] | \[ \] | \[name\] |
| \[Email provider\] | Service emails | Name, email | No | \[region\] | \[ \] | \[ \] | \[name\] |
| \[Analytics, if any\] | Usage stats | \[data\] | No | \[region\] | \[ \] | \[ \] | \[name\] |
| \[Error tracking, if any\] | Debugging | Request data | Must not | \[region\] | \[ \] | \[ \] | \[name\] |
| \[AI provider, if any\] | Assistance features | \[data\] | Must not, unless covered by the DPIA | \[region\] | \[ \] | \[ \] | \[name\] |

For each row, confirm: encryption at rest and in transit, sub-processor list, breach notification terms, deletion on termination, and (if outside the UK) the transfer mechanism, such as the UK addendum to standard clauses or a UK-approved adequacy arrangement.

## Security checklist for the build

Use this as the brief for your build and for the independent reviewer. Each line should end up evidenced: a test, a setting or a screenshot.

**Access control**

- [ ] Roles defined: member, team, admin. A member can read and edit only their own records
- [ ] Diversity data in its own table or schema, linked by a random ID, readable only by the owner and a narrow admin role
- [ ] Row-level security enabled on every table that holds personal data, with automated tests that try cross-member reads and fail
- [ ] No service key or admin credential in front-end code; secrets held in environment settings, never in the repository
- [ ] MFA on every admin and team account, and on the hosting, database and Google accounts
- [ ] Admin actions that read diversity data are logged with who, when and why

**Data handling**

- [ ] TLS everywhere, with HTTPS forced; encryption at rest confirmed with the database provider
- [ ] Consider field-level encryption for the diversity fields
- [ ] Diversity fields excluded from logs, analytics, error reports, emails, URLs and query strings
- [ ] Exports and reports built from aggregate queries only, enforcing the small-number rule in code
- [ ] Synthetic data only in dev, test and demos; no production data copied down
- [ ] Any AI feature sees no diversity data unless the DPIA covers it and a DPA is signed

**Application**

- [ ] Input validation and output escaping; protection against injection and cross-site scripting
- [ ] Rate limiting and lockout on sign-in; password reset and magic-link flows checked for account takeover
- [ ] Session expiry and secure cookie flags set; no sensitive data in local storage
- [ ] Dependencies scanned and updated; known vulnerabilities fixed before launch
- [ ] Security headers set (content security policy, frame protection, and similar)
- [ ] Deployment previews and branch builds cannot reach production data

**Resilience and assurance**

- [ ] Automated backups, restore tested, with an expiry that fits the retention schedule
- [ ] Independent penetration test or security review of the live build; high and critical issues fixed and retested
- [ ] Monitoring and alerts for unusual sign-ins and large data reads
- [ ] Leavers' access removed the same day

## Individual rights procedure

Members can ask for their data, a correction, erasure, restriction, a copy to take elsewhere, or to withdraw consent, or can object to processing. The default deadline is one month from receipt; complex requests can be extended, so check the current rules as the Data (Use and Access) Act 2025 changes some details. Owner: \[data protection lead\].

1. **Receive.** Requests can arrive by the in-app controls, by email to \[privacy email\], or verbally. Log every one in the rights register the day it arrives, with the date received.
2. **Verify.** Confirm the requester is the member, using their signed-in account or a check against details you already hold. Ask for no more identity evidence than needed.
3. **Scope.** Search the database, backups, email and any shared drives. Include diversity data and consent records.
4. **Decide and act.**
   - Access or portability: export the member's data in a common format, excluding other people's data.
   - Correction: fix it and tell any recipient who received the wrong data.
   - Erasure: delete from live systems and processors; backups expire per the retention schedule.
   - Withdrawal of consent: stop use of the diversity data at once and delete it; membership continues unaffected.
   - Objection or restriction: pause the processing in question while you assess.
5. **Respond.** Reply within one month, say what you did, and explain any refusal and the right to complain to the ICO.
6. **Record.** Close the register entry with the date, action and outcome.

**Build requirements for DXV OS**

- [ ] Self-service export of a member's own data
- [ ] Self-service edit and delete for the diversity fields
- [ ] One-click withdraw-consent control that deletes the diversity data and logs the withdrawal
- [ ] A rights register: request ID, type, date received, due date, owner, outcome, date closed

## Personal data breach response plan

A breach is any loss, leak, alteration or unauthorised access to personal data, including by a processor or a mistake. The clock starts when DXV becomes aware: report to the ICO within 72 hours unless the breach is unlikely to risk people's rights and freedoms. If the risk is high, tell the affected members without undue delay. Exposure of sexual orientation, health or ethnicity data should be treated as high risk. Breach lead: \[name\], deputy: \[name\].

| Stage | Target | Actions |
| --- | --- | --- |
| 1. Detect and report | Immediately | Anyone who suspects a breach tells the breach lead at once, using \[channel\]. Do not delete evidence |
| 2. Contain | Within hours | Revoke access and keys, disable the affected feature, pull the affected provider into the response |
| 3. Assess | Within 24 hours | What data, whose, how many, how sensitive, whether encrypted, whether it is still exposed. Record the risk rating and reasoning |
| 4. Notify the ICO | Within 72 hours of awareness | If risk is likely: report through the ICO's online breach form with what happened, categories and numbers affected, likely consequences, and measures taken. Phase the report if details are still emerging |
| 5. Notify members | Without undue delay | If risk is high: tell each person in plain words what happened, what data, what risk, what you have done, what they can do, and who to contact |
| 6. Recover | Days | Fix the cause, restore from clean backups, confirm the fix with the security reviewer |
| 7. Review | Within 30 days | Lessons learned, update the DPIA, ROPA and security checklist |

Keep an internal breach log for every incident, including ones you decide not to report, with the facts, effects, actions and the reasoning for the reporting decision.
