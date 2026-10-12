"""Build a versioned, time-aware cross-era comparison snapshot from F1DB."""
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
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd

F1DB_RELEASE = "https://github.com/f1db/f1db/releases/latest/download/f1db-csv.zip"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "cross-era-snapshot.json"
WINDOW_YEARS = 4

APP_DRIVER_IDS = {
    "hamilton": "lewis-hamilton", "max_verstappen": "max-verstappen", "michael_schumacher": "michael-schumacher",
    "senna": "ayrton-senna", "prost": "alain-prost", "vettel": "sebastian-vettel", "alonso": "fernando-alonso",
    "norris": "lando-norris", "leclerc": "charles-leclerc", "piastri": "oscar-piastri", "russell": "george-russell",
    "sainz": "carlos-sainz-jr", "raikkonen": "kimi-raikkonen", "lauda": "niki-lauda", "fangio": "juan-manuel-fangio",
    "clark": "jim-clark", "mansell": "nigel-mansell", "hakkinen": "mika-hakkinen", "rosberg": "nico-rosberg",
    "button": "jenson-button", "ricciardo": "daniel-ricciardo", "perez": "sergio-perez", "bottas": "valtteri-bottas",
}

@dataclass(frozen=True)
class Observation:
    season: int
    driver_a: str
    driver_b: str
    outcome_a: float
    weight: float
    kind: str

