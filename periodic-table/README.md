# 3D Periodic Table (CHM 1025)

A 3D periodic table where every value shows its source. See [PLAN.md](PLAN.md) for the full plan. Stage 1 (sourced property table) is built.

## Run locally

```
python -m http.server 8765 --directory periodic-table/site
```

Then open http://localhost:8765. (The page loads JSON, so it needs a local server; opening the file directly won't work.)

## Rebuild the data

```
cd periodic-table/pipeline
python -I fetch.py    # downloads sources into raw/ (not committed) and updates manifest.json
python -I build.py    # writes site/data/*.json, out/crosscheck.md and SOURCES.md; fails on any unsourced value
```

- `manifest.json`: every source file's URL, SHA-256 hash and retrieval date. A changed hash is printed as `CHANGED`.
- `out/crosscheck.md`: every value that differs from, or couldn't be confirmed by, a second source.
- `REVIEW.md`: the decision made for each disagreement and model choice.
- `SOURCES.md`: full citations and licenses.
