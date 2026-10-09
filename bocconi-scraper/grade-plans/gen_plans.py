# Builds packages/shared/src/grade-plans.ts. Run: python gen_plans.py
#
# Sources
#   bachelor  Bocconi's 2025-26 study-plan guide (pdf_bach.py); BEMACC is the
#             English CLEACC class and is folded into CLEACC-ENG.
#   MSc       B.lab's course lists (source/master.json) for the programmes whose
#             list still matches the 2026-27 annex, patched below; FINANCE,
#             INTENT and the two DSBA tracks are written from the annex itself
#             (msc_official.py) because B.lab's lists were wrong or incomplete.
#   CLMG      B.lab's list, equal to the 2026-27 plan.
#
# The build fails (nothing is written) when a plan's credits don't add up to
# the regulation: bachelor 177 + 3 final paper, MSc 120 including thesis and
# internship, CLMG 288. It also prints every row it drops or merges.
import hashlib, json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import msc_official as OFF

B = os.path.join(HERE, "source")
OUT = os.path.join(HERE, "..", "..", "packages", "shared", "src", "grade-plans.ts")

bach = json.load(open(os.path.join(B, "bachelor.json"), encoding="utf-8"))
mast = json.load(open(os.path.join(B, "master.json"), encoding="utf-8"))
clmg = json.load(open(os.path.join(B, "clmg.json"), encoding="utf-8"))

NOTES = []  # everything the generator drops, merges or assumes, printed at the end


def note(msg):
    NOTES.append(msg)


# B.lab's MSc lists carry notes and typos in course names; show clean names.
RENAME = {
    "Open choice course from Bocconi list": None,  # a free optional
    "1 out of a short list* from Bocconi list:": "Elective from the AI short list",
    "1 course to be chosen": "Course of your choice",
    "1 compulsory course to be chosen from": "Compulsory course of your choice",
    "1 compulsory concentration course": "Concentration course",
    "1 concentration elective on data analysis": "Concentration elective (data analysis)",
    "1 Innovation Specific Elective**": "Innovation elective",
    "National and international institutions law6Politics and policy making":
        "National and international institutions law / Politics and policy making",
    "Behaviourial skills seminars": "Behavioural skills seminars",
    "Seiminari per lo sviluppo di abilità comportamentali": "Seminari per lo sviluppo di abilità comportamentali",
}


def tidy_name(name):
    name = re.sub(r"\s*\(@ Bocconi\)", "", name)
    name = re.sub(r"\s*\(@ Humanitas\)", " · Humanitas", name)
    # Timetable notes: "1st sem.", "2nd sem", "(lessons + exam 1st semester 2nd year)".
    name = re.sub(r"\s*\b\d(st|nd) (sem(ester)?\.?|year)\b\.?", "", name)
    name = re.sub(r"\(\s*\)", "", name)
    name = re.sub(r"module (\d)\(", r"module \1 (", name)
    # "1 corso a scelta tra A / B" → "A / B"; "1 major compulsory course" → "Major compulsory course".
    name = re.sub(r"^1 (corso|insegnamento) a scelta tra ", "", name)
    name = re.sub(r"^1 ([a-z])", lambda m: m.group(1).upper(), name)
    return re.sub(r"\s+", " ", name).strip(" *:")


def number_optionals(rows):
    """Number optional slots in plan order; internships aren't optionals."""
    n = 0
    for r in rows:
        if r["k"] in ("o", "s"):
            n += 1
            r["n"] = f"#{n}"
    return rows


OPT = re.compile(r"(?i)^(elective|opzionale|optional)\b|^1 (free )?elective|elective$|^opzionale n|^electives \(")


