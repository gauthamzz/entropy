"""
Within-Ethereum Sector Difference-in-Differences (RDiT-DiD)
around the Shanghai upgrade (April 2023).

Treatment: DeFi/staking repos  (topic:ethereum + defi/staking/liquid-staking)
Control:   Wallet/tooling repos (topic:ethereum + wallet/web3/node)

Specification (stacked monthly panel, N = 48 obs = 2 sectors × 24 months):

  H_{s,τ} = α
           + β₁·Post_τ            (common level break at τ=0)
           + β₂·τ                  (common pre-trend)
           + β₃·τ·Post_τ           (common slope change)
           + γ·DeFi_s              (sector FE)
           + δ·DeFi_s·Post_τ       (DiD level break  ← KEY)
           + ζ·DeFi_s·τ·Post_τ     (DiD slope change ← KEY)
           + ε_{s,τ}

H0: δ=0  (Shanghai did not differentially shift DeFi entropy vs. wallet/tooling)
H1: δ>0  (DeFi/staking entropy jumped relative to wallet/tooling post-Shanghai)
"""
import requests, json, math, time, os, calendar, numpy as np
from collections import Counter

TOKEN = os.popen("gh auth token 2>/dev/null").read().strip()
GH_HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"Bearer {TOKEN}",
}

# ── Entropy estimators ────────────────────────────────────────────────────────

def chao_shen(counts):
    n = sum(counts.values())
    if n == 0: return float("nan")
    H = 0.0
    for c in counts.values():
        if c == 0: continue
        p = c / n
        d = 1.0 - (1.0 - p) ** n
        if d < 1e-15: continue
        H -= p * math.log(p) / d
    return H

# ── GitHub fetch ──────────────────────────────────────────────────────────────

def fetch_month(base_query, yr, mo, exclude_topics=()):
    last_day = calendar.monthrange(yr, mo)[1]
    q = f"{base_query} created:{yr}-{mo:02d}-01..{yr}-{mo:02d}-{last_day:02d}"
    repos, page = [], 1
    while page <= 5:
        r = requests.get(
            "https://api.github.com/search/repositories",
            headers=GH_HEADERS,
            params={"q": q, "per_page": 100, "page": page,
                    "sort": "stars", "order": "desc"},
            timeout=30,
        )
        if r.status_code in (403, 429):
            wait = max(int(r.headers.get("X-RateLimit-Reset", time.time()+65))
                       - int(time.time()), 5)
            print(f"    [rate-limit] sleeping {wait}s …")
            time.sleep(wait)
            continue
        if r.status_code != 200:
            break
        items = r.json().get("items", [])
        repos.extend(items)
        if len(items) < 100: break
        page += 1
        time.sleep(0.8)
    topics = [t for repo in repos
              for t in repo.get("topics", [])
              if t not in exclude_topics]
    counts = Counter(topics)
    return {"H_cs": round(chao_shen(counts), 4),
            "n_repos": len(repos), "n_topics": len(counts)}

# ── Month iterator ────────────────────────────────────────────────────────────

def month_range(start_yr, start_mo, n):
    yr, mo = start_yr, start_mo
    for _ in range(n):
        yield yr, mo
        mo = mo % 12 + 1
        if mo == 1: yr += 1

# ─────────────────────────────────────────────────────────────────────────────
# Collect data
# Window: April 2022 (τ=−12) … March 2024 (τ=+11)
# ─────────────────────────────────────────────────────────────────────────────

SECTORS = {
    # Treatment: DeFi / staking ecosystem — directly affected by staking withdrawals
    "defi": (
        "topic:ethereum topic:defi stars:>=2",
        ("ethereum", "defi"),
    ),
    # Control: Wallet / tooling — DeFi-agnostic infrastructure
    "wallet": (
        "topic:ethereum topic:wallet stars:>=2",
        ("ethereum", "wallet"),
    ),
}

print("=" * 65)
print("Within-Ethereum Sector DiD — Shanghai upgrade (April 2023)")
print("Treatment: DeFi/staking  |  Control: Wallet/tooling")
print("=" * 65)

data = {s: {} for s in SECTORS}

for yr, mo in month_range(2022, 4, 24):
    tau = (yr - 2023) * 12 + (mo - 4)   # τ=0 at April 2023
    for label, (base_q, excl) in SECTORS.items():
        d = fetch_month(base_q, yr, mo, exclude_topics=excl)
        data[label][(yr, mo)] = {"tau": tau, **d}
        print(f"  {label:6s} {yr}-{mo:02d} (τ={tau:+3d}): "
              f"n={d['n_repos']:3d}, H_CS={d['H_cs']:.3f}")
    time.sleep(0.4)

# ─────────────────────────────────────────────────────────────────────────────
# Build stacked panel and run DiD regression
# ─────────────────────────────────────────────────────────────────────────────

rows = []
for (yr, mo), v in sorted(data["defi"].items()):
    if math.isnan(v["H_cs"]): continue
    tau  = v["tau"]
    post = int(tau >= 0)
    rows.append([v["H_cs"], 1, post, tau, tau * post,
                 1, post, tau * post, yr * 100 + mo])   # DeFi = 1

for (yr, mo), v in sorted(data["wallet"].items()):
    if math.isnan(v["H_cs"]): continue
    tau  = v["tau"]
    post = int(tau >= 0)
    rows.append([v["H_cs"], 1, post, tau, tau * post,
                 0, 0,    0,          yr * 100 + mo])   # Wallet = 0

