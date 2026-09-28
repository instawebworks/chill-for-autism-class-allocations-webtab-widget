# Chill for Autism  —  Class Allocations widget

Handoff written **4 Aug 2026**, end of the first working session.
Read this top to bottom before touching anything; several things here are
counter-intuitive and cost hours to discover.

---

## 1. What this is

A Zoho CRM **web tab widget** (React) for allocating students to classes at
Chill for Autism. It renders the weekly programme schedule as a board and lists
students still waiting for a place.

Live at CRM → **Class Allocations** tab (`/tab/WebTab3`), which points at the
local dev server during development.

---

## 2. Two standing project rules

**Rule 1 — Always give a developer time estimate.**
Every time code is created or changed, state how long a competent developer
working solo would need to do the same work, including thinking and debugging —
not how long the assistant took. Unprompted, every time. Applies to code only,
not to research or conversation.

**Rule 2 — The UI bar is high.**
"Very good UI everywhere", stated explicitly and scoped to the whole widget.
Work from the design tokens, support real loading/empty/error states, respect
`prefers-reduced-motion`, and match the existing system rather than inventing a
parallel style. Restraint over decoration.

---

## 3. Getting running

```bash
npm install
npm run dev          # http://localhost:3000  (strictPort — must be 3000)
npm run build        # sanity check; also proves no dev-only code leaked
```

**Opening http://localhost:3000 directly shows a loading skeleton forever.
That is correct behaviour, not a bug** — see §5.

To see the widget work, open it inside CRM: the Class Allocations tab is
configured to load `http://localhost:3000`.

`?loading=1` on the URL pins the skeleton for review (dev only).

### MCP

`.mcp.json` defines the **`chill-zoho-crm`** connector (HTTP, OAuth) against org
`7006399149`. `.claude/settings.local.json` pre-approves it. If tools are
missing, authorise via `/mcp` in an interactive session.

**It has exactly 8 tools:** `getModules`, `getFields` (read-only), `getRecords`,
`getRelatedRecords`, `createRecords`, `updateRecords`, `updateRelatedRecords`,
`deleteRecords`. There is **no field/schema creation** — new CRM fields must be
made by hand in the CRM UI.

⚠️ Two other connectors (`claude.ai Zoho CRM`, `claude.ai instawebworks`) do
have `createFields`, but they resolve to **Insta Web Works** (org `638310255`),
a different company. **Never use them for this project.**

---

## 4. Stack

- Vite 7 + React 19
- Tailwind v4, CSS-first config (`@theme inline` in `src/styles/app.css`)
- No component library. The dialog, listbox and checkbox are hand-rolled.

---

## 5. Environment facts that cost hours

**The Zoho SDK is vendored, deliberately.**
`public/vendor/ZohoEmbededAppSDK.min.js` (v1.0.6). The documented CDN host
`live.zohostatic.com` **does not resolve — NXDOMAIN**. The working host is
`live.zwidgets.com` (1.0.5 and 1.0.6 serve; 1.0.7+ return 403). A dead script
tag fails silently: `window.ZOHO` is simply undefined and the widget idles with
no error. Vendoring removes that whole failure mode.

**`init()` never rejects.** From the SDK source, `ZOHO.embeddedApp.init()`
builds a promise resolved from `ZSDK.OnLoad` with no reject path wired at all.
Outside CRM it stays pending forever — which is exactly the gate's design:
outside CRM the widget shows a loading screen and does nothing, revealing
nothing to an unauthenticated viewer.

**`init()` is the success signal, not `PageLoad`.** `PageLoad` carries record
context; a top-band web tab has no record, so it may never fire even though the
widget is legitimately inside CRM. Gating on `PageLoad` alone hangs forever.

**StrictMode double-mount is a recurring trap.** It bit twice:
1. Restarting the SDK handshake per mount stranded the resolved result.
2. In `DataProvider`, a `let cancelled` cleanup flag combined with a
   "don't run twice" guard deadlocked the app — cleanup discarded the in-flight
   result and the guard blocked the restart, so it sat on the skeleton forever.

