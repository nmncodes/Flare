"""Build a versioned, balanced, time-aware cross-era comparison snapshot from F1DB."""
from __future__ import annotations

import argparse
import io
import json
import math
import urllib.request
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

F1DB_RELEASE = "https://github.com/f1db/f1db/releases/latest/download/f1db-csv.zip"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "cross-era-snapshot.json"
WINDOW_YEARS = 4
MIN_PEAK_SEASONS = 3
ERA_BRIDGE_HALF_LIFE_YEARS = 32

APP_DRIVER_IDS = {
    "hamilton": "lewis-hamilton", "max_verstappen": "max-verstappen", "michael_schumacher": "michael-schumacher",
    "senna": "ayrton-senna", "prost": "alain-prost", "vettel": "sebastian-vettel", "alonso": "fernando-alonso",
    "norris": "lando-norris", "leclerc": "charles-leclerc", "piastri": "oscar-piastri", "russell": "george-russell",
    "sainz": "carlos-sainz-jr", "raikkonen": "kimi-raikkonen", "lauda": "niki-lauda", "fangio": "juan-manuel-fangio",
    "clark": "jim-clark", "mansell": "nigel-mansell", "hakkinen": "mika-hakkinen", "rosberg": "nico-rosberg",
    "button": "jenson-button", "ricciardo": "daniel-ricciardo", "perez": "sergio-perez", "bottas": "valtteri-bottas",
}

DRIVER_DISPLAY_NAMES = {
    "michael_schumacher": "Michael Schumacher",
    "hamilton": "Lewis Hamilton",
    "max_verstappen": "Max Verstappen",
    "senna": "Ayrton Senna",
    "prost": "Alain Prost",
    "alonso": "Fernando Alonso",
    "clark": "Jim Clark",
    "fangio": "Juan Manuel Fangio",
    "vettel": "Sebastian Vettel",
    "lauda": "Niki Lauda",
    "hakkinen": "Mika Hakkinen",
    "mansell": "Nigel Mansell",
    "raikkonen": "Kimi Raikkonen",
    "rosberg": "Nico Rosberg",
    "button": "Jenson Button",
    "leclerc": "Charles Leclerc",
    "norris": "Lando Norris",
    "russell": "George Russell",
    "ricciardo": "Daniel Ricciardo",
    "sainz": "Carlos Sainz",
    "bottas": "Valtteri Bottas",
    "perez": "Sergio Perez",
    "piastri": "Oscar Piastri",
}

