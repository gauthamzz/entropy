"""
Monthly entropy time-series for RDiT event studies.

Events:
  1. Shanghai upgrade   — April 2023  (ETH treated, BTC placebo)
  2. CRA deprecation    — January 2023 (React treated, Angular control)

Window: ±12 months around each event.
"""
import requests, json, math, time, os, calendar
from collections import Counter
from datetime import date

TOKEN = os.popen("gh auth token 2>/dev/null").read().strip()
GH_HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"Bearer {TOKEN}",
}

# ── Entropy estimators ────────────────────────────────────────────────────────

def chao_shen(counts):
    n = sum(counts.values())
    if n == 0: return 0.0
    H = 0.0
    for c in counts.values():
        if c == 0: continue
        p = c / n
        d = 1.0 - (1.0 - p) ** n
        if d < 1e-15: continue
        H -= p * math.log(p) / d
    return H

def shannon(counts):
    n = sum(counts.values())
    if n == 0: return 0.0
    return -sum((c/n)*math.log(c/n) for c in counts.values() if c > 0)

# ── GitHub fetch ──────────────────────────────────────────────────────────────

def fetch_repos(query, per_page=100, max_pages=5):
    repos, page = [], 1
    while page <= max_pages:
        r = requests.get(
            "https://api.github.com/search/repositories",
            headers=GH_HEADERS,
            params={"q": query, "per_page": per_page, "page": page,
                    "sort": "stars", "order": "desc"},
            timeout=30,
        )
        if r.status_code in (403, 429):
            reset = int(r.headers.get("X-RateLimit-Reset", time.time() + 65))
            wait  = max(reset - int(time.time()), 5)
            print(f"    [rate-limit] sleeping {wait}s …")
            time.sleep(wait)
            continue
        if r.status_code != 200:
            print(f"    [HTTP {r.status_code}] {r.text[:120]}")
            break
        items = r.json().get("items", [])
        repos.extend(items)
        if len(items) < per_page:
            break
        page += 1
        time.sleep(0.8)
    return repos

def entropy_month(base_query, yr, mo, exclude_topic=""):
    last_day = calendar.monthrange(yr, mo)[1]
    date_filter = f"created:{yr}-{mo:02d}-01..{yr}-{mo:02d}-{last_day:02d}"
    q = f"{base_query} {date_filter}"
    repos = fetch_repos(q)
    topics = [t for repo in repos
              for t in repo.get("topics", [])
              if t != exclude_topic]
    counts = Counter(topics)
    return {
        "H_cs":     round(chao_shen(counts), 4),
        "H_plugin": round(shannon(counts),   4),
        "n_repos":  len(repos),
        "n_topics": len(counts),
    }

# ── Month iterator ────────────────────────────────────────────────────────────

def month_range(start_yr, start_mo, n_months):
    yr, mo = start_yr, start_mo
    for _ in range(n_months):
        yield yr, mo
        mo += 1
        if mo > 12:
            mo = 1
            yr += 1

# ─────────────────────────────────────────────────────────────────────────────
# EVENT 1: Shanghai upgrade — April 2023
#   Window: April 2022 (τ=-12) … March 2024 (τ=+11)
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 60)
print("EVENT 1: Shanghai upgrade (April 2023)")
print("Treated: ETH app-layer  |  Placebo: BTC lightning")
print("=" * 60)

QUERIES_SHANGHAI = {
    "eth_app": ("topic:ethereum topic:solidity stars:>=2", ""),
    "btc_app": ("topic:bitcoin topic:lightning-network stars:>=2", ""),
}

results_shanghai = {k: {} for k in QUERIES_SHANGHAI}

for yr, mo in month_range(2022, 4, 24):  # Apr 2022 – Mar 2024
    tau = (yr - 2023) * 12 + (mo - 4)   # τ=0 at April 2023
    for label, (base_q, excl) in QUERIES_SHANGHAI.items():
        d = entropy_month(base_q, yr, mo, exclude_topic=excl)
        results_shanghai[label][(yr, mo)] = {"tau": tau, **d}
        print(f"  {label} {yr}-{mo:02d} (τ={tau:+3d}): "
              f"n={d['n_repos']:3d}, H_CS={d['H_cs']:.3f}")
    time.sleep(0.5)

# ─────────────────────────────────────────────────────────────────────────────
# EVENT 2: CRA deprecation — January 2023
#   Window: January 2022 (τ=-12) … December 2023 (τ=+11)
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("EVENT 2: CRA deprecation (January 2023)")
print("Treated: React  |  Control: Angular")
print("=" * 60)