**Rule: never combine a run-once guard with cleanup-based cancellation.** Judge
staleness against a ref holding the attempt number instead.

**Creator rejects browser origins.** The Creator endpoint answers `401` /
`code 2945` `UNAUTHORIZED_CORS_REQUEST` for any browser origin, even though the
OPTIONS preflight succeeds. **Solved in code** — `ZOHO.CRM.HTTP.get` proxies the
call through Zoho's servers, so it is never a cross-origin browser request. No
Creator settings were changed. See `src/crm/http.js`.

**Every remote call needs a deadline.** The SDK returns promises that never
settle if the CRM host does not answer — indistinguishable from slowness. See
`src/lib/timeout.js`.

---

## 6. Architecture

```
main.jsx
└── CrmProvider        gates on the SDK handshake; nothing renders until CRM confirmed
    └── DataProvider   runs the staged bootstrap; shows skeleton / error
        └── WorkspaceProvider   applies the term + location scope
            └── App    header + WaitingPanel (left) + ScheduleBoard (right)
```

Each layer guarantees the next: `App` may assume a live SDK, loaded data, and a
valid scope, with no defensive checks.

### Bootstrap is staged, not parallel

`src/crm/bootstrap.js`. Stages run in order; tasks inside a stage run
concurrently. Later stages read earlier results via `ctx`.

| Stage | Tasks | Derives |
|---|---|---|
| 1 · Term | `terms` — Creator `getTermBreakTerms` | `targetTerm`, `targetTermBasis` |
| 2 · Term data | `locations`, `classes`, `admissions` | — |

If a stage fails, later stages are **skipped**, not run on missing data. A
timetable quietly scoped to the wrong term is worse than one that will not open.

Adding a source is one entry: `{ key, label, hint, run }` or
`{ key, label, hint, module, fields }`.

### Target term rule

`src/creator/terms.js` → `resolveTargetTerm()`:
1. the term containing today → `basis: 'current'`
2. otherwise the nearest term still to start → `basis: 'next'`
3. (safety net, not a stated requirement) all terms past → most recent,
   `basis: 'past'`

Today sits in an 86-day gap between Term 3 and Term 4, so rule 2 fires and
**Term 4 2026** is the target.

### Scope

`src/state/Workspace.jsx` holds **term + location**. Location filtering is
client-side over already-fetched term data, so switching sites is instant with
no refetch. Push it into the query if the org grows to many large sites.

---

## 7. CRM data model — read this before writing any query

### The seat fields are named backwards

| API name | Label | Actually means |
|---|---|---|
| `Allocated_Seats` | "Seats Available" | **capacity** (max) |
| `Seats_Allocated` | "Seats Allocated" | **occupancy** (taken) |

Near-anagrams meaning opposite things. Never reference them outside
`src/domain/classes.js` — use `capacityOf()` / `occupancyOf()`.

### Other traps

- **`Classes.Loction`** is genuinely misspelled in the schema. Do not "fix" it.
  Contained in `locationOf()` / `classLocationId()`.
- **Picklist display ≠ stored value.** Renamed options kept their originals:
  `Classroom_Type` "Studio" is stored `Option 1`; `Floor_Number` "Ground Floor"
  is `Option 1`. `getRecords` returns display values. Map at runtime.
- **Term is free text in places.** `Classes` uses `Select_Term` + `Academic_Year`
  ("Term 4" / "2026"); `Admissions.Term` is free text ("Term 4 2026"). Matching
  is parsed, not compared — see `src/domain/termMatch.js`.
- **A term's year is not its start year.** Term 1 2026 starts 22 Nov **2025**.
- **`Students.User_Password` is a plain text field.** Do not read, display, or
  transport it. Worth asking what writes to it.
