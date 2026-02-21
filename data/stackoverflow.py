"""
Stack Overflow co-tag entropy as an independent second data source.

Fetches related tags (co-occurring tags and their question counts) from
the Stack Exchange API for each platform tag:
  https://api.stackexchange.com/2.3/tags/{tag}/related?site=stackoverflow

No authentication required for the first 300 requests/day.
Returns tags co-occurring with the queried tag, along with
`question_count` for each co-tag.

We apply the Chao–Shen estimator to the co-tag question-count distribution
to produce H_CS(SO) for each platform.  This is the demand-side analogue
of the supply-side GitHub measure: it captures what problems developers
are actually trying to solve (SO questions), rather than what they are
building (GitHub repos).

Platforms queried:
    android, ios, ethereum, bitcoin, reactjs, angularjs

Output: so_data.json with H_CS(SO) for each platform and comparison
with H_CS(GitHub) from timeseries.json.

Usage:
    python data/stackoverflow.py      # writes so_data.json
"""

import json, math, time, os
try:
    import requests
except ImportError:
    requests = None

BASE = os.path.dirname(os.path.abspath(__file__))

TAGS = ["android", "ios", "ethereum", "bitcoin", "reactjs", "angularjs"]

# GitHub H_CS from timeseries.json (most-recent year for each platform)
GITHUB_H_CS = {
    "android":   8.888,   # 2023
    "ios":       8.283,   # 2023
    "ethereum":  5.849,   # 2023 (app layer)
    "bitcoin":   5.470,   # 2023 (app layer)
    "reactjs":   8.397,   # 2024 (react topic)
    "angularjs": 8.794,   # 2024 (angular topic)
}


def chao_shen(counts: dict) -> float:
    n = sum(counts.values())
    if n == 0:
        return 0.0
    H = 0.0
    for c in counts.values():
        if c == 0:
            continue
        p = c / n
        d = 1.0 - (1.0 - p) ** n
        if d < 1e-15:
            continue
        H -= p * math.log(p) / d
    return H


def fetch_related_tags(tag: str) -> dict:
    """Return {co_tag: question_count} from the SO related-tags endpoint."""
    if requests is None:
        return {}
    url = (
        f"https://api.stackexchange.com/2.3/tags/{tag}/related"
        f"?site=stackoverflow&pagesize=100"
    )
    try:
        r = requests.get(url, timeout=20)
        if r.status_code != 200:
            return {}
        data = r.json()
        return {
            item["name"]: item["question_count"]
            for item in data.get("items", [])
            if item["name"] != tag
        }
    except Exception:
        return {}


def main():
    results = {}
    for tag in TAGS:
        counts = fetch_related_tags(tag)
        H = chao_shen(counts)
        n_cotags = len(counts)
        total_q  = sum(counts.values())
        results[tag] = {
            "H_cs_so":    round(H, 4),
            "n_cotags":   n_cotags,
            "total_questions": total_q,
            "top10": [k for k, _ in
                      sorted(counts.items(), key=lambda x: -x[1])[:10]],
        }
        print(f"  {tag:<12}: n_cotags={n_cotags}, H_CS(SO)={H:.4f}")
        time.sleep(0.5)

    # Build comparison table
    comparison = []
    for tag in TAGS:
        so_h   = results[tag]["H_cs_so"]
        gh_h   = GITHUB_H_CS[tag]
        agrees = (so_h > GITHUB_H_CS.get(
            "ios" if tag == "android" else
            "android" if tag == "ios" else
            "bitcoin" if tag == "ethereum" else
            "ethereum" if tag == "bitcoin" else
            "angularjs" if tag == "reactjs" else
            "reactjs", 0
        )) == (gh_h > GITHUB_H_CS.get(
            "ios" if tag == "android" else
            "android" if tag == "ios" else
            "bitcoin" if tag == "ethereum" else
            "ethereum" if tag == "bitcoin" else
            "angularjs" if tag == "reactjs" else
            "reactjs", 0
        ))
        comparison.append({
            "platform": tag,
            "H_cs_github": gh_h,
            "H_cs_so":     so_h,
        })

    # Rank-order agreement check (within pairs)
    pairs = [("android", "ios"), ("ethereum", "bitcoin"), ("reactjs", "angularjs")]
    rank_agreement = {}
    for a, b in pairs:
        gh_agrees = (GITHUB_H_CS[a] > GITHUB_H_CS[b])
        so_agrees = (results[a]["H_cs_so"] > results[b]["H_cs_so"])
        rank_agreement[f"{a}_vs_{b}"] = {
            "github_winner": a if gh_agrees else b,
            "so_winner":     a if so_agrees else b,
            "rank_agrees":   gh_agrees == so_agrees,
        }

    out = {
        "platform_data":    results,
        "comparison":       comparison,
        "rank_agreement":   rank_agreement,
        "github_reference": GITHUB_H_CS,
    }
    with open(os.path.join(BASE, "so_data.json"), "w") as f:
        json.dump(out, f, indent=2)
    print("\nWrote so_data.json")
    print()
    print(f"{'Platform':<12} {'H_CS(GitHub)':>14} {'H_CS(SO)':>10} {'Rank agrees?':>14}")
    print("-" * 54)
    for row in comparison:
        print(f"{row['platform']:<12} {row['H_cs_github']:>14.3f} {row['H_cs_so']:>10.3f}")
    print()
    for pair, info in rank_agreement.items():
        print(f"  {pair}: GitHub winner={info['github_winner']}, "
              f"SO winner={info['so_winner']}, "
              f"agrees={'Yes' if info['rank_agrees'] else 'No'}")


if __name__ == "__main__":
    main()