def convert(rows, label, optional_rename=True):
    out = []
    seen = set()
    for r in sorted(rows, key=lambda x: (int(x["anno"] or 0), x["id"])):
        cfu = (r["cfu"] or "").strip()
        name = re.sub(r"\s+", " ", r["name"]).strip()
        if not cfu:
            note(f"{label}: dropped '{name}' (year {r['anno']}): no credits in the source")
            continue
        cfu = float(cfu)
        cfu = int(cfu) if cfu.is_integer() else cfu
        if name in RENAME:
            name = "Elective" if RENAME[name] is None else RENAME[name]  # "Elective" → numbered optional below
        name = tidy_name(name)
        year = int(r["anno"] or 1)
        if r["kind"] == "seminar":
            kind = "p"
        elif r.get("isStage"):
            kind = "s"
        elif OPT.search(name):
            kind = "o"
        else:
            kind = "g"
        if kind in ("o", "s") and optional_rename:
            name = "#"  # numbered below; rendered as "Optional N" in the app's language
        key = (name, year, cfu)
        if key in seen and kind == "g":
            note(f"{label}: merged duplicate '{name}' (year {year}, {cfu} credits)")
            continue
        seen.add(key)
        row = {"n": name, "c": cfu, "y": year, "k": kind}
        mod = r.get("module")
        if mod and kind == "g" and mod.lower() != "seminario":
            row["m"] = mod.strip()
        out.append(row)
    return number_optionals(out)


def row_from(t):
    n, c, y, k = t[:4]
    row = {"n": n, "c": c, "y": y, "k": k}
    if len(t) > 4:
        row["m"] = t[4]
    return row


# ── Patches ───────────────────────────────────────────────────────────────
def find(rows, needle, plan):
    hits = [r for r in rows if needle.lower() in r["n"].lower()]
    assert len(hits) == 1, f"{plan}: '{needle}' matches {len(hits)} rows"
    return hits[0]


def patch(plans_for_level, plan, ops):
    rows = plans_for_level[plan]
    for op in ops:
        if op[0] == "ren":  # ("ren", needle, new name)
            find(rows, op[1], plan)["n"] = op[2]
        elif op[0] == "kind":  # ("kind", needle, kind)
            find(rows, op[1], plan)["k"] = op[2]
        elif op[0] == "year":  # ("year", needle, year)
            find(rows, op[1], plan)["y"] = op[2]
        elif op[0] == "mod":  # ("mod", needle, module)
            find(rows, op[1], plan)["m"] = op[2]
        elif op[0] == "add":  # ("add", name, credits, year, kind)
            rows.append(row_from(op[1:]))
        else:
            raise ValueError(op)
    # Stable by year: new rows land at the end of their year.
    rows.sort(key=lambda r: r["y"])


# Bachelor: Bocconi's guide, with the fixes the audit found.
from pdf_bach import plans as pdf

pdf["BIG"] = pdf.pop("BIG-PPM")
for rows in pdf.values():
    for r in rows:
        if not r["n"].startswith("#"):
            r["n"] = tidy_name(r["n"])
        r["n"] = re.sub(r"\s+oppure\s+", " or ", r["n"])
# BEMACC is CLEACC's English class under its old code; B.lab's copy is dropped.
patch(pdf, "BIG-DSO", [("year", "Climate change and sustainability", 3)])  # year 3 in both regulations
patch(pdf, "CLEACC-ENG", [
    ("ren", "Foundamentals", "Fundamentals of organization"),
    ("ren", "Laboratorio / opzionale", "Workshop or elective abroad"),
])
# ug26 p.35: BEMACS has two plain electives and ONE "elective or internship".
bemacs_slots = [r for r in pdf["BEMACS"] if r["k"] == "s"]
assert len(bemacs_slots) == 2
bemacs_slots[0]["k"] = "o"

# MSc: B.lab lists for the programmes that still match the annex.
msc = {k: convert(v, f"master {k}") for k, v in mast.items() if k not in ("FINANCE", "DSBA")}

for rows in msc.values():
    for r in rows:
        r["n"] = re.sub(r"\s+[—–]\s+", " - ", r["n"])
        r["n"] = re.sub(r"\s*\((lessons (\+|and) exam)\)\s*$", "", r["n"])
        r["n"] = re.sub(r"(?i)^enhancing experience.*$", "Enhancing Experience", r["n"])
        if r["n"] == "Enhancing Experience":
            r["k"] = "p"  # Art. 20: supplementary curricular activities are pass/fail
        if r["k"] in ("i", "s"):
            r["n"], r["k"] = "Internship", "p"  # Art. 21: compulsory, "a pass is required"
        elif re.match(r"(?i)^(second|2nd)( foreign)? language$", r["n"]) or re.match(r"(?i)^lingua 2\b", r["n"]):
            r["n"] = "@lang2"
        elif re.match(r"(?i)^(foreign|eu) language$", r["n"]):
            r["n"] = "@lang"

