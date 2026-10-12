# Cross-era model pipeline

The Next.js app is the visual layer. This directory contains the reproducible
Python model that generates `data/cross-era-snapshot.json`.

It downloads the free F1DB CSV release, constructs same-constructor teammate
observations for qualifying and clean classified race results, then fits a
time-aware Bradley–Terry model. A driver has a separate latent strength for
each season; adjacent seasons are regularised together rather than treated as
one fixed career rating.

```powershell
python -m pip install -r python/requirements.txt
python python/build_cross_era_snapshot.py
```

Use `--cache python/.cache/f1db-csv.zip` to cache the source archive, or
`--input <archive.zip>` to run offline from an existing archive.