# y  | const | Post | τ | τ·Post | DeFi | DeFi·Post | DeFi·τ·Post | date
rows.sort(key=lambda r: r[-1])

y = np.array([r[0] for r in rows])
X = np.array([r[1:8] for r in rows], dtype=float)
# Columns: [const, Post, τ, τ·Post, DeFi, DeFi·Post, DeFi·τ·Post]
col_names = ["Intercept", "Post", "τ", "τ·Post",
             "DeFi (FE)", "DeFi×Post (δ)", "DeFi×τ·Post (ζ)"]

n, k = X.shape
XtX_inv = np.linalg.inv(X.T @ X)
beta    = XtX_inv @ X.T @ y
resid   = y - X @ beta

# HC1 sandwich
S = np.zeros((k, k))
for i in range(n):
    xi = X[i:i+1, :].T
    S += resid[i] ** 2 * (xi @ xi.T)
S *= n / (n - k)
V  = XtX_inv @ S @ XtX_inv
se = np.sqrt(np.diag(V))
t  = beta / se
R2 = 1 - np.var(resid) / np.var(y)

print()
print("=" * 65)
print("DiD REGRESSION RESULTS  (N =", n, "obs — 2 sectors × 24 months)")
print("=" * 65)
print(f"  {'Coefficient':<25} {'β':>8} {'SE':>8} {'t':>8}")
print("  " + "-" * 52)
for nm, b, s, tv in zip(col_names, beta, se, t):
    star = "***" if abs(tv) > 3.29 else ("**" if abs(tv) > 2.58
           else ("*" if abs(tv) > 1.96 else (" †" if abs(tv) > 1.645 else "  ")))
    print(f"  {nm:<25} {b:>8.4f} {s:>8.4f} {tv:>7.2f} {star}")
print(f"\n  R² = {R2:.4f}   N = {n}")
print()
print("  KEY COEFFICIENTS:")
idx_delta = col_names.index("DeFi×Post (δ)")
idx_zeta  = col_names.index("DeFi×τ·Post (ζ)")
print(f"  δ (DiD level break)    β = {beta[idx_delta]:+.4f}  "
      f"SE={se[idx_delta]:.4f}  t={t[idx_delta]:+.2f}")
print(f"  ζ (DiD slope change)   β = {beta[idx_zeta]:+.4f}  "
      f"SE={se[idx_zeta]:.4f}  t={t[idx_zeta]:+.2f}")

# ─────────────────────────────────────────────────────────────────────────────
# Placebo: shift event to October 2022 (6 months pre-true event)
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 65)
print("PLACEBO TEST  (fake event = October 2022, pre-Shanghai)")
print("=" * 65)

rows_p = []
for (yr, mo), v in sorted(data["defi"].items()):
    if math.isnan(v["H_cs"]): continue
    tau_p = (yr - 2022) * 12 + (mo - 10)   # τ=0 at October 2022
    post_p = int(tau_p >= 0)
    rows_p.append([v["H_cs"], 1, post_p, tau_p, tau_p * post_p,
                   1, post_p, tau_p * post_p])
for (yr, mo), v in sorted(data["wallet"].items()):
    if math.isnan(v["H_cs"]): continue
    tau_p = (yr - 2022) * 12 + (mo - 10)
    post_p = int(tau_p >= 0)
    rows_p.append([v["H_cs"], 1, post_p, tau_p, tau_p * post_p,
                   0, 0, 0])

yp = np.array([r[0] for r in rows_p])
Xp = np.array([r[1:] for r in rows_p], dtype=float)
b_p  = np.linalg.inv(Xp.T @ Xp) @ Xp.T @ yp
res_p = yp - Xp @ b_p
Sp = np.zeros((k, k))
for i in range(len(rows_p)):
    xi = Xp[i:i+1, :].T
    Sp += res_p[i] ** 2 * (xi @ xi.T)
Sp *= n / (n - k)
Vp = np.linalg.inv(Xp.T @ Xp) @ Sp @ np.linalg.inv(Xp.T @ Xp)
sep = np.sqrt(np.diag(Vp))
tp  = b_p / sep

print(f"  Placebo δ (DeFi×Post):   β = {b_p[5]:+.4f}  "
      f"SE={sep[5]:.4f}  t={tp[5]:+.2f}  (expect ≈ 0)")
print(f"  Placebo ζ (DeFi×τ·Post): β = {b_p[6]:+.4f}  "
      f"SE={sep[6]:.4f}  t={tp[6]:+.2f}")

# ─────────────────────────────────────────────────────────────────────────────
# Save results
# ─────────────────────────────────────────────────────────────────────────────

def serialise(d):
    return {f"{yr}-{mo:02d}": v for (yr, mo), v in d.items()}

output = {
    "data": {s: serialise(data[s]) for s in SECTORS},
    "regression": {
        "coefficients": dict(zip(col_names, beta.tolist())),
        "std_errors":   dict(zip(col_names, se.tolist())),
        "t_stats":      dict(zip(col_names, t.tolist())),
        "R2": float(R2), "N": int(n),
    },
    "placebo": {
        "delta": float(b_p[5]), "delta_se": float(sep[5]), "delta_t": float(tp[5]),
        "zeta":  float(b_p[6]), "zeta_se":  float(sep[6]), "zeta_t":  float(tp[6]),
    },
}
out_path = os.path.join(os.path.dirname(__file__), "sector_did.json")
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)
print(f"\nSaved → {out_path}")