patch(msc, "CRSG", [
    ("ren", "(at Bocconi)", "Introduction to cyber risk"),
    ("ren", "Module II: Software", "Software methodologies and architectures for security - Module 2 (software engineering methodologies for security)"),
    ("ren", "Module I: Enterprise", "Software methodologies and architectures for security - Module 1 (enterprise ICT architectures)"),
    ("ren", "Emerging topics in cybersecurity", "Emerging topics in cybersecurity"),
    ("ren", "Ethics Seminar", "Ethics seminar"),
    ("ren", "Behavioural Skills Seminar", "Behavioural skills seminar"),
])
patch(msc, "GIO", [
    ("ren", "National and international institutions law", "National and international institutions law"),
    ("ren", "Major compulsory course", "Business-government relations or International organizations management (your choice)"),
])
patch(msc, "IM-GLOBAL", [
    # The annex's Module 1 is Macroeconomics; B.lab had the two swapped.
    ("ren", "Module 2 (Macroeconomics)", "Global scenarios - Module 1 (macroeconomics)"),
    ("ren", "Module 1 (Geopolitics", "Global scenarios - Module 2 (geopolitics and business)"),
    ("ren", "Business Game", "International finance challenge"),
    ("add", "Enhancing Experience", 2, 2, "p"),
    ("add", "Internship", OFF.DEFAULT_INTERNSHIP, 2, "p"),
])
patch(msc, "IM-CONCENTRATION", [
    ("ren", "Course of your choice", "Law course of your choice (labour law, comparative business law or IP law)"),
    ("add", "Enhancing Experience", 2, 2, "p"),
    ("add", "Internship", OFF.DEFAULT_INTERNSHIP, 2, "p"),
])
patch(msc, "IM", [("ren", "comparative I business", "International comparative business law")])  # typo in B.lab's list
patch(msc, "AFM", [
    ("ren", "Business law (selected", "Business law or Global corporate taxation (your choice)"),
])
patch(msc, "ESS", [
    ("ren", "Compulsory course of your choice", "Advanced microeconomics or Advanced macroeconomics (your choice)"),
])
patch(msc, "PPA", [
    ("add", "Professional English seminars", 2, 2, "p"),
    ("add", "Enhancing Experience", 2, 2, "p"),
    ("add", "Internship", OFF.DEFAULT_INTERNSHIP, 2, "p"),
])
patch(msc, "TS", [
    ("ren", "Critical Thinking and Complex", "Behavioural skills and leadership seminar"),
    ("ren", "Sustainable Leadership seminar", "Sustainability: policy decision-making and evaluation"),
    ("add", "Internship", OFF.DEFAULT_INTERNSHIP, 2, "p"),
])
patch(msc, "ACME", [
    ("ren", "Quantitative methods for management",
     "Applied research in cultural industries and institutions - module I (quantitative methods for management)"),
])
# Internship credits per programme.
for k, rows in msc.items():
    for r in rows:
        if r["n"] == "Internship":
            r["c"] = OFF.INTERNSHIP.get(k, OFF.DEFAULT_INTERNSHIP)

# Programmes written from the annex.
msc["FINANCE"] = [row_from(t) for t in OFF.FINANCE_Y1 + OFF.FINANCE_Y2]
msc["FINANCE-GLOBAL"] = [
    {**r, "n": OFF.FINANCE_GLOBAL_RENAMES.get(r["n"], r["n"])} for r in (dict(x) for x in msc["FINANCE"])
]
msc["INTENT"] = [row_from(t) for t in OFF.INTENT]
msc["DSBA-BA"] = [row_from(t) for t in OFF.DSBA_BA]
msc["DSBA-DS"] = [row_from(t) for t in OFF.DSBA_DS]
for k in ("FINANCE", "FINANCE-GLOBAL", "INTENT", "DSBA-BA", "DSBA-DS"):
    number_optionals(msc[k])
for rows in msc.values():
    number_optionals(rows)

# Module pairs ("X - Module 1", "X module II (…)") are one integrated exam: one
# grade, the credit-weighted mean rounded. The bachelor guide says so; the MSc
# and CLMG regulations are silent, so the rule is applied the same way to every
# pair that is named as modules of one course.
MOD = re.compile(r"(?i)^(.*?)[\s,–-]*\(?\bmodul[eo]\s+(?:I{1,2}|\d)\b")