- **Two session fields on Enrollments mean very different things.** This caused
  a live client complaint (Sep 2026) and is the easiest mistake in the module:

  | Field | Grain | Means |
  |---|---|---|
  | `Session_Preference_Order` | **per enrolment** | ranked wish list, all ten weekly slots |
  | `Selected_Programs_List` / `..._Data_JSON` | **per programme** | the session actually enrolled in and invoiced |

  One enrolment produces one Admission *per programme*, so reading
  `Session_Preference_Order[0]` onto an admission prints the same day and time
  on every programme a family took. 57 of 148 Term 4 admissions displayed a
  session that was not theirs. Always go through `domain/selectedPrograms.js`.

  `Selected_Programs_Data_JSON` is a **bare JSON array**, not the
  `{v, count, rows}` envelope `Allocation_Data_JSON` uses. It carries no
  `admission_id`, and `program_id` is an empty string on every "Chill Plus" row
  in the live data — so rows are matched by `programKey(program_name)`, never
  by id.

### Module chain

```
Locations ─┬─ Classrooms · Facilitators · Classes.Loction · Admissions.Location_Name
Students ──── Enrollments ──── Admissions (one per programme/term)
                                    ▲
Classes.Students_Allocated (subform) ┘   ← the allocation record
```

---

## 8. The allocation snapshot — the key mechanism

**Subform rows never come back from `getRecords`/`getAllRecords`,** even when
rows exist. Only `getRecordById` returns them, and fetching ~50 classes one at a
time is not worth 50 round trips.

**Solution:** the Classes workflow publishes a JSON snapshot of the subform into
`Allocation_Data_JSON` (textarea, 32,000 chars). The widget reads it with the
class — zero extra calls.

```json
{
  "v": 1,
  "count": 1,
  "rows": [
    {
      "rowId":       "125966000002409066",
      "admissionId": "125966000002354022",
      "admissionNo": "ADM-00003",
      "studentId":   "125966000002342005",
      "studentName": "Trish Stewart",
      "enrolmentNo": "ENR-1592"
    }
  ]
}
```

`rowId` is what makes a widget-side subform update possible **without** a
`getRecordById` — subform writes replace the whole set, so every existing row
must be sent back, and the snapshot supplies them.

Parsed by `src/domain/allocations.js`. `missing` (never written) and `empty`
(valid, nobody allocated) are deliberately different states.

**Deluge source of truth:** `deluge/build_Class_Code_And_Allocations.dg` —
version-controlled copy of the deployed workflow function. It also builds the
Class Code and keeps `Seats_Allocated = rows.size()`.

### Verified end-to-end (4 Aug)

A manual allocation of ADM-00003 into `CROB-ChillWE-T4-THU-2pm430pm` produced:
subform row → workflow fired → `Seats_Allocated: 1` → JSON published → widget
parsed and rendered it, and the student left the waiting panel.

### Writing an allocation — field contract

```jsonc
// Classes → updateRecord   (triggers MUST fire so the workflow reruns)
{
  "id": "<classId>",
  "Students_Allocated": [
    { "id": "<existing rowId>", "Admission": { "id": "<admissionId>" } },
    { "Admission": { "id": "<newAdmissionId>" } }   // no id ⇒ create
  ]
}

// Admissions → updateRecord
{ "id": "<admissionId>", "Allocated": true }
```

- row **with** `id` → updated; **without** → created; **omitted** → deleted
- `Admission` is `json_type: jsonobject` → needs `{"id": …}`, not a bare string
- `Student_Name` / `Enrolment_No` are filled by the workflow — do not write them
- `Parent_Id` is system-managed — do not send it
- **Do not suppress triggers on allocation writes.** (The opposite of the
  backfills, which used `trigger: []` deliberately.) The workflow protects
  itself from looping via `trigger: []` on its own write-back.

---

## 9. Where the UI stands

- **Header** — "Program Schedule | Term 4 2026", date range, location picker
  (custom accessible listbox, always interactive), brand lockup
