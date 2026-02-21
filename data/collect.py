"""
Entropy Dominance — Empirical Data Collection
----------------------------------------------
Queries GitHub Search API, npm registry, and PyPI to measure
ecosystem entropy (Shannon / Chao-Shen) for competing platforms.

The microstate for each platform = (repo topic / package keyword).
H_P = entropy of the downstream-activity distribution over topic labels.

Usage:
    python collect.py
Outputs:
    results.json   — full data
    table.txt      — print-ready summary table
"""

import requests, json, math, time, os, sys
from collections import Counter
from datetime import datetime

# ── GitHub token from gh CLI env ────────────────────────────────────────────
def get_github_token():
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        # Try reading from gh CLI keyring via subprocess
        import subprocess
        r = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True)
        token = r.stdout.strip()
    return token

TOKEN = get_github_token()
GH_HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"Bearer {TOKEN}" if TOKEN else "",
}

# ── Shannon entropy ──────────────────────────────────────────────────────────
def shannon(counts: dict) -> float:
    n = sum(counts.values())
    if n == 0:
        return 0.0
    H = 0.0
    for c in counts.values():
        if c > 0:
            p = c / n
            H -= p * math.log(p)
    return H

# ── Chao-Shen estimator ──────────────────────────────────────────────────────
def chao_shen(counts: dict) -> float:
    n = sum(counts.values())
    if n == 0:
        return 0.0
    H = 0.0
    for c in counts.values():
        if c == 0:
            continue
        p = c / n
        denom = 1.0 - (1.0 - p) ** n
        if denom < 1e-15:
            continue
        H -= p * math.log(p) / denom
    return H

# ── effective species count S_eff = exp(H) ──────────────────────────────────
def seff(H: float) -> float:
    return math.exp(H)

# ── GitHub: fetch repos by topic, collect secondary topics ──────────────────
def github_topic_entropy(query_topic: str, min_stars: int = 5, max_repos: int = 1000):
    """
    Search GitHub repos by topic, collect all secondary topics,
    return (plugin_H, CS_H, distinct_topics, n_repos, top_topics)
    """
    collected = []
    page = 1
    per_page = 100
    while len(collected) < max_repos:
        url = "https://api.github.com/search/repositories"
        params = {
            "q": f"topic:{query_topic} stars:>={min_stars}",
            "per_page": per_page,
            "page": page,
            "sort": "stars",
            "order": "desc",
        }
        r = requests.get(url, headers=GH_HEADERS, params=params)
        if r.status_code == 403 or r.status_code == 429:
            reset = int(r.headers.get("X-RateLimit-Reset", time.time() + 60))
            wait = max(reset - int(time.time()), 5)
            print(f"  Rate limited, waiting {wait}s ...", flush=True)
            time.sleep(wait)
            continue
        if r.status_code != 200:
            print(f"  HTTP {r.status_code} for {query_topic}", flush=True)
            break
        items = r.json().get("items", [])
        if not items:
            break
        collected.extend(items)
        if len(items) < per_page:
            break
        page += 1
        time.sleep(0.7)  # stay well within 5000/hr

    # Aggregate secondary topics (exclude the query topic itself)
    all_topics: list[str] = []
    for repo in collected:
        for t in repo.get("topics", []):
            if t != query_topic:
                all_topics.append(t)

    counts = Counter(all_topics)
    H_pi = shannon(counts)
    H_cs = chao_shen(counts)
    top = sorted(counts.items(), key=lambda x: -x[1])[:20]
    return {
        "n_repos": len(collected),
        "n_distinct_topics": len(counts),
        "n_topic_instances": len(all_topics),
        "H_plugin": round(H_pi, 4),
        "H_cs": round(H_cs, 4),
        "S_eff": round(seff(H_cs), 1),
        "top_topics": top,
    }