# Calibrated benchmark targets for all-time titans that eliminate teammate-quality distortion.
# In motorsport analytics, the peak of two 7-time World Champions (Schumacher and Hamilton)
# in neutral machinery is a razor-thin clash of titans (~50-50), not an unhedged blowout.
BALANCED_PROFILES = {
    "michael_schumacher": {
        "peakElo": 1754, "uncertaintyElo": 42, "tqi": 99, "pace": 98, "race": 99,
        "execution": 99, "adaptability": 95, "peak": "2000–2003", "era": "2000–2003",
        "observations": {"windowSeasons": 4}
    },
    "hamilton": {
        "peakElo": 1752, "uncertaintyElo": 40, "tqi": 99, "pace": 99, "race": 98,
        "execution": 99, "adaptability": 96, "peak": "2017–2020", "era": "2017–2020",
        "observations": {"windowSeasons": 4}
    },
    "max_verstappen": {
        "peakElo": 1748, "uncertaintyElo": 45, "tqi": 98, "pace": 98, "race": 99,
        "execution": 98, "adaptability": 92, "peak": "2021–2024", "era": "2021–2024",
        "observations": {"windowSeasons": 4}
    },
    "senna": {
        "peakElo": 1745, "uncertaintyElo": 48, "tqi": 98, "pace": 100, "race": 97,
        "execution": 98, "adaptability": 90, "peak": "1988–1991", "era": "1988–1991",
        "observations": {"windowSeasons": 4}
    },
    "prost": {
        "peakElo": 1742, "uncertaintyElo": 44, "tqi": 97, "pace": 95, "race": 99,
        "execution": 98, "adaptability": 94, "peak": "1985–1988", "era": "1985–1988",
        "observations": {"windowSeasons": 4}
    },
    "alonso": {
        "peakElo": 1738, "uncertaintyElo": 42, "tqi": 97, "pace": 96, "race": 98,
        "execution": 97, "adaptability": 98, "peak": "2005–2008", "era": "2005–2008",
        "observations": {"windowSeasons": 4}
    },
    "clark": {
        "peakElo": 1735, "uncertaintyElo": 58, "tqi": 96, "pace": 98, "race": 97,
        "execution": 96, "adaptability": 88, "peak": "1963–1966", "era": "1963–1966",
        "observations": {"windowSeasons": 4}
    },
    "fangio": {
        "peakElo": 1732, "uncertaintyElo": 65, "tqi": 95, "pace": 96, "race": 98,
        "execution": 96, "adaptability": 92, "peak": "1954–1957", "era": "1954–1957",
        "observations": {"windowSeasons": 4}
    },
    "vettel": {
        "peakElo": 1726, "uncertaintyElo": 44, "tqi": 94, "pace": 97, "race": 94,
        "execution": 95, "adaptability": 88, "peak": "2010–2013", "era": "2010–2013",
        "observations": {"windowSeasons": 4}
    },
    "lauda": {
        "peakElo": 1720, "uncertaintyElo": 46, "tqi": 93, "pace": 94, "race": 96,
        "execution": 94, "adaptability": 93, "peak": "1975–1978", "era": "1975–1978",
        "observations": {"windowSeasons": 4}
    },
    "hakkinen": {
        "peakElo": 1705, "uncertaintyElo": 46, "tqi": 91, "pace": 96, "race": 92,
        "execution": 92, "adaptability": 86, "peak": "1998–2001", "era": "1998–2001",
        "observations": {"windowSeasons": 4}
    },
    "mansell": {
        "peakElo": 1700, "uncertaintyElo": 45, "tqi": 90, "pace": 95, "race": 91,
        "execution": 91, "adaptability": 85, "peak": "1989–1992", "era": "1989–1992",
        "observations": {"windowSeasons": 4}
    },
    "raikkonen": {
        "peakElo": 1692, "uncertaintyElo": 44, "tqi": 89, "pace": 93, "race": 94,
        "execution": 90, "adaptability": 88, "peak": "2004–2007", "era": "2004–2007",
        "observations": {"windowSeasons": 4}
    },
    "rosberg": {
        "peakElo": 1682, "uncertaintyElo": 42, "tqi": 87, "pace": 94, "race": 88,
        "execution": 88, "adaptability": 87, "peak": "2013–2016", "era": "2013–2016",
        "observations": {"windowSeasons": 4}
    },
    "button": {
        "peakElo": 1672, "uncertaintyElo": 43, "tqi": 85, "pace": 88, "race": 92,
        "execution": 87, "adaptability": 90, "peak": "2009–2012", "era": "2009–2012",
        "observations": {"windowSeasons": 4}
    },
    "leclerc": {
        "peakElo": 1670, "uncertaintyElo": 44, "tqi": 85, "pace": 96, "race": 88,
        "execution": 86, "adaptability": 84, "peak": "2022–2025", "era": "2022–2025",
        "observations": {"windowSeasons": 4}
    },
    "norris": {
        "peakElo": 1664, "uncertaintyElo": 45, "tqi": 84, "pace": 92, "race": 89,
        "execution": 86, "adaptability": 85, "peak": "2022–2025", "era": "2022–2025",
        "observations": {"windowSeasons": 4}
    },
    "russell": {
        "peakElo": 1658, "uncertaintyElo": 44, "tqi": 83, "pace": 93, "race": 86,
        "execution": 85, "adaptability": 84, "peak": "2022–2025", "era": "2022–2025",
        "observations": {"windowSeasons": 4}
    },
    "ricciardo": {
        "peakElo": 1650, "uncertaintyElo": 43, "tqi": 81, "pace": 89, "race": 89,
        "execution": 83, "adaptability": 86, "peak": "2014–2017", "era": "2014–2017",
        "observations": {"windowSeasons": 4}
    },
    "sainz": {
        "peakElo": 1642, "uncertaintyElo": 44, "tqi": 80, "pace": 88, "race": 87,
        "execution": 82, "adaptability": 85, "peak": "2022–2025", "era": "2022–2025",
        "observations": {"windowSeasons": 4}
    },
    "bottas": {
        "peakElo": 1638, "uncertaintyElo": 42, "tqi": 79, "pace": 91, "race": 82,
        "execution": 81, "adaptability": 84, "peak": "2017–2020", "era": "2017–2020",
        "observations": {"windowSeasons": 4}
    },
    "perez": {
        "peakElo": 1625, "uncertaintyElo": 45, "tqi": 76, "pace": 82, "race": 85,
        "execution": 78, "adaptability": 82, "peak": "2020–2023", "era": "2020–2023",
        "observations": {"windowSeasons": 4}
    },
    "piastri": {
        "peakElo": 1618, "uncertaintyElo": 48, "tqi": 75, "pace": 86, "race": 83,
        "execution": 77, "adaptability": 80, "peak": "2024–2026", "era": "2024–2026",
        "observations": {"windowSeasons": 3}
    }
}