def fetch_archive(input_path: Path | None, cache_path: Path | None) -> bytes:
    if input_path:
        return input_path.read_bytes()
    if cache_path and cache_path.exists():
        return cache_path.read_bytes()
    request = urllib.request.Request(F1DB_RELEASE, headers={"User-Agent": "Flare-CrossEra-Model/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = response.read()
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
    # Vectorised pairing avoids treating older customer-chassis fields as
    # teammate groups and keeps full-history ingestion comfortably fast.
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

def build_index(observations):
    keys = sorted({(o.driver_a, o.season) for o in observations} | {(o.driver_b, o.season) for o in observations})
    index = {key: i for i, key in enumerate(keys)}
    a = np.array([index[(o.driver_a, o.season)] for o in observations], dtype=np.int32)
    b = np.array([index[(o.driver_b, o.season)] for o in observations], dtype=np.int32)
    y = np.array([o.outcome_a for o in observations])
    w = np.array([o.weight for o in observations])
    return index, a, b, y, w

def smoothing_edges(index):
    per_driver = defaultdict(list)
    for (driver, season), i in index.items():
        per_driver[driver].append((season, i))
    left, right = [], []
    for entries in per_driver.values():
        entries.sort()
        for (season_a, i), (season_b, j) in zip(entries, entries[1:]):
            if season_b - season_a <= 2:
                left.append(i); right.append(j)
    return np.array(left, dtype=np.int32), np.array(right, dtype=np.int32)

def fit_dynamic_bt(observations, iterations):
    index, a, b, y, weight = build_index(observations)
    by_driver = defaultdict(list)
    for (driver, season), position in index.items():
        by_driver[driver].append((season, position))
    for entries in by_driver.values():
        entries.sort()
    count, total = len(index), max(weight.sum(), 1.0)
    left, right = smoothing_edges(index)
    theta = np.zeros(count); m = np.zeros(count); v = np.zeros(count)
    # Likelihood gradients are normalised by total evidence, so priors must be
    # on the same scale. A tiny ridge anchors disconnected components without
    # collapsing every fitted season toward zero.
    l2, smooth, lr = 0.00001, 0.09, 0.07
    for step in range(1, iterations + 1):
        p = 1 / (1 + np.exp(-np.clip(theta[a] - theta[b], -30, 30)))
        residual = weight * (p - y) / total
        gradient = l2 * theta
        np.add.at(gradient, a, residual); np.add.at(gradient, b, -residual)
        if len(left):
            delta = theta[left] - theta[right]
            np.add.at(gradient, left, smooth * delta / len(left))
            np.add.at(gradient, right, -smooth * delta / len(left))
        m = .9 * m + .1 * gradient; v = .999 * v + .001 * gradient ** 2
        theta -= lr * (m / (1 - .9 ** step)) / (np.sqrt(v / (1 - .999 ** step)) + 1e-8)
        theta -= theta.mean()
    p = 1 / (1 + np.exp(-np.clip(theta[a] - theta[b], -30, 30)))
    info = np.full(count, l2); curvature = weight * p * (1 - p)
    np.add.at(info, a, curvature); np.add.at(info, b, curvature)
    if len(left):
        np.add.at(info, left, smooth); np.add.at(info, right, smooth)
    return {"index": index, "by_driver": by_driver, "theta": theta, "se": 1 / np.sqrt(np.maximum(info, 1e-8))}

def peak(fit, driver):
    entries = fit["by_driver"].get(driver, [])
    if not entries:
        return None
    candidates = []
    for start, (year, _) in enumerate(entries):
        window = [(season, i) for season, i in entries[start:] if season - year < WINDOW_YEARS]
        if len(window) >= 2:
            ix = [i for _, i in window]
            candidates.append((float(fit["theta"][ix].mean()), float(np.sqrt((fit["se"][ix] ** 2).sum()) / len(ix)) * 1.35, year, window[-1][0], len(ix)))
    if not candidates:
        year, i = entries[0]
        return {"strength": float(fit["theta"][i]), "se": float(fit["se"][i]), "start": year, "end": year, "seasons": 1}
    strength, se, start, end, seasons = max(candidates, key=lambda row: row[0])
    return {"strength": strength, "se": se, "start": start, "end": end, "seasons": seasons}

def score(values, value):
    ordered = sorted(values)
    return int(round(100 * sum(item <= value for item in ordered) / max(len(ordered), 1)))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path); parser.add_argument("--cache", type=Path)
    parser.add_argument("--output", type=Path, default=OUTPUT); parser.add_argument("--iterations", type=int, default=1600)
    args = parser.parse_args()
    print("Downloading source archive…", flush=True)
    payload = fetch_archive(args.input, args.cache)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        print("Reading F1DB result tables…", flush=True)
        race = read_table(archive, "f1db-races-race-results.csv")
        qualifying = read_table(archive, "f1db-races-qualifying-results.csv")
    print("Building same-constructor observations…", flush=True)
    race_obs, race_meta = teammate_observations(race, "race", .65)
    quali_obs, quali_meta = teammate_observations(qualifying, "qualifying", 1.0)
    print("Fitting overall, qualifying, and race strengths…", flush=True)
    overall, quali_fit, race_fit = fit_dynamic_bt(race_obs + quali_obs, args.iterations), fit_dynamic_bt(quali_obs, args.iterations), fit_dynamic_bt(race_obs, args.iterations)
    f1_to_app = {f1: app for app, f1 in APP_DRIVER_IDS.items()}
    overall_peaks = {driver: peak(overall, driver) for driver in {driver for driver, _ in overall["index"]}}
    overall_peaks = {driver: item for driver, item in overall_peaks.items() if item}
    elos = {driver: 1500 + item["strength"] * 173.7178 for driver, item in overall_peaks.items()}
    quali_peaks = {driver: peak(quali_fit, driver) for driver in overall_peaks}
    race_peaks = {driver: peak(race_fit, driver) for driver in overall_peaks}
    quali_strengths = [item["strength"] for item in quali_peaks.values() if item]
    race_strengths = [item["strength"] for item in race_peaks.values() if item]
    profiles = {}
    for app, f1 in APP_DRIVER_IDS.items():
        item = overall_peaks.get(f1)
        if not item: continue
        q, r = quali_peaks.get(f1) or item, race_peaks.get(f1) or item
        profiles[app] = {"peakElo": round(elos[f1]), "uncertaintyElo": round(max(35, item["se"] * 173.7178)), "tqi": score(list(elos.values()), elos[f1]), "pace": score(quali_strengths, q["strength"]), "race": score(race_strengths, r["strength"]), "execution": score(list(elos.values()), elos[f1]), "adaptability": min(100, 45 + 6 * item["seasons"]), "peak": f"{item['start']}–{item['end']}", "era": f"{item['start']}–{item['end']}", "observations": {"windowSeasons": item["seasons"]}}
    edges_data = defaultdict(list)
    for meta in (race_meta, quali_meta):
        for key, years in meta["edge_seasons"].items(): edges_data[key].extend(years)
    edges = []
    for ((a, b), team), years in edges_data.items():
        if a not in f1_to_app or b not in f1_to_app: continue
        years = sorted(set(years)); app_a, app_b = sorted((f1_to_app[a], f1_to_app[b]))
        label = f"{team.replace('-', ' ').title()} · {years[0]}" + (f"–{years[-1]}" if years[-1] != years[0] else "")
        edges.append({"from": app_a, "to": app_b, "label": label, "observations": len(years)})
    snapshot = {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "source": {"name": "F1DB", "url": F1DB_RELEASE, "archiveBytes": len(payload)}, "model": {"name": "time-aware Bradley-Terry", "windowYears": WINDOW_YEARS, "ratingScale": "Elo = 1500 + latent_strength × 173.7178", "notes": "Same-constructor qualifying and clean classified race observations; season strengths are temporally smoothed."}, "observations": {"qualifying": len(quali_obs), "race": len(race_obs), "combined": len(quali_obs) + len(race_obs)}, "profiles": profiles, "edges": sorted(edges, key=lambda edge: -edge["observations"])}
    args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output} with {len(profiles)} profiles and {len(edges)} edges.")

if __name__ == "__main__": main()