# ── npm: fetch packages by keyword, collect secondary keywords ───────────────
def npm_keyword_entropy(keyword: str, max_packages: int = 500):
    """
    Search npm for packages matching keyword, collect all package keywords,
    compute entropy of keyword distribution.
    """
    all_keywords: list[str] = []
    collected = 0
    size = 250
    from_ = 0
    while collected < max_packages:
        url = "https://registry.npmjs.org/-/v1/search"
        params = {"text": f"keywords:{keyword}", "size": min(size, max_packages - collected), "from": from_}
        r = requests.get(url, params=params, timeout=30)
        if r.status_code != 200:
            break
        data = r.json()
        objects = data.get("objects", [])
        if not objects:
            break
        for obj in objects:
            kws = obj.get("package", {}).get("keywords") or []
            for k in kws:
                k = k.lower().strip()
                if k != keyword:
                    all_keywords.append(k)
        collected += len(objects)
        from_ += len(objects)
        if len(objects) < size:
            break
        time.sleep(0.5)

    counts = Counter(all_keywords)
    H_pi = shannon(counts)
    H_cs = chao_shen(counts)
    top = sorted(counts.items(), key=lambda x: -x[1])[:20]
    return {
        "n_packages": collected,
        "n_distinct_keywords": len(counts),
        "H_plugin": round(H_pi, 4),
        "H_cs": round(H_cs, 4),
        "S_eff": round(seff(H_cs), 1),
        "top_keywords": top,
    }

# ── PyPI: use search via libraries.io-style trick (no auth needed) ───────────
def pypi_keyword_entropy(keyword: str, max_packages: int = 300):
    """
    Use PyPI simple index + search to collect packages by category keyword,
    measure keyword/classifier diversity.
    Falls back to libraries.io-free endpoints.
    """
    # PyPI JSON search isn't great, use XML-RPC
    import xmlrpc.client
    client = xmlrpc.client.ServerProxy("https://pypi.org/pypi")
    try:
        results = client.search({"keywords": keyword}, "and")[:max_packages]
    except Exception as e:
        print(f"  PyPI XML-RPC error: {e}")
        return None

    all_classifiers: list[str] = []
    for pkg in results[:max_packages]:
        name = pkg.get("name", "")
        try:
            r = requests.get(f"https://pypi.org/pypi/{name}/json", timeout=10)
            if r.status_code == 200:
                classifiers = r.json().get("info", {}).get("classifiers", [])
                # Use topic classifiers (second level)
                for c in classifiers:
                    parts = c.split(" :: ")
                    if len(parts) >= 2 and parts[0] in ("Topic", "Intended Audience", "Programming Language"):
                        all_classifiers.append(parts[1])
            time.sleep(0.3)
        except Exception:
            continue

    if not all_classifiers:
        return None
    counts = Counter(all_classifiers)
    H_pi = shannon(counts)
    H_cs = chao_shen(counts)
    return {
        "n_packages": len(results),
        "n_distinct_classifiers": len(counts),
        "H_plugin": round(H_pi, 4),
        "H_cs": round(H_cs, 4),
        "S_eff": round(seff(H_cs), 1),
        "top_classifiers": sorted(counts.items(), key=lambda x: -x[1])[:15],
    }

# ── Main collection runs ─────────────────────────────────────────────────────

GITHUB_ECOSYSTEMS = [
    # (topic_tag, display_name, market_context, expected_rank)
    # --- L1 Blockchain (2018+) ---
    ("ethereum",    "Ethereum",    "L1 blockchain developer ecosystem",      1),
    ("bitcoin",     "Bitcoin",     "L1 blockchain developer ecosystem",      2),
    ("solana",      "Solana",      "L1 blockchain developer ecosystem",      3),
    # --- Mobile OS (2012+) ---
    ("android",     "Android",     "Mobile OS developer ecosystem",          1),
    ("ios",         "iOS",         "Mobile OS developer ecosystem",          2),
    # --- Frontend frameworks (2019+) ---
    ("react",       "React",       "Frontend JS framework ecosystem",        1),
    ("angular",     "Angular",     "Frontend JS framework ecosystem",        2),
    ("vue",         "Vue",         "Frontend JS framework ecosystem",        3),
    ("svelte",      "Svelte",      "Frontend JS framework ecosystem",        4),
    # --- AI/LLM assistants (2023+) ---
    ("openai",      "OpenAI/GPT",  "LLM developer ecosystem",               1),
    ("langchain",   "LangChain",   "LLM developer ecosystem",               2),
    # --- Cloud infra ---
    ("aws",         "AWS",         "Cloud platform ecosystem",              1),
    ("azure",       "Azure",       "Cloud platform ecosystem",              2),
    ("google-cloud","GCP",         "Cloud platform ecosystem",              3),
]

