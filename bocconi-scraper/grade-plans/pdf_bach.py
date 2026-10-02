import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, "source", "bocconi-guide-2025-26.json"), encoding="utf-8"))

def tidy(t):
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s*\((didattica ed esame)\)", "", t)
    return t

def rows_for(year, courses):
    out = []
    for c in courses:
        cr = c.get("credits") or 0
        if not cr or c["kind"] == "thesis":
            continue
        k = c["kind"]
        if k == "optional_free":
            kind = "s" if c.get("internshipCanReplace") else "o"
            out.append({"n": "#", "c": cr, "y": year, "k": kind})
            continue
        if k == "internship":
            out.append({"n": tidy(c["title"]), "c": cr, "y": year, "k": "i"})
            continue
        title = c["title"]
        if title.lower().startswith("legal clinic oppure internship"):
            out.append({"n": "Legal clinic / Internship", "c": cr, "y": year, "k": "p"})
            continue
        if title.lower().startswith("un laboratorio o uno stage"):
            out.append({"n": "Laboratorio / opzionale all'estero", "c": cr, "y": year, "k": "s"})
            continue
        if k == "elective" and re.match(r"(?i)^(1 )?opzionale", title):
            out.append({"n": "#", "c": cr, "y": year, "k": "s" if c.get("internshipCanReplace") else "o"})
            continue
        if c.get("internshipCanReplace"):
            out.append({"n": tidy(title), "c": cr, "y": year, "k": "s"})
            continue
        graded = c.get("graded") or k == "language"
        n = c.get("pickCount")
        if n and c.get("creditsEach") and not c.get("pickGroup"):
            base = "Major course" if "major" in c["title"].lower() else tidy(c["title"])
            for i in range(n):
                out.append({"n": f"{base} {i + 1}", "c": c["creditsEach"], "y": year, "k": "g"})
            continue
        row = {"n": tidy(c["title"]), "c": cr, "y": year, "k": "g" if graded else "p"}
        if c.get("moduleOf") and graded:
            row["m"] = re.sub(r"^\d+\s+", "", c["moduleOf"]).strip()
        out.append(row)
    return out

def build(years_by_num):
    rows = []
    for y in sorted(years_by_num):
        rows += rows_for(y, years_by_num[y])
    n = 0
    for r in rows:  # number the optional slots in plan order
        if r["n"] == "#":
            n += 1
            r["n"] = f"#{n}"
    return rows

plans = {}
for p in d["programmes"]:
    base = {y["year"]: y["courses"] for y in p["years"]}
    tracks = p.get("tracks") or []
    if not tracks:
        plans[p["code"]] = build(base)
        continue
    default_done = False
    for t in tracks:
        ty = t.get("years")
        if not isinstance(ty, dict):  # "same as default"
            plans[f'{p["code"]}-{t["code"]}'] = build(base)
            default_done = True
            continue
        yrs = dict(base)
        for ys, courses in ty.items():
            yi = int(ys)
            if t.get("replacesAllYears"):
                yrs[yi] = courses
            elif t.get("replaces"):
                yrs[yi] = [c for c in base.get(yi, []) if not c.get("trackSpecific")] + courses
            else:
                yrs[yi] = courses
        plans[f'{p["code"]}-{t["code"]}'] = build(yrs)
    # CLEACC: the default years are the Italian class.
    if p["code"] == "CLEACC":
        plans["CLEACC"] = build(base)

