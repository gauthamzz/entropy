"""
npm download trends for frontend framework market-share proxy.

Fetches annual download counts from the public npm Downloads API:
  https://api.npmjs.org/downloads/range/{start}:{end}/{package}

No authentication required. Rate limit: 5 req/s (we use 1 req/s).

Packages: react, angularjs, @angular/core, vue, svelte
Date range: 2014-01-01 to 2024-12-31 (annual slices)

Output: npm_data.json with annual download counts and market-share
fractions (react_share = react / (react + angular_total + vue + svelte))
where angular_total = angularjs + @angular/core.

Usage:
    python data/npm_downloads.py      # writes npm_data.json
"""

import json, time, os
try:
    import requests
except ImportError:
    requests = None

BASE = os.path.dirname(os.path.abspath(__file__))

PACKAGES = ["react", "angularjs", "@angular/core", "vue", "svelte"]
YEARS = list(range(2014, 2025))


def fetch_annual(package: str, year: int) -> int:
    """Return total downloads for `package` in `year`."""
    if requests is None:
        return 0
    url = (
        f"https://api.npmjs.org/downloads/range/"
        f"{year}-01-01:{year}-12-31/{package}"
    )
    try:
        r = requests.get(url, timeout=20)
        if r.status_code != 200:
            return 0
        data = r.json()
        return sum(w["downloads"] for w in data.get("downloads", []))
    except Exception:
        return 0


def main():
    raw = {}
    for pkg in PACKAGES:
        raw[pkg] = {}
        for yr in YEARS:
            count = fetch_annual(pkg, yr)
            raw[pkg][str(yr)] = count
            print(f"  {pkg} {yr}: {count:,}")
            time.sleep(0.25)

    # Build market-share table
    share = {}
    for yr in YEARS:
        r   = raw["react"].get(str(yr), 0)
        ajs = raw["angularjs"].get(str(yr), 0)
        ang = raw["@angular/core"].get(str(yr), 0)
        v   = raw["vue"].get(str(yr), 0)
        s   = raw["svelte"].get(str(yr), 0)
        total = r + ajs + ang + v + s
        ang_total = ajs + ang
        share[str(yr)] = {
            "react":         r,
            "angularjs":     ajs,
            "angular_core":  ang,
            "vue":           v,
            "svelte":        s,
            "angular_total": ang_total,
            "total":         total,
            "react_share":   round(r / total, 4) if total > 0 else None,
            "react_share_vs_angular": round(
                r / (r + ang_total), 4) if (r + ang_total) > 0 else None,
        }

    out = {"raw": raw, "annual_share": share}
    with open(os.path.join(BASE, "npm_data.json"), "w") as f:
        json.dump(out, f, indent=2)
    print("\nWrote npm_data.json")

    print()
    print(f"{'Year':<6} {'React share':>12} {'React share vs Angular':>22}")
    for yr in YEARS:
        row = share[str(yr)]
        rs = f"{row['react_share']*100:.1f}%" if row["react_share"] else "n/a"
        rv = f"{row['react_share_vs_angular']*100:.1f}%" if row["react_share_vs_angular"] else "n/a"
        print(f"{yr:<6} {rs:>12} {rv:>22}")


if __name__ == "__main__":
    main()
