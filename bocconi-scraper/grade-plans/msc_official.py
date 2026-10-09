# MSc facts transcribed from Bocconi's "Study plans - cohort 2026-27" annex
# (MSc Rules and Regulations 2026-27, msc26.pdf pp.40-53). gen_plans.py builds
# the plans that B.lab's lists got wrong from this file, patches the others and
# checks every plan against the totals below.
#
# Row: (name, credits, year, kind[, module]); kind g graded, p pass/fail,
# o optional slot. Names with "@" are tokens the app translates.


FINANCE_Y1 = [
    ("Financial reporting and analysis lab", 3, 1, "g"),
    ("Corporate finance (business valuation)", 6, 1, "g"),
    ("Quantitative finance and derivatives - Module 1", 7, 1, "g", "Quantitative finance and derivatives"),
    ("Empirical finance", 8, 1, "g"),
    ("Investment banking", 6, 1, "g"),
    ("Behavioural skills seminars", 2, 1, "p"),
    ("Quantitative finance and derivatives - Module 2", 6, 1, "g", "Quantitative finance and derivatives"),
    ("Financial institutions and markets law", 6, 1, "g"),
    ("Financial data science", 6, 1, "g"),
    ("Risk management and value in banking and insurance", 6, 1, "g"),
    ("Theory of finance", 6, 1, "g"),
]
FINANCE_Y2 = [
    ("#", 6, 2, "o"), ("#", 6, 2, "o"), ("#", 6, 2, "o"), ("#", 6, 2, "o"),
    ("Professional English seminars", 2, 2, "p"),
    ("@lang2", 4, 2, "g"),
    ("Climate finance lab or Enhancing Experience", 2, 2, "p"),
    ("Internship", 8, 2, "p"),
]
# The Global Experience track swaps three first-year courses and a seminar.
FINANCE_GLOBAL_RENAMES = {
    "Investment banking": "International investment banking",
    "Financial institutions and markets law": "International financial institutions and markets law",
    "Theory of finance": "Investments: an international perspective",
    "Behavioural skills seminars": "Behavioural skills seminars (inclusive communication in multicultural environments)",
}

INTENT = [
    ("Intellectual property law for business", 6, 1, "g"),
    ("Data analysis - Module I (data lab for entrepreneurship)", 8, 1, "g", "Data analysis"),
    ("Venture capital and valuation", 6, 1, "g"),
    ("Corporate venturing and innovation strategy", 6, 1, "g"),
    ("Behavioural skills seminars", 2, 1, "p"),
    ("The emergence of entrepreneurial ventures: theory and practice", 6, 1, "g"),
    ("Industry dynamics and innovation ecosystems", 6, 1, "g"),
    ("Economics of strategy and innovation", 8, 1, "g"),
    ("Entrepreneurial decision making", 6, 1, "g"),
    ("Data analysis - Module II (exploratory data analysis and visualization)", 8, 1, "g", "Data analysis"),
    ("#", 6, 2, "o"), ("#", 6, 2, "o"), ("#", 6, 2, "o"), ("#", 6, 2, "o"),
    ("Professional English seminars", 2, 2, "p"),
    ("@lang2", 4, 2, "g"),
    ("Enhancing Experience", 2, 2, "p"),
    ("Internship", 8, 2, "p"),
]

_DSBA_COMMON_Y1 = [
    ("Computer programming and database systems", 8, 1, "g"),
    ("Statistics and probability", 8, 1, "g"),
    ("Business analytics", 8, 1, "g"),
    ("Econometrics for big data", 8, 1, "g"),
    ("Behavioural skills seminar", 2, 1, "p"),
    ("Natural language processing", 6, 1, "g"),
    ("Machine learning", 8, 1, "g"),
]
_DSBA_Y2_END = [("#", 6, 2, "o"), ("#", 6, 2, "o"), ("@lang", 4, 2, "g"), ("Internship", 8, 2, "p")]
DSBA_BA = (
    _DSBA_COMMON_Y1
    + [
        ("Innovation and marketing analytics", 6, 1, "g"),
        ("Simulation and modeling", 8, 1, "g"),
        ("Digital privacy seminar", 2, 2, "p"),
        ("Finance with big data", 8, 2, "g"),
        ("Deep learning for computer vision", 6, 2, "g"),
    ]
    + _DSBA_Y2_END
)
DSBA_DS = (
    _DSBA_COMMON_Y1
    + [
        ("Computer science (algorithms)", 6, 1, "g"),
        ("Optimization", 8, 1, "g"),
        ("Digital privacy seminar", 2, 2, "p"),
        ("Stochastic processes", 8, 2, "g"),
        ("Machine learning II", 6, 2, "g"),
    ]
    + _DSBA_Y2_END
)

# Thesis credits (the plan lists everything else, so plan + thesis = 120).
THESIS = {
    "CRSG": 18, "AI": 18, "GIO": 18, "IM-GLOBAL": 18, "IM-CONCENTRATION": 18,
    "FINANCE": 18, "FINANCE-GLOBAL": 18, "DAAIHS": 14, "DSBA-BA": 18, "DSBA-DS": 18,
    "MM": 18, "AFM": 18, "ESS": 18, "PPA": 20, "TS": 14, "ACME": 18, "INTENT": 18,
    "EMIT": 18,  # 2025-26 plan, kept for students who started then
}
# First-year credits printed in the annex (a second, independent check).
YEAR1 = {
    "CRSG": 62, "AI": 60, "GIO": 62, "IM-GLOBAL": 62, "IM-CONCENTRATION": 62,
    "FINANCE": 62, "FINANCE-GLOBAL": 62, "DAAIHS": 73, "DSBA-BA": 62, "DSBA-DS": 62,
    "MM": 62, "AFM": 64, "ESS": 62, "PPA": 60, "TS": 64, "ACME": 62, "INTENT": 62,
}
# Compulsory internship credits (annex: 8, AFM 6, DAIHS 6).
INTERNSHIP = {"AFM": 6, "DAAIHS": 6}
DEFAULT_INTERNSHIP = 8
# Plans that are not in the 2026-27 annex any more: their totals are only
# frozen, not checked against the regulation.
LEGACY_TOTALS = {"IM": 86, "CLELI": 92}