QUERIES_CRA = {
    "react":   ("topic:react stars:>=3", "react"),
    "angular": ("topic:angular stars:>=3", "angular"),
}

results_cra = {k: {} for k in QUERIES_CRA}

for yr, mo in month_range(2022, 1, 24):  # Jan 2022 – Dec 2023
    tau = (yr - 2023) * 12 + mo          # τ=1 at January 2023
    for label, (base_q, excl) in QUERIES_CRA.items():
        d = entropy_month(base_q, yr, mo, exclude_topic=excl)
        results_cra[label][(yr, mo)] = {"tau": tau, **d}
        print(f"  {label} {yr}-{mo:02d} (τ={tau:+3d}): "
              f"n={d['n_repos']:3d}, H_CS={d['H_cs']:.3f}")
    time.sleep(0.5)

# ─────────────────────────────────────────────────────────────────────────────
# RDiT regression  H(τ) = β0 + β1·1(τ≥0) + β2·τ + β3·τ·1(τ≥0) + ε
# ─────────────────────────────────────────────────────────────────────────────

def rdit(series_dict, label, event_tau=0):
    """OLS with HC1 SEs.  series_dict: {(yr,mo): {tau, H_cs, n_repos, ...}}"""
    rows = sorted(series_dict.items())
    taus  = [v["tau"] for _, v in rows]
    H_obs = [v["H_cs"] for _, v in rows]
    n_obs = len(taus)

    # Build design matrix
    X = []
    for tau in taus:
        post = 1 if tau >= event_tau else 0
        X.append([1, post, tau, tau * post])

    # OLS: β = (X'X)^{-1} X'y
    import numpy as np
    X = np.array(X, dtype=float)
    y = np.array(H_obs, dtype=float)
    XtX_inv = np.linalg.inv(X.T @ X)
    beta = XtX_inv @ X.T @ y
    resid = y - X @ beta
    n, k = X.shape

    # HC1 sandwich SE
    S = np.zeros((k, k))
    for i in range(n):
        xi = X[i:i+1, :].T
        S += (resid[i] ** 2) * (xi @ xi.T)
    S *= n / (n - k)
    V = XtX_inv @ S @ XtX_inv
    se = np.sqrt(np.diag(V))
    t  = beta / se
    R2 = 1 - np.var(resid) / np.var(y)

    print(f"\n  ── RDiT: {label} ──")
    names = ["β0 (intercept)", "β1 (level break)", "β2 (pre-trend)", "β3 (slope change)"]
    for nm, b, s, tv in zip(names, beta, se, t):
        print(f"  {nm:25s} = {b:+.4f}  SE={s:.4f}  t={tv:+.2f}")
    print(f"  R² = {R2:.4f},  N = {n}")
    F1 = float(t[1] ** 2)
    print(f"  First-stage F (β1) = {F1:.1f}")
    return {"beta": beta.tolist(), "se": se.tolist(), "t": t.tolist(),
            "R2": float(R2), "N": n, "F_first_stage": F1}

print()
print("=" * 60)
print("RDIT REGRESSION RESULTS")
print("=" * 60)

reg_eth = rdit(results_shanghai["eth_app"], "ETH app-layer (treated)")
reg_btc = rdit(results_shanghai["btc_app"], "BTC lightning (placebo)")
reg_react   = rdit(results_cra["react"],   "React (treated, CRA)")
reg_angular = rdit(results_cra["angular"], "Angular (control, CRA)")

# ─────────────────────────────────────────────────────────────────────────────
# Save everything
# ─────────────────────────────────────────────────────────────────────────────

def serialise(d):
    return {f"{yr}-{mo:02d}": v for (yr, mo), v in d.items()}

output = {
    "shanghai": {
        "eth_app": serialise(results_shanghai["eth_app"]),
        "btc_app": serialise(results_shanghai["btc_app"]),
    },
    "cra": {
        "react":   serialise(results_cra["react"]),
        "angular": serialise(results_cra["angular"]),
    },
    "regressions": {
        "eth_treated": reg_eth,
        "btc_placebo":  reg_btc,
        "react_treated":   reg_react,
        "angular_control": reg_angular,
    },
}

out_path = os.path.join(os.path.dirname(__file__), "rdit_monthly.json")
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)
print(f"\nSaved → {out_path}")