- **Left panel** — "Awaiting Placement": admissions not in any class roster once
  pending edits are applied (derived from the rosters, *not* from the
  `Allocated` flag — the two disagree in live data). Compact cards: number +
  programme on one row, student on the next, and the **enrolled session**
  ("Enrolled Mon 2pm") from the Selected Programs List. A programme absent from
  that list shows no session rather than borrowing one. Scrolls internally
- **Right panel** — the board: 5 day columns × morning/afternoon, one CSS grid
  so dividing rules align across columns. Pills coloured from
  `Class_Color_Code`, seat badge right-aligned
- **Click a pill** → `ClassDialog`: allocated students, each with name +
  admission number and a **pre-ticked checkbox**. What the ticks do is **not yet
  specified** — selection is held and surfaced via `onSelectionChange`

**Hard layout rule: the page never scrolls, in either axis.** `html`/`body`/
`#root` are locked at `height:100%; overflow:hidden`. Panels scroll internally.
Day columns compress rather than forcing horizontal scroll.

⚠️ `min-h-0` on a `flex-1` scroll container is **load-bearing** — without it the
container grows to fit its content, `overflow-y-auto` never engages, and rows
are silently clipped. This already caused one bug in `WaitingPanel`.

### Colour

All colour comes from CRM (`Class_Color_Code`), never hardcoded. Text colour is
**computed** from the fill via WCAG contrast, because the palette spans
`#006636` to `#FCD242`:

- **Pills** pick white or dark text by contrast ratio.
- **Seat badges** sit on a scrim that pushes *away* from the text colour. Tinting
  *toward* it looked right and measured 3.12:1 — below AA. Pushing apart gives a
  worst case of 6.54:1.
- **Dialog headers** darken the fill until white clears 5:1, rather than flipping
  to dark text. Vivid colours barely move; Art `#FCD242` darkens 55%.

---

## 10. Start here tomorrow

1. `npm install && npm run dev`, open the Class Allocations tab in CRM.
2. **Scenario 1 is partly built.** Clicking a pill opens the roster with
   pre-ticked checkboxes. **The next instruction is what those checkboxes do.**
3. Scenario 2 has not been described at all. There are exactly two scenarios;
   Scenario 1 is "normal time viewing" and was called the easy one.

### Open items

- **UNVERIFIED — can the widget write the subform via the SDK?**
  `Classes.Students_Allocated` reports `operation_type: api_update:false` (all
  false), yet Deluge writes it fine — a known Zoho quirk for subform containers.
  The manual test used the CRM UI, which is a different path. **Prove this with
  one test write before Scenario 2 depends on it.**
- **`Chill Out` has no colour.** 16 hexes supplied for 17 programmes. Unused by
  the current 28 classes, so nothing is grey yet.
- **Term 4 end date disagrees.** Creator says **7 Dec**; the printed schedule
  says **11 Dec**. Same start (6 Oct). Decide which is authoritative before
  computing session dates.
- **86-day gap between Term 3 and Term 4** in Creator (12 Jul → 6 Oct). Terms
  1→2 and 2→3 are contiguous. Confirm this is intentional.
- **`no problem` `#786CC6`** is the one programme colour that misses AA on the
  pill at 4.41:1. Marginal; flagged rather than altered.
- **Concurrency.** Two users allocating at once can lose an update — the JSON is
  read, modified, written with no locking. Not addressed.

### Data volumes (4 Aug 2026)

Locations 1 · Classrooms 4 · Facilitators 6 · Classes 28 (all Term 4, all
Chill West End, all Studio 1) · Admissions 3 · Enrollments 200+ · Students 200+

### CRM changes made from here

- `Classes.Class_Color_Code` populated on all 28 (triggers suppressed)
- `Classes.Allocation_Data_JSON` backfilled to `{"v":1,"count":0,"rows":[]}` on
  all 28 (triggers suppressed — every roster was genuinely empty, so the value
  was knowable without running the workflow)

Both show `Modified_By: Marlene Crosbie` (the MCP account) if anyone audits.

### Not yet committed

The repo has one unrelated commit (`abc.dg`). Everything described here is
**untracked** — `git add` is still to be done.