def group_modules(label, rows):
    parents = {}
    for r in rows:
        if r["k"] != "g":
            continue
        m = MOD.match(r["n"])
        if m:
            parent = re.sub(r"\s*\(.*$", "", m.group(1)).strip(" -–—,")
            parents.setdefault(parent.lower(), []).append(r)
    for key, group in parents.items():
        if len(group) < 2:
            continue
        name = group[0].get("m") or MOD.match(group[0]["n"]).group(1)
        name = re.sub(r"\s*\(.*$", "", name).strip(" -–—,")
        for r in group:
            if not r.get("m"):
                note(f"{label}: grouped '{r['n']}' as a module of '{name}'")
            r["m"] = r.get("m") or name


for k, rows in msc.items():
    group_modules(f"master {k}", rows)

plans = {
    "bachelor": {**pdf},
    "master": msc,
    "clmg": {"CLMG": convert(clmg, "clmg CLMG")},
}
plans["bachelor"].pop("BEMACC", None)

# Language rows become tokens the app translates ("@lang1" → "First language").
LANG = [
    (re.compile(r"(?i)^prima lingua$"), "@lang1"),
    (re.compile(r"(?i)^inglese \(i lingua\)"), "@english"),
    (re.compile(r"(?i)^seconda lingua"), "@lang2"),
    (re.compile(r"(?i)^(lingua|eu language)$"), "@lang"),
]
for lvl in ("bachelor", "clmg"):
    for rows in plans[lvl].values():
        for r in rows:
            for rx, tok in LANG:
                if rx.match(r["n"]):
                    r["n"] = tok
                    break

# ── Row ids ───────────────────────────────────────────────────────────────
# Saved grades are keyed by these, so a row keeps its id when the plan around
# it changes: "<year>.<slug of the name>"; optional slots (which are called
# "Optional N" in the app) get "<year>.o<k>", counted within the year.
def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if len(s) <= 40:
        return s
    # Long names: a readable prefix plus a hash of the whole slug, so two
    # modules sharing a long title still get different ids.
    return s[:30].strip("-") + "-" + hashlib.sha1(s.encode()).hexdigest()[:6]


def assign_ids(label, rows):
    seen, opt = set(), {}
    for r in rows:
        if r["k"] in ("o", "s"):
            opt[r["y"]] = opt.get(r["y"], 0) + 1
            rid = f'{r["y"]}.o{opt[r["y"]]}'
        else:
            rid = f'{r["y"]}.{slug(r["n"])}'
        assert rid and rid not in seen, f"{label}: duplicate or empty row id {rid!r} ({r['n']})"
        seen.add(rid)
        r["id"] = rid


for lvl, ps in plans.items():
    for k, rows in ps.items():
        assign_ids(f"{lvl} {k}", rows)
        # Key order in the output: id first.
        ps[k] = [{"id": r["id"], **{x: r[x] for x in ("n", "c", "y", "k", "m") if x in r}} for r in rows]

# ── Plan facts: cohort and checks ─────────────────────────────────────────
COHORT = {"bachelor": "2025-26", "clmg": "2026-27"}
MSC_COHORT = {"EMIT": "2025-26"}
LEGACY = {"EMIT", "IM", "CLELI"}  # no longer in the 2026-27 annex


def total(rows):
    return sum(r["c"] for r in rows)


# Year credits printed in the 2025-26 guide / 2026-27 regulation (without the 3
# credits of the final paper in year 3), so a wrong row cannot hide in a total.
BACHELOR_YEARS = {
    "CLEAM": (59, 60, 58), "CLEF": (59, 63, 55), "BESS": (62, 61, 54), "BEMACS": (60, 63, 54),
    "BIEM": (59, 59, 59), "BIEF-ECON": (59, 59, 59), "BIEF-FIN": (59, 59, 59),
    "CLEACC": (61, 61, 55), "CLEACC-ENG": (61, 61, 55), "BIG": (60, 66, 51),
    "BIG-DSO": (60, 60, 57),  # climate change sits in year 3 (ug26, reg2526)
    "BAI": (62, 57, 58), "BGL-GL": (58, 61, 58), "BGL-DL": (58, 61, 58),
}
errors = []


def check(cond, msg):
    if not cond:
        errors.append(msg)