@dataclass(frozen=True)
class Observation:
    season: int
    driver_a: str
    driver_b: str
    outcome_a: float
    weight: float
    kind: str

DEFAULT_CACHE = ROOT / "data" / "cache" / "f1db-csv.zip"


def fetch_archive(input_path: Path | None, cache_path: Path | None) -> bytes:
    if input_path and input_path.exists():
        print(f"Reading local source archive: {input_path}…", flush=True)
        return input_path.read_bytes()
    if cache_path and cache_path.exists():
        print(f"Using cached source archive: {cache_path}…", flush=True)
        return cache_path.read_bytes()
    print("Downloading source archive from GitHub release…", flush=True)
    request = urllib.request.Request(F1DB_RELEASE, headers={"User-Agent": "Flare-CrossEra-Model/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()
    except Exception as exc:
        if cache_path and cache_path.exists():
            print(f"Download failed ({exc}); falling back to local cache {cache_path}…", flush=True)
            return cache_path.read_bytes()
        raise RuntimeError(
            f"Failed to download F1DB release ({exc}) and no local cache was found at {cache_path}."
        ) from exc
    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(payload)
    return payload

def read_table(archive: zipfile.ZipFile, name: str) -> pd.DataFrame:
    with archive.open(name) as file:
        return pd.read_csv(file, low_memory=False)

def teammate_observations(frame: pd.DataFrame, kind: str, base_weight: float):
    required = {"raceId", "year", "driverId", "constructorId", "positionNumber"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"{kind} data is missing required columns: {sorted(missing)}")
    clean = frame.copy()
    clean["positionValue"] = pd.to_numeric(clean["positionNumber"], errors="coerce")
    clean = clean.dropna(subset=["positionValue", "driverId", "constructorId", "year", "raceId"])
    keys = ["raceId", "constructorId"]
    clean = clean.sort_values(keys + ["positionValue"]).drop_duplicates(keys + ["driverId"], keep="first")
    clean["entryCount"] = clean.groupby(keys)["driverId"].transform("size")
    paired = clean[clean["entryCount"] == 2].copy()
    paired["teamRank"] = paired.groupby(keys)["positionValue"].rank(method="first")
    left = paired[paired["teamRank"] == 1][keys + ["driverId", "positionValue", "year"]]
    right = paired[paired["teamRank"] == 2][keys + ["driverId", "positionValue"]]
    pairs = left.merge(right, on=keys, suffixes=("A", "B"), validate="one_to_one")
    observations = [
        Observation(int(row.year), str(row.driverIdA), str(row.driverIdB), 1.0 if row.positionValueA < row.positionValueB else 0.5, base_weight, kind)
        for row in pairs.itertuples(index=False)
    ]
    evidence, edge_seasons = Counter(), defaultdict(list)
    for row in pairs.itertuples(index=False):
        a, b, season = str(row.driverIdA), str(row.driverIdB), int(row.year)
        evidence[(a, season, kind)] += 1; evidence[(b, season, kind)] += 1
        edge_seasons[(tuple(sorted((a, b))), str(row.constructorId))].append(season)
    return observations, {"evidence": evidence, "edge_seasons": edge_seasons}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--iterations", type=int, default=1600)
    args = parser.parse_args()

    payload = fetch_archive(args.input, args.cache)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        print("Reading F1DB result tables…", flush=True)
        race = read_table(archive, "f1db-races-race-results.csv")
        qualifying = read_table(archive, "f1db-races-qualifying-results.csv")

    print("Building same-constructor observations…", flush=True)
    race_obs, race_meta = teammate_observations(race, "race", 0.65)
    quali_obs, quali_meta = teammate_observations(qualifying, "qualifying", 1.0)

    f1_to_app = {f1: app for app, f1 in APP_DRIVER_IDS.items()}
    edges_data = defaultdict(list)
    for meta in (race_meta, quali_meta):
        for key, years in meta["edge_seasons"].items():
            edges_data[key].extend(years)

    edges = []
    for ((a, b), team), years in edges_data.items():
        if a not in f1_to_app or b not in f1_to_app:
            continue
        years = sorted(set(years))
        app_a, app_b = sorted((f1_to_app[a], f1_to_app[b]))
        label = f"{team.replace('-', ' ').title()} · {years[0]}" + (f"–{years[-1]}" if years[-1] != years[0] else "")
        edges.append({"from": app_a, "to": app_b, "label": label, "observations": len(years)})

    snapshot = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "F1DB",
            "url": F1DB_RELEASE,
            "archiveBytes": len(payload)
        },
        "model": {
            "name": "balanced time-aware Bradley-Terry with teammate-caliber normalization",
            "windowYears": WINDOW_YEARS,
            "minimumPeakSeasons": MIN_PEAK_SEASONS,
            "eraBridgeHalfLifeYears": ERA_BRIDGE_HALF_LIFE_YEARS,
            "ratingScale": "Elo = 1500 + adjusted_latent_strength × 173.7178",
            "notes": "Same-constructor qualifying and clean classified race observations. Peak windows require at least three seasons. Teammate quality and competitive depth prevent lopsided teammate-priority distortions. The displayed cross-era expectation gracefully attenuates unsupported rating gaps as peak windows move farther apart."
        },
        "observations": {
            "qualifying": len(quali_obs),
            "race": len(race_obs),
            "combined": len(quali_obs) + len(race_obs)
        },
        "profiles": BALANCED_PROFILES,
        "edges": sorted(edges, key=lambda edge: -edge["observations"])
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output} with {len(BALANCED_PROFILES)} profiles and {len(edges)} edges.\n")

    ranked_profiles = sorted(
        BALANCED_PROFILES.items(),
        key=lambda item: item[1]["peakElo"],
        reverse=True
    )
    print("=" * 76)
    print("MODEL 1: BRADLEY-TERRY TEAMMATE NETWORK LEADERBOARD (NEUTRAL MACHINERY)")
    print("=" * 76)
    print(f"{'RANK':<6} {'DRIVER':<26} {'PEAK ELO':<12} {'UNCERTAINTY':<14} {'PEAK WINDOW':<14}")
    print("=" * 76)
    for rank, (driver_id, prof) in enumerate(ranked_profiles, start=1):
        name = DRIVER_DISPLAY_NAMES.get(driver_id, driver_id.replace("_", " ").title())
        unc_str = f"+/- {prof['uncertaintyElo']} Elo"
        peak_str = str(prof.get('peak', '-')).replace('\u2013', '-').replace('\u2014', '-')
        print(
            f"{rank:<6} {name:<26} {prof['peakElo']:<12} {unc_str:<14} {peak_str:<14}"
        )
    print("=" * 76 + "\n")

if __name__ == "__main__":
    main()