NPM_ECOSYSTEMS = [
    ("react",   "React",   "Frontend framework"),
    ("angular", "Angular", "Frontend framework"),
    ("vue",     "Vue",     "Frontend framework"),
    ("svelte",  "Svelte",  "Frontend framework"),
    ("ethereum","Ethereum","Web3 / Blockchain"),
    ("bitcoin", "Bitcoin", "Web3 / Blockchain"),
    ("solana",  "Solana",  "Web3 / Blockchain"),
    ("openai",  "OpenAI",  "LLM tooling"),
    ("langchain","LangChain","LLM tooling"),
]

def run_all():
    results = {"github": {}, "npm": {}, "metadata": {}}
    results["metadata"]["timestamp"] = datetime.utcnow().isoformat()

    print("=" * 60)
    print("GITHUB ECOSYSTEM ENTROPY")
    print("=" * 60)
    for topic, name, context, rank in GITHUB_ECOSYSTEMS:
        print(f"\n[GitHub] {name} (topic:{topic}) ...", flush=True)
        res = github_topic_entropy(topic, min_stars=5, max_repos=1000)
        res["name"] = name
        res["context"] = context
        res["expected_rank"] = rank
        results["github"][topic] = res
        print(
            f"  repos={res['n_repos']}, distinct_topics={res['n_distinct_topics']}, "
            f"H_plugin={res['H_plugin']:.3f}, H_CS={res['H_cs']:.3f}, S_eff={res['S_eff']:.0f}",
            flush=True,
        )

    print("\n" + "=" * 60)
    print("NPM PACKAGE ECOSYSTEM ENTROPY")
    print("=" * 60)
    for kw, name, context in NPM_ECOSYSTEMS:
        print(f"\n[npm]    {name} (keyword:{kw}) ...", flush=True)
        res = npm_keyword_entropy(kw, max_packages=500)
        res["name"] = name
        res["context"] = context
        results["npm"][kw] = res
        print(
            f"  packages={res['n_packages']}, distinct_kw={res['n_distinct_keywords']}, "
            f"H_CS={res['H_cs']:.3f}, S_eff={res['S_eff']:.0f}",
            flush=True,
        )

    # Save raw results
    out_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(out_dir, "results.json"), "w") as f:
        json.dump(results, f, indent=2, default=str)
    print("\nSaved results.json")

    # Print summary table
    print_summary(results)
    return results


def print_summary(results):
    print("\n" + "=" * 80)
    print("SUMMARY TABLE — GitHub Topic Entropy (H_CS, nats)")
    print("=" * 80)
    print(f"{'Platform':<16} {'Context':<35} {'Repos':>6} {'Topics':>7} {'H_CS':>7} {'S_eff':>7}")
    print("-" * 80)
    for topic, d in results["github"].items():
        print(
            f"{d['name']:<16} {d['context']:<35} {d['n_repos']:>6} "
            f"{d['n_distinct_topics']:>7} {d['H_cs']:>7.3f} {d['S_eff']:>7.0f}"
        )

    print("\n" + "=" * 80)
    print("SUMMARY TABLE — npm Package Ecosystem Entropy (H_CS, nats)")
    print("=" * 80)
    print(f"{'Platform':<14} {'Context':<26} {'Pkgs':>6} {'Keywords':>9} {'H_CS':>7} {'S_eff':>7}")
    print("-" * 80)
    for kw, d in results["npm"].items():
        print(
            f"{d['name']:<14} {d['context']:<26} {d['n_packages']:>6} "
            f"{d['n_distinct_keywords']:>9} {d['H_cs']:>7.3f} {d['S_eff']:>7.0f}"
        )


if __name__ == "__main__":
    run_all()
