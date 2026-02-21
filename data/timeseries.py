"""
Time-series entropy — repos created per year, topic entropy at each cut.
Also computes application-layer entropy (filter to dapp/defi/nft etc.)
for blockchain platforms to separate "tooling" from "built-on" repos.
"""
import requests, json, math, time, os
from collections import Counter

TOKEN = os.popen("gh auth token 2>/dev/null").read().strip()
GH_HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"Bearer {TOKEN}",
}

def shannon(counts):
    n = sum(counts.values())
    if n == 0: return 0.0
    return -sum((c/n)*math.log(c/n) for c in counts.values() if c > 0)

def chao_shen(counts):
    n = sum(counts.values())
    if n == 0: return 0.0
    H = 0.0
    for c in counts.values():
        if c == 0: continue
        p = c / n
        d = 1.0 - (1.0 - p)**n
        if d < 1e-15: continue
        H -= p * math.log(p) / d
    return H

def fetch_repos(query, per_page=100, max_pages=10):
    repos, page = [], 1
    while page <= max_pages:
        r = requests.get("https://api.github.com/search/repositories",
            headers=GH_HEADERS,
            params={"q": query, "per_page": per_page, "page": page,
                    "sort": "stars", "order": "desc"}, timeout=30)
        if r.status_code in (403, 429):
            reset = int(r.headers.get("X-RateLimit-Reset", time.time()+60))
            time.sleep(max(reset - int(time.time()), 5))
            continue
        if r.status_code != 200: break
        items = r.json().get("items", [])
        repos.extend(items)
        if len(items) < per_page: break
        page += 1
        time.sleep(0.7)
    return repos

def entropy_of_repos(repos, exclude_topic=""):
    topics = [t for repo in repos for t in repo.get("topics",[]) if t != exclude_topic]
    counts = Counter(topics)
    return {"H_cs": round(chao_shen(counts),4),
            "H_plugin": round(shannon(counts),4),
            "n_repos": len(repos),
            "n_topics": len(counts),
            "top10": [k for k,_ in sorted(counts.items(), key=lambda x:-x[1])[:10]]}

# ── 1. Time series: Android vs iOS by year ───────────────────────────────────
YEARS = [2011, 2013, 2015, 2017, 2019, 2021, 2023]

print("="*60)
print("TIME SERIES: Android vs iOS")
print("="*60)
ts_mobile = {}
for topic in ["android", "ios"]:
    ts_mobile[topic] = {}
    for yr in YEARS:
        q = f"topic:{topic} stars:>=3 created:{yr}-01-01..{yr}-12-31"
        repos = fetch_repos(q, max_pages=5)
        d = entropy_of_repos(repos, exclude_topic=topic)
        ts_mobile[topic][yr] = d
        print(f"  {topic} {yr}: n={d['n_repos']}, H_CS={d['H_cs']:.3f}")

print()
print("="*60)
print("TIME SERIES: Ethereum vs Bitcoin (application layer)")
print("="*60)
# For blockchain, query APPLICATION repos specifically
# Ethereum application markers: solidity, dapp, defi, nft, dao, smart-contract
# Bitcoin application markers: lightning, lnd, lightning-network
CHAIN_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023]

ts_chain = {}
queries = {
    "ethereum_app": "topic:ethereum topic:solidity stars:>=2",   # smart contract repos
    "ethereum_all": "topic:ethereum stars:>=5",
    "bitcoin_app":  "topic:bitcoin topic:lightning-network stars:>=2",
    "bitcoin_all":  "topic:bitcoin stars:>=5",
}

for label, base_q in queries.items():
    ts_chain[label] = {}
    for yr in CHAIN_YEARS:
        q = f"{base_q} created:{yr}-01-01..{yr}-12-31"
        repos = fetch_repos(q, max_pages=5)
        d = entropy_of_repos(repos)
        ts_chain[label][yr] = d
        print(f"  {label} {yr}: n={d['n_repos']}, H_CS={d['H_cs']:.3f}")

print()
print("="*60)
print("TIME SERIES: React vs Angular by year")
print("="*60)
ts_frontend = {}
FE_YEARS = [2014, 2016, 2018, 2020, 2022, 2024]
for topic in ["react", "angular"]:
    ts_frontend[topic] = {}
    for yr in FE_YEARS:
        q = f"topic:{topic} stars:>=5 created:{yr}-01-01..{yr}-12-31"
        repos = fetch_repos(q, max_pages=5)
        d = entropy_of_repos(repos, exclude_topic=topic)
        ts_frontend[topic][yr] = d
        print(f"  {topic} {yr}: n={d['n_repos']}, H_CS={d['H_cs']:.3f}")

# ── Save ──────────────────────────────────────────────────────────────────────
out = {"mobile": ts_mobile, "blockchain": ts_chain, "frontend": ts_frontend}
with open("timeseries.json","w") as f:
    json.dump(out, f, indent=2)
print("\nSaved timeseries.json")

# ── Print clean comparison tables ────────────────────────────────────────────
print()
print("="*60)
print("ANDROID vs iOS — H_CS over time")
print(f"{'Year':<6} {'Android':>10} {'iOS':>8} {'ΔH':>8}")
print("-"*35)
for yr in YEARS:
    a = ts_mobile["android"][yr]["H_cs"]
    i = ts_mobile["ios"][yr]["H_cs"]
    print(f"{yr:<6} {a:>10.3f} {i:>8.3f} {a-i:>8.3f}")

print()
print("="*60)
print("ETH (smart-contracts) vs BTC (lightning) — H_CS over time")
print(f"{'Year':<6} {'ETH_app':>10} {'BTC_app':>9} {'ΔH':>8}")
print("-"*35)
for yr in CHAIN_YEARS:
    e = ts_chain["ethereum_app"][yr]["H_cs"]
    b = ts_chain["bitcoin_app"][yr]["H_cs"]
    print(f"{yr:<6} {e:>10.3f} {b:>9.3f} {e-b:>8.3f}")

print()
print("="*60)
print("REACT vs ANGULAR — H_CS over time")
print(f"{'Year':<6} {'React':>10} {'Angular':>9} {'ΔH':>8}")
print("-"*35)
for yr in FE_YEARS:
    r = ts_frontend["react"][yr]["H_cs"]
    a = ts_frontend["angular"][yr]["H_cs"]
    print(f"{yr:<6} {r:>10.3f} {a:>9.3f} {r-a:>8.3f}")