for k, rows in plans["bachelor"].items():
    check(total(rows) == 177, f"bachelor {k}: {total(rows)} credits, expected 177 (+3 final paper)")
    ys = tuple(sum(r["c"] for r in rows if r["y"] == y) for y in (1, 2, 3))
    check(BACHELOR_YEARS.get(k) == ys, f"bachelor {k}: year totals {ys}, expected {BACHELOR_YEARS.get(k)}")
check(set(plans["bachelor"]) == set(BACHELOR_YEARS), "bachelor: plan set differs from the checked list")
check(total(plans["clmg"]["CLMG"]) == 288, "CLMG: not 288 credits (+12 thesis = 300)")
for k, rows in plans["master"].items():
    if k in OFF.LEGACY_TOTALS:
        check(total(rows) == OFF.LEGACY_TOTALS[k], f"master {k}: legacy total changed to {total(rows)}")
        continue
    check(k in OFF.THESIS, f"master {k}: no thesis credits in msc_official.py")
    check(total(rows) + OFF.THESIS[k] == 120, f"master {k}: {total(rows)} + thesis {OFF.THESIS[k]} != 120")
    check(sum(1 for r in rows if r["n"] == "Internship") == 1, f"master {k}: needs exactly one Internship row")
    check(not any(r["k"] in ("i", "s") for r in rows), f"master {k}: has an internship-switch row")
    if k in OFF.YEAR1:
        y1 = sum(r["c"] for r in rows if r["y"] == 1)
        check(y1 == OFF.YEAR1[k], f"master {k}: year 1 is {y1}, annex says {OFF.YEAR1[k]}")
if errors:
    print("PLAN CHECKS FAILED:\n  " + "\n  ".join(errors), file=sys.stderr)
    sys.exit(1)

meta = {"bachelor": {}, "master": {}, "clmg": {}}
for lvl, ps in plans.items():
    for k in ps:
        cohort = MSC_COHORT.get(k) if lvl == "master" else COHORT[lvl]
        if lvl == "master" and k not in MSC_COHORT and k not in LEGACY:
            cohort = "2026-27"
        entry = {"cohort": cohort}
        if k in LEGACY:
            entry["legacy"] = True
        meta[lvl][k] = entry

ts = """// Study plans for the grade calculators. GENERATED by
// bocconi-scraper/grade-plans/gen_plans.py — edit that, not this file.
// Bachelor: Bocconi's 2025-26 study-plan guide. MSc: the 2026-27 regulation
// annex, and B.lab's course lists where those still match it. CLMG: the 2026-27
// plan. Every plan's credits are checked at generation (bachelor 177 + 3 final
// paper, MSc 120 with thesis, CLMG 288).
//
// Row: id = stable key a saved grade is stored under ("<year>.<name slug>",
// "<year>.o<k>" for the k-th optional slot of that year), n = course name
// ("#N" = the Nth optional slot, "@x" = a language row; both named in the app's
// language), c = credits, y = year, m = parent course when it is one module of
// an integrated exam, k = kind:
//   g graded course · p pass/fail (seminar, internship, supplementary activity)
//   o optional course · s optional that an internship can replace
//   i internship (no grade) that an optional course can replace (bachelor only)

export type PlanKind = "g" | "p" | "o" | "s" | "i";
export interface PlanRow {
  id: string;
  n: string;
  c: number;
  y: number;
  k: PlanKind;
  m?: string;
}

/** Which enrolment year a plan is written for, and whether it is being phased out. */
export interface PlanMeta {
  cohort: string | null;
  legacy?: boolean;
}

export const GRADE_PLANS: {
  bachelor: Record<string, PlanRow[]>;
  master: Record<string, PlanRow[]>;
  clmg: Record<string, PlanRow[]>;
} = """ + json.dumps(plans, ensure_ascii=False, indent=1) + """;

export const PLAN_META: {
  bachelor: Record<string, PlanMeta>;
  master: Record<string, PlanMeta>;
  clmg: Record<string, PlanMeta>;
} = """ + json.dumps(meta, ensure_ascii=False, indent=1) + ";\n"
open(OUT, "w", encoding="utf-8", newline="\n").write(ts)
for lvl, ps in plans.items():
    for k, rows in ps.items():
        print(lvl, k, len(rows), total(rows), "".join(sorted(r["k"] for r in rows)))
print("\nGenerator notes (dropped, merged or assumed):")
for n in NOTES:
    print("  -", n)
