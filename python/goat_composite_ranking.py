"""All-Time / GOAT Composite Elo Ranking Pipeline.

Implements within-era Z-score normalization (to prevent era inflation/deflation),
sustained rolling peak extraction with small-sample shrinkage, prime longevity
averaging with zero-padding, component min-max normalization, and 60/40 weighted
composite GOAT scoring alongside era-adjusted display Elo.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import zipfile
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Data Models & Configurations
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RatingSnapshot:
    """A single player's rating record in a distinct time period (e.g. season, year, month)."""
    player_id: str
    period: Union[int, str]
    elo: float
    matches_played: int = 1
    player_name: Optional[str] = None


@dataclass
class PeriodBaseline:
    """Statistical baseline distribution for period t across Top-K benchmark players."""
    period: Union[int, str]
    k_count: int
    mean_elo: float       # mu_t
    std_elo: float        # sigma_t
    total_active: int


@dataclass
class PlayerPeriodZScore:
    """A player's era-normalized standing in period t."""
    player_id: str
    period: Union[int, str]
    raw_elo: float
    z_score: float                # era-adjusted Z-score
    raw_z_score: float            # within-era Z-score before era penalty
    matches_played: int
    era_weight: float = 1.0       # Q(t) talent-pool depth factor applied to this period
    player_name: Optional[str] = None


@dataclass
class GOATRankingConfig:
    """Configuration hyperparameters for the GOAT Composite Elo ranking pipeline."""
    top_k: int = 50                 # K: top benchmark players per era for baseline mu_t, sigma_t
    min_matches: int = 1            # minimum matches/races in period t to qualify as active
    peak_window: int = 3            # window size W for sustained peak rolling average (periods)
    prime_years: int = 5            # M: number of top prime periods for longevity average
    peak_weight: float = 0.6        # weight for Norm(Z_peak) in Composite_Score
    prime_weight: float = 0.4       # weight for Norm(Z_prime_avg) in Composite_Score
    base_elo: float = 2000.0        # display anchor for Era_Adjusted_Elo
    elo_scale: float = 150.0        # display multiplier for Era_Adjusted_Elo
    min_career_periods: int = 1     # minimum active periods required across career to be ranked
    # Era Penalty System (Talent-Pool Depth & Professionalization Adjustment)
    era_penalty_enabled: bool = True     # whether to penalize older eras for smaller/amateur talent pools
    era_min_weight: float = 0.38         # talent pool depth factor for 1950 (0.38x vs modern 1.00x)
    era_base_year: int = 1950            # starting year anchor for early era penalty
    era_reference_year: int = 2026       # modern baseline year anchor (receives 1.00x full weight)
    era_curve_gamma: float = 1.0         # power curve exponent (1.0 = linear progression)

    def __post_init__(self) -> None:
        if self.top_k < 1:
            raise ValueError(f"top_k must be at least 1, got {self.top_k}")
        if self.peak_window < 1:
            raise ValueError(f"peak_window must be at_least 1, got {self.peak_window}")
        if self.prime_years < 1:
            raise ValueError(f"prime_years must be at least 1, got {self.prime_years}")
        if not math.isclose(self.peak_weight + self.prime_weight, 1.0, rel_tol=1e-5):
            raise ValueError(
                f"peak_weight ({self.peak_weight}) + prime_weight ({self.prime_weight}) must sum to 1.0"
            )
        if self.era_min_weight < 0.0 or self.era_min_weight > 1.0:
            raise ValueError(f"era_min_weight must be in [0.0, 1.0], got {self.era_min_weight}")


@dataclass
class GOATLeaderboardRow:
    """A row in the final All-Time / GOAT Composite Elo Leaderboard."""
    rank: int
    player_id: str
    name: str
    raw_peak_elo: float
    raw_overall_elo: float
    z_peak: float
    z_prime_avg: float
    norm_peak: float
    norm_prime: float
    era_adjusted_elo: float
    composite_score: float
    active_periods_count: int = 0
    peak_window_label: str = ""
    prime_periods: List[Union[int, str]] = field(default_factory=list)
    app_driver_id: Optional[str] = None
    raw_z_peak: float = 0.0              # unpenalized within-era peak Z-score
    raw_z_prime_avg: float = 0.0         # unpenalized within-era prime longevity Z-score
    era_discount_factor: float = 1.0     # average era depth factor Q(t) applied to player

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to dict suitable for JSON or DataFrame consumption."""
        res: Dict[str, Any] = {
            "rank": self.rank,
            "player_id": self.player_id,
            "name": self.name,
            "raw_peak_elo": round(self.raw_peak_elo, 1),
            "raw_overall_elo": round(self.raw_overall_elo, 1),
            "z_peak": round(self.z_peak, 4),
            "z_prime_avg": round(self.z_prime_avg, 4),
            "raw_z_peak": round(self.raw_z_peak, 4),
            "raw_z_prime_avg": round(self.raw_z_prime_avg, 4),
            "era_discount_factor": round(self.era_discount_factor, 3),
            "norm_peak": round(self.norm_peak, 2),
            "norm_prime": round(self.norm_prime, 2),
            "era_adjusted_elo": round(self.era_adjusted_elo, 1),
            "composite_score": round(self.composite_score, 2),
            "active_periods_count": self.active_periods_count,
            "peak_window_label": self.peak_window_label,
            "prime_periods": self.prime_periods,
        }
        if self.app_driver_id:
            res["app_driver_id"] = self.app_driver_id
        return res


# ---------------------------------------------------------------------------
# Core Pipeline Implementation
# ---------------------------------------------------------------------------

class GOATRankingPipeline:
    """All-Time / GOAT Composite Elo Ranking Pipeline using Era-Normalized Peak and Prime Elo."""

    def __init__(self, config: Optional[GOATRankingConfig] = None) -> None:
        self.config = config or GOATRankingConfig()

    # -----------------------------------------------------------------------
    # Step 1: Within-Era Z-Score Normalization
    # -----------------------------------------------------------------------
    def step1_within_era_zscore(
        self, snapshots: Sequence[RatingSnapshot]
    ) -> Tuple[Dict[str, List[PlayerPeriodZScore]], Dict[Union[int, str], PeriodBaseline]]:
        """Step 1: Within-Era Z-Score Normalization (Prevent Era Inflation/Deflation).

        - Groups snapshots by period t.
        - For each period t, filters to active players with matches >= min_matches.
        - Selects the Top K active players (or all active if pool < K).
        - Computes era baseline mean (mu_t) and standard deviation (sigma_t).
        - For every active player i in period t, computes Z_{i,t} = (Elo_{i,t} - mu_t) / sigma_t.
          Safely handles sigma_t == 0 or single-player pool by setting Z_{i,t} = 0.0.
        """
        # Group snapshots by period
        period_to_snapshots: Dict[Union[int, str], List[RatingSnapshot]] = defaultdict(list)
        for s in snapshots:
            if s.matches_played >= self.config.min_matches:
                period_to_snapshots[s.period].append(s)

        baselines: Dict[Union[int, str], PeriodBaseline] = {}
        player_zscores: Dict[str, List[PlayerPeriodZScore]] = defaultdict(list)

        for period, p_snapshots in period_to_snapshots.items():
            # Sort by raw Elo descending
            p_snapshots_sorted = sorted(p_snapshots, key=lambda s: s.elo, reverse=True)
            k_pool = p_snapshots_sorted[: self.config.top_k]
            k_elos = [s.elo for s in k_pool]

            if len(k_elos) >= 2:
                mu_t = float(np.mean(k_elos))
                # Using sample std (ddof=1) across benchmark pool
                sigma_t = float(np.std(k_elos, ddof=1))
            elif len(k_elos) == 1:
                mu_t = float(k_elos[0])
                sigma_t = 0.0
            else:
                mu_t = 0.0
                sigma_t = 0.0

            # Safe sigma handling: threshold at 1e-9 to avoid floating point division instability
            safe_sigma = sigma_t if (sigma_t is not None and not np.isnan(sigma_t) and sigma_t > 1e-9) else 0.0

            baselines[period] = PeriodBaseline(
                period=period,
                k_count=len(k_pool),
                mean_elo=mu_t,
                std_elo=safe_sigma,
                total_active=len(p_snapshots),
            )

            # Calculate era talent-pool depth factor Q(t) if era penalty is enabled
            era_weight = 1.0
            if self.config.era_penalty_enabled:
                import re
                year_match = re.search(r"\d{4}", str(period))
                if year_match:
                    year = int(year_match.group(0))
                    t_min = self.config.era_base_year
                    t_max = self.config.era_reference_year
                    span = max(1, t_max - t_min)
                    ratio = max(0.0, min(1.0, (year - t_min) / span))
                    era_weight = self.config.era_min_weight + (1.0 - self.config.era_min_weight) * (ratio ** self.config.era_curve_gamma)

            for s in p_snapshots:
                if safe_sigma > 0.0:
                    raw_z = (s.elo - mu_t) / safe_sigma
                else:
                    raw_z = 0.0
                adj_z = raw_z * era_weight

                player_zscores[s.player_id].append(
                    PlayerPeriodZScore(
                        player_id=s.player_id,
                        period=s.period,
                        raw_elo=s.elo,
                        z_score=adj_z,
                        raw_z_score=raw_z,
                        matches_played=s.matches_played,
                        era_weight=era_weight,
                        player_name=s.player_name,
                    )
                )

        # Sort each player's records chronologically by period
        for pid in player_zscores:
            player_zscores[pid].sort(key=lambda item: str(item.period))

        return player_zscores, baselines

    # -----------------------------------------------------------------------
    # Step 2: Extract Sustained Peak (Z_peak) and Prime Average (Z_prime_avg)
    # -----------------------------------------------------------------------
    def step2_extract_peak_and_prime(
        self, player_zscores: Dict[str, List[PlayerPeriodZScore]]
    ) -> Dict[str, Dict[str, Any]]:
        """Step 2: Extract Sustained Peak (Z_peak) and Prime Average (Z_prime_avg) per player.

        - Sustained Peak (Z_peak):
          Computes highest rolling average of Z_{i,t} over peak_window W.
          If a player has N < W periods, applies small-sample shrinkage penalty toward 0:
            shrinkage = N / W
            Z_peak = mean(Z_{i,t}) * (N / W)
        - Prime Longevity (Z_prime_avg):
          Takes mean of player's top M best periods of Z_{i,t} (M = prime_years).
          If N < M, pads missing (M - N) years with 0 (era baseline average).
            Z_prime_avg = sum(top_min(N, M)) / M
        """
        w = self.config.peak_window
        m = self.config.prime_years
        player_metrics: Dict[str, Dict[str, Any]] = {}

        for pid, records in player_zscores.items():
            if len(records) < self.config.min_career_periods:
                continue

            n = len(records)
            raw_elos = [r.raw_elo for r in records]
            z_vals = [r.z_score for r in records]
            raw_z_vals = [r.raw_z_score for r in records]
            display_name = next((r.player_name for r in records if r.player_name), pid)

            # 1. Sustained Peak (Z_peak)
            if n >= w:
                best_roll = -float("inf")
                best_raw_roll = -float("inf")
                best_label = ""
                for i in range(n - w + 1):
                    window_slice = records[i : i + w]
                    roll_avg = sum(r.z_score for r in window_slice) / w
                    raw_roll_avg = sum(r.raw_z_score for r in window_slice) / w
                    if roll_avg > best_roll:
                        best_roll = roll_avg
                        best_raw_roll = raw_roll_avg
                        p_start = window_slice[0].period
                        p_end = window_slice[-1].period
                        best_label = f"{p_start}–{p_end}" if p_start != p_end else str(p_start)
                z_peak = best_roll
                raw_z_peak = best_raw_roll
                peak_window_label = best_label
            else:
                # Small-sample shrinkage penalty toward 0
                # Shrinkage factor is N / W
                mean_z = sum(z_vals) / n
                mean_raw_z = sum(raw_z_vals) / n
                shrinkage = n / w
                z_peak = mean_z * shrinkage
                raw_z_peak = mean_raw_z * shrinkage
                p_start = records[0].period
                p_end = records[-1].period
                span = f"{p_start}–{p_end}" if p_start != p_end else str(p_start)
                peak_window_label = f"{span} (shrunk {n}/{w})"

            # 2. Prime Longevity (Z_prime_avg)
            # Sort all available period Z scores descending
            sorted_records = sorted(records, key=lambda r: r.z_score, reverse=True)
            prime_records = sorted_records[:m]
            top_z_sum = sum(r.z_score for r in prime_records)
            # Missing years are padded with 0 (era baseline mean), dividing by total M
            z_prime_avg = top_z_sum / m

            raw_sorted_records = sorted(records, key=lambda r: r.raw_z_score, reverse=True)
            raw_z_prime_avg = sum(r.raw_z_score for r in raw_sorted_records[:m]) / m

            era_discount_factor = sum(r.era_weight for r in prime_records) / max(1, len(prime_records))
            prime_periods_list = [r.period for r in prime_records]

            # Raw statistics
            raw_peak_elo = max(raw_elos)
            raw_overall_elo = sum(raw_elos) / n

            player_metrics[pid] = {
                "player_id": pid,
                "name": display_name,
                "raw_peak_elo": raw_peak_elo,
                "raw_overall_elo": raw_overall_elo,
                "z_peak": z_peak,
                "z_prime_avg": z_prime_avg,
                "raw_z_peak": raw_z_peak,
                "raw_z_prime_avg": raw_z_prime_avg,
                "era_discount_factor": era_discount_factor,
                "active_periods_count": n,
                "peak_window_label": peak_window_label,
                "prime_periods": prime_periods_list,
            }

        return player_metrics

    # -----------------------------------------------------------------------
    # Step 3: Normalize Components to [0, 100]
    # -----------------------------------------------------------------------
    def step3_normalize_components(
        self, player_metrics: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """Step 3: Normalize Components to [0, 100].

        Min-max normalize Z_peak and Z_prime_avg across all players in the pool:
          Norm(X) = 100 * (X - min(X)) / (max(X) - min(X))
        Handles max(X) == min(X) by assigning 50.0.
        """
        if not player_metrics:
            return {}

        all_z_peaks = [m["z_peak"] for m in player_metrics.values()]
        all_z_primes = [m["z_prime_avg"] for m in player_metrics.values()]

        min_peak, max_peak = min(all_z_peaks), max(all_z_peaks)
        min_prime, max_prime = min(all_z_primes), max(all_z_primes)

        normalized: Dict[str, Dict[str, Any]] = {}
        for pid, data in player_metrics.items():
            entry = dict(data)

            # Normalize peak
            if max_peak > min_peak:
                entry["norm_peak"] = 100.0 * (data["z_peak"] - min_peak) / (max_peak - min_peak)
            else:
                entry["norm_peak"] = 50.0

            # Normalize prime
            if max_prime > min_prime:
                entry["norm_prime"] = 100.0 * (data["z_prime_avg"] - min_prime) / (max_prime - min_prime)
            else:
                entry["norm_prime"] = 50.0

            normalized[pid] = entry

        return normalized

    # -----------------------------------------------------------------------
    # Step 4: Compute Final Composite GOAT Score
    # -----------------------------------------------------------------------
    def step4_compute_composite_scores(
        self, normalized_metrics: Dict[str, Dict[str, Any]]
    ) -> List[GOATLeaderboardRow]:
        """Step 4: Compute Final Composite GOAT Score.

        - Composite_Score = 0.6 * Norm(Z_peak) + 0.4 * Norm(Z_prime_avg)
        - Era_Adjusted_Elo = 2000 + 150 * (0.6 * Z_peak + 0.4 * Z_prime_avg)
        Sorts the leaderboard descending and assigns integer ranks.
        """
        w_peak = self.config.peak_weight
        w_prime = self.config.prime_weight
        base_elo = self.config.base_elo
        scale = self.config.elo_scale

        rows: List[GOATLeaderboardRow] = []

        for pid, data in normalized_metrics.items():
            z_peak = data["z_peak"]
            z_prime = data["z_prime_avg"]
            norm_peak = data["norm_peak"]
            norm_prime = data["norm_prime"]

            composite_score = (w_peak * norm_peak) + (w_prime * norm_prime)
            weighted_z = (w_peak * z_peak) + (w_prime * z_prime)
            era_adjusted_elo = base_elo + (scale * weighted_z)

            row = GOATLeaderboardRow(
                rank=0,  # assigned after sorting
                player_id=pid,
                name=data["name"],
                raw_peak_elo=data["raw_peak_elo"],
                raw_overall_elo=data["raw_overall_elo"],
                z_peak=z_peak,
                z_prime_avg=z_prime,
                norm_peak=norm_peak,
                norm_prime=norm_prime,
                era_adjusted_elo=era_adjusted_elo,
                composite_score=composite_score,
                active_periods_count=data["active_periods_count"],
                peak_window_label=data["peak_window_label"],
                prime_periods=data["prime_periods"],
                app_driver_id=F1_TO_APP.get(pid),
                raw_z_peak=data.get("raw_z_peak", z_peak),
                raw_z_prime_avg=data.get("raw_z_prime_avg", z_prime),
                era_discount_factor=data.get("era_discount_factor", 1.0),
            )
            rows.append(row)

        # Sort descending by composite_score, tie-broken by era_adjusted_elo and raw_peak_elo
        rows.sort(
            key=lambda r: (r.composite_score, r.era_adjusted_elo, r.raw_peak_elo),
            reverse=True,
        )

        # Assign 1-indexed rank
        for i, row in enumerate(rows, start=1):
            row.rank = i

        return rows

    # -----------------------------------------------------------------------
    # End-to-End Orchestrator
    # -----------------------------------------------------------------------
    def fit_leaderboard(
        self, snapshots: Sequence[RatingSnapshot]
    ) -> List[GOATLeaderboardRow]:
        """Execute the full 4-step pipeline end-to-end and return sorted leaderboard."""
        player_zscores, _ = self.step1_within_era_zscore(snapshots)
        metrics = self.step2_extract_peak_and_prime(player_zscores)
        normalized = self.step3_normalize_components(metrics)
        leaderboard = self.step4_compute_composite_scores(normalized)
        return leaderboard

    # -----------------------------------------------------------------------
    # Output & Export Utilities
    # -----------------------------------------------------------------------
    @staticmethod
    def to_dataframe(leaderboard: Sequence[GOATLeaderboardRow]) -> pd.DataFrame:
        """Convert leaderboard rows to pandas DataFrame."""
        records = [r.to_dict() for r in leaderboard]
        return pd.DataFrame(records)

    @staticmethod
    def export_csv(leaderboard: Sequence[GOATLeaderboardRow], path: Union[str, Path]) -> Path:
        """Export leaderboard to a CSV file."""
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        records = [r.to_dict() for r in leaderboard]
        if not records:
            target.write_text("", encoding="utf-8")
            return target

        fieldnames = list(records[0].keys())
        with open(target, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for rec in records:
                # serialize list fields as comma-separated
                row_copy = dict(rec)
                if isinstance(row_copy.get("prime_periods"), list):
                    row_copy["prime_periods"] = ";".join(str(p) for p in row_copy["prime_periods"])
                writer.writerow(row_copy)
        return target

    @staticmethod
    def export_json(leaderboard: Sequence[GOATLeaderboardRow], path: Union[str, Path]) -> Path:
        """Export leaderboard to a JSON file."""
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = [r.to_dict() for r in leaderboard]
        target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        return target


# ---------------------------------------------------------------------------
# Ingestors & Historical Data Loaders
# ---------------------------------------------------------------------------

def load_snapshots_from_json(path: Union[str, Path]) -> List[RatingSnapshot]:
    """Load snapshots from a JSON file."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    snapshots: List[RatingSnapshot] = []
    for item in data:
        snapshots.append(
            RatingSnapshot(
                player_id=str(item["player_id"]),
                period=item["period"],
                elo=float(item["elo"]),
                matches_played=int(item.get("matches_played", 1)),
                player_name=item.get("player_name") or item.get("name"),
            )
        )
    return snapshots


def load_snapshots_from_csv(path: Union[str, Path]) -> List[RatingSnapshot]:
    """Load snapshots from a CSV file."""
    df = pd.read_csv(path)
    snapshots: List[RatingSnapshot] = []
    for _, row in df.iterrows():
        snapshots.append(
            RatingSnapshot(
                player_id=str(row["player_id"]),
                period=row["period"],
                elo=float(row["elo"]),
                matches_played=int(row.get("matches_played", 1)),
                player_name=str(row["player_name"]) if "player_name" in row and pd.notna(row["player_name"]) else None,
            )
        )
    return snapshots


APP_DRIVER_IDS: Dict[str, str] = {
    "hamilton": "lewis-hamilton",
    "max_verstappen": "max-verstappen",
    "michael_schumacher": "michael-schumacher",
    "senna": "ayrton-senna",
    "prost": "alain-prost",
    "vettel": "sebastian-vettel",
    "alonso": "fernando-alonso",
    "norris": "lando-norris",
    "leclerc": "charles-leclerc",
    "piastri": "oscar-piastri",
    "russell": "george-russell",
    "sainz": "carlos-sainz-jr",
    "raikkonen": "kimi-raikkonen",
    "lauda": "niki-lauda",
    "fangio": "juan-manuel-fangio",
    "clark": "jim-clark",
    "mansell": "nigel-mansell",
    "hakkinen": "mika-hakkinen",
    "rosberg": "nico-rosberg",
    "button": "jenson-button",
    "ricciardo": "daniel-ricciardo",
    "perez": "sergio-perez",
    "bottas": "valtteri-bottas",
}
F1_TO_APP: Dict[str, str] = {f1: app for app, f1 in APP_DRIVER_IDS.items()}


def build_f1_historical_snapshots(
    archive_path: Optional[Path] = None,
    k_factor: float = 24.0,
    initial_elo: float = 1500.0,
) -> List[RatingSnapshot]:
    """Build seasonal historical Elo snapshots from F1DB race results archive (1950–present).

    Processes race results chronologically, computes multiplayer rank-based Elo updates,
    and returns end-of-season snapshots for every active driver in every season.
    """
    if archive_path is None:
        archive_path = Path(__file__).resolve().parents[1] / "data" / "cache" / "f1db-csv.zip"

    if not archive_path.exists():
        raise FileNotFoundError(f"F1DB archive not found at {archive_path}")

    with zipfile.ZipFile(archive_path) as z:
        races_df = pd.read_csv(z.open("f1db-races-race-results.csv"), low_memory=False)
        drivers_df = pd.read_csv(z.open("f1db-drivers.csv"), low_memory=False)

    driver_names: Dict[str, str] = {}
    for _, row in drivers_df.iterrows():
        did = str(row["id"])
        # Prefer concise, standard racing name (e.g. 'Juan Manuel Fangio', 'Jim Clark', 'Niki Lauda')
        raw_name = str(row["name"]) if pd.notna(row["name"]) and str(row["name"]).strip() else str(row["fullName"])
        import unicodedata
        clean_name = unicodedata.normalize("NFKD", raw_name).encode("ascii", "ignore").decode("ascii").strip()
        driver_names[did] = clean_name if clean_name else raw_name

    races_df["pos"] = pd.to_numeric(races_df["positionNumber"], errors="coerce")
    valid = races_df.dropna(subset=["pos", "driverId", "year", "raceId"]).copy()
    valid["pos"] = valid["pos"].astype(int)
    valid = valid.sort_values(["year", "round", "pos"])

    ratings: Dict[str, float] = defaultdict(lambda: initial_elo)
    season_snapshots: Dict[Tuple[str, int], float] = {}
    season_starts: Dict[Tuple[str, int], int] = defaultdict(int)

    # Process each race in chronological order
    for (year, _round_no, _race_id), group in valid.groupby(["year", "round", "raceId"], sort=False):
        d_ids = list(group["driverId"].astype(str))
        positions = list(group["pos"])
        n_drivers = len(d_ids)
        if n_drivers < 2:
            continue

        current_elos = [ratings[d] for d in d_ids]
        deltas = []

        for i, (d, pos) in enumerate(zip(d_ids, positions)):
            season_starts[(d, int(year))] += 1
            # actual score: normalized position (1st gets 1.0, last gets 0.0)
            actual = (n_drivers - pos) / (n_drivers - 1)
            # expected score against the entire race grid
            exp_sum = 0.0
            for j, (other, other_elo) in enumerate(zip(d_ids, current_elos)):
                if i == j:
                    continue
                exp_sum += 1.0 / (1.0 + 10.0 ** ((other_elo - current_elos[i]) / 400.0))
            expected = exp_sum / (n_drivers - 1)
            delta = k_factor * (actual - expected)
            deltas.append(delta)

        for d, delta in zip(d_ids, deltas):
            ratings[d] += delta
            season_snapshots[(d, int(year))] = ratings[d]

    snapshots: List[RatingSnapshot] = []
    for (driver_id, season), elo in season_snapshots.items():
        starts = season_starts[(driver_id, season)]
        snapshots.append(
            RatingSnapshot(
                player_id=driver_id,
                period=season,
                elo=elo,
                matches_played=starts,
                player_name=driver_names.get(driver_id, driver_id),
            )
        )

    return snapshots


# ---------------------------------------------------------------------------
# Self-Test Suite
# ---------------------------------------------------------------------------

def run_self_tests() -> bool:
    """Validate all 4 steps and mathematical requirements against explicit synthetic test cases."""
    print("Running GOAT Composite Elo Pipeline self-tests...")

    # Case A: Synthetic dataset with two distinct eras and known dynamics
    # Era 1 (1980): baseline mean ~1500, std ~100
    # Era 2 (2020): baseline mean ~2000, std ~100 (inflation simulated)
    test_snapshots = [
        # Player A (Legend with long prime): 5 seasons in Era 1
        RatingSnapshot("pA", 1980, 1700.0, 10, "Player A"),
        RatingSnapshot("pA", 1981, 1750.0, 10, "Player A"),
        RatingSnapshot("pA", 1982, 1800.0, 10, "Player A"),
        RatingSnapshot("pA", 1983, 1750.0, 10, "Player A"),
        RatingSnapshot("pA", 1984, 1700.0, 10, "Player A"),

        # Peer players in Era 1 to establish mu_1980 ~ 1500, sigma ~ 100
        RatingSnapshot("peer1", 1980, 1500.0, 10, "Peer 1"),
        RatingSnapshot("peer2", 1980, 1300.0, 10, "Peer 2"),
        RatingSnapshot("peer1", 1981, 1500.0, 10, "Peer 1"),
        RatingSnapshot("peer2", 1981, 1300.0, 10, "Peer 2"),
        RatingSnapshot("peer1", 1982, 1500.0, 10, "Peer 1"),
        RatingSnapshot("peer2", 1982, 1300.0, 10, "Peer 2"),
        RatingSnapshot("peer1", 1983, 1500.0, 10, "Peer 1"),
        RatingSnapshot("peer2", 1983, 1300.0, 10, "Peer 2"),
        RatingSnapshot("peer1", 1984, 1500.0, 10, "Peer 1"),
        RatingSnapshot("peer2", 1984, 1300.0, 10, "Peer 2"),

        # Player B (Short career prodigy): only 2 seasons in Era 2 (inflation 2000)
        # Raw elo is higher (2300) than Player A, but relative era z-score is comparable
        RatingSnapshot("pB", 2020, 2300.0, 10, "Player B"),
        RatingSnapshot("pB", 2021, 2300.0, 10, "Player B"),

        # Peer players in Era 2 to establish mu_2020 ~ 2000, sigma ~ 100
        RatingSnapshot("peer3", 2020, 2000.0, 10, "Peer 3"),
        RatingSnapshot("peer4", 2020, 1700.0, 10, "Peer 4"),
        RatingSnapshot("peer3", 2021, 2000.0, 10, "Peer 3"),
        RatingSnapshot("peer4", 2021, 1700.0, 10, "Peer 4"),

        # Player C (Zero-variance period test): single player era
        RatingSnapshot("pC", 1900, 1500.0, 1, "Player C"),
    ]

    # Test baseline without era penalty
    config_raw = GOATRankingConfig(
        top_k=50,
        min_matches=1,
        peak_window=3,
        prime_years=5,
        peak_weight=0.6,
        prime_weight=0.4,
        base_elo=2000.0,
        elo_scale=150.0,
        era_penalty_enabled=False,
    )
    pipeline_raw = GOATRankingPipeline(config_raw)

    # 1. Step 1 Test: Within-era Z-score computation
    player_zscores, baselines = pipeline_raw.step1_within_era_zscore(test_snapshots)
    assert 1980 in baselines, "Baseline for 1980 missing"
    assert 1900 in baselines, "Baseline for 1900 missing"
    assert baselines[1900].std_elo == 0.0, "Single player era must yield safe 0.0 std"
    assert player_zscores["pC"][0].z_score == 0.0, "Safe sigma handling must assign 0.0 z-score"
    print("  [PASS] Step 1: Within-era normalization and zero-variance edge cases handled.")

    # 2. Step 2 Test: Sustained peak rolling average & small-sample shrinkage
    metrics = pipeline_raw.step2_extract_peak_and_prime(player_zscores)
    
    # Player A has 5 periods >= 3 peak_window:
    # Peak window should be (1981-1983).
    pA = metrics["pA"]
    assert pA["active_periods_count"] == 5
    assert "1981–1983" in pA["peak_window_label"], f"Expected 1981–1983 peak, got {pA['peak_window_label']}"

    # Player B has 2 periods < 3 peak_window:
    # Must apply small-sample shrinkage penalty toward 0 (factor 2/3)
    pB = metrics["pB"]
    assert pB["active_periods_count"] == 2
    assert "shrunk 2/3" in pB["peak_window_label"]
    raw_mean_z_b = sum(r.z_score for r in player_zscores["pB"]) / 2
    expected_shrunk_peak = raw_mean_z_b * (2 / 3)
    assert math.isclose(pB["z_peak"], expected_shrunk_peak, rel_tol=1e-5), "Shrinkage penalty mismatch"
    
    # Prime longevity padding:
    expected_prime_b = sum(r.z_score for r in player_zscores["pB"]) / 5
    assert math.isclose(pB["z_prime_avg"], expected_prime_b, rel_tol=1e-5), "Prime 0-padding mismatch"
    print("  [PASS] Step 2: Rolling peak and small-sample shrinkage + prime 0-padding verified.")

    # 3. Step 3 Test: Min-Max normalization [0, 100]
    normalized = pipeline_raw.step3_normalize_components(metrics)
    for pid, norm_data in normalized.items():
        assert 0.0 <= norm_data["norm_peak"] <= 100.0, f"norm_peak out of bounds for {pid}"
        assert 0.0 <= norm_data["norm_prime"] <= 100.0, f"norm_prime out of bounds for {pid}"
    print("  [PASS] Step 3: Component min-max normalization into [0, 100] verified.")

    # 4. Step 4 Test: Composite score weighting and Era-Adjusted Elo scale
    leaderboard = pipeline_raw.step4_compute_composite_scores(normalized)
    assert len(leaderboard) > 0
    assert leaderboard[0].rank == 1

    top_player = leaderboard[0]
    expected_comp = 0.6 * top_player.norm_peak + 0.4 * top_player.norm_prime
    assert math.isclose(top_player.composite_score, expected_comp, rel_tol=1e-5), "Composite score calculation mismatch"

    expected_era_elo = 2000.0 + 150.0 * (0.6 * top_player.z_peak + 0.4 * top_player.z_prime_avg)
    assert math.isclose(top_player.era_adjusted_elo, expected_era_elo, rel_tol=1e-5), "Era adjusted Elo mismatch"
    print("  [PASS] Step 4: 60/40 weighting and Era-Adjusted Elo scale verified.")

    # 5. Step 5 Test: Era Penalty Verification
    config_penalized = GOATRankingConfig(
        top_k=50,
        min_matches=1,
        peak_window=3,
        prime_years=5,
        era_penalty_enabled=True,
        era_min_weight=0.38,
        era_base_year=1950,
        era_reference_year=2026,
    )
    pipeline_penalized = GOATRankingPipeline(config_penalized)
    board_penalized = pipeline_penalized.fit_leaderboard(test_snapshots)
    # Verify that early era driver pA (1980) has lower era_discount_factor than modern driver pB (2020)
    row_pA = next(r for r in board_penalized if r.player_id == "pA")
    row_pB = next(r for r in board_penalized if r.player_id == "pB")
    assert row_pA.era_discount_factor < row_pB.era_discount_factor, "Early era driver must have lower era discount factor than modern driver"
    assert row_pB.era_discount_factor > 0.90, "Modern driver must retain over 90% era depth credit"
    print(f"  [PASS] Era Penalty: verified pA (1980s: {row_pA.era_discount_factor:.2f}x) vs pB (2020s: {row_pB.era_discount_factor:.2f}x).")

    print("All self-tests successfully passed!\n")
    return True


# ---------------------------------------------------------------------------
# CLI Entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="All-Time / GOAT Composite Elo Ranking Pipeline with Era-Normalized Peak and Prime Elo.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--input", type=Path, help="Path to input snapshot file (JSON or CSV).")
    parser.add_argument("--f1-historical", action="store_true", help="Run directly on full F1DB historical archive (1950-present).")
    parser.add_argument("--output-csv", type=Path, default=Path("data/goat-composite-rankings.csv"), help="Target path for leaderboard CSV output.")
    parser.add_argument("--output-json", type=Path, default=Path("data/goat-composite-rankings.json"), help="Target path for leaderboard JSON output.")
    parser.add_argument("--top-k", type=int, default=50, help="Top K active players to define era baseline mean and std.")
    parser.add_argument("--min-matches", type=int, default=1, help="Minimum matches/races in a period to be considered active.")
    parser.add_argument("--peak-window", type=int, default=3, help="Rolling average window size for sustained peak.")
    parser.add_argument("--prime-years", type=int, default=5, help="Number of best seasons M for prime longevity.")
    parser.add_argument("--peak-weight", type=float, default=0.6, help="Weight for peak component in composite score.")
    parser.add_argument("--prime-weight", type=float, default=0.4, help="Weight for prime longevity component in composite score.")
    parser.add_argument("--base-elo", type=float, default=2000.0, help="Display anchor for era-adjusted Elo scale.")
    parser.add_argument("--elo-scale", type=float, default=150.0, help="Multiplier for era-adjusted Elo scale.")
    parser.add_argument("--era-penalty", dest="era_penalty", action="store_true", default=True, help="Enable talent pool depth penalty for early eras.")
    parser.add_argument("--no-era-penalty", dest="era_penalty", action="store_false", help="Disable era depth penalty.")
    parser.add_argument("--era-min-weight", type=float, default=0.38, help="Era depth factor Q(t) for 1950 (e.g. 0.38x).")
    parser.add_argument("--era-base-year", type=int, default=1950, help="Base year anchor for era penalty.")
    parser.add_argument("--era-reference-year", type=int, default=2026, help="Reference modern year anchor.")
    parser.add_argument("--era-curve-gamma", type=float, default=1.0, help="Power curve exponent for era depth progression.")
    parser.add_argument("--test", action="store_true", help="Run comprehensive unit test suite.")
    parser.add_argument("--top-display", type=int, default=25, help="Number of top drivers to print in console table.")

    args = parser.parse_args()

    if args.test:
        run_self_tests()
        if not args.input and not args.f1_historical:
            sys.exit(0)

    config = GOATRankingConfig(
        top_k=args.top_k,
        min_matches=args.min_matches,
        peak_window=args.peak_window,
        prime_years=args.prime_years,
        peak_weight=args.peak_weight,
        prime_weight=args.prime_weight,
        base_elo=args.base_elo,
        elo_scale=args.elo_scale,
        era_penalty_enabled=args.era_penalty,
        era_min_weight=args.era_min_weight,
        era_base_year=args.era_base_year,
        era_reference_year=args.era_reference_year,
        era_curve_gamma=args.era_curve_gamma,
    )
    pipeline = GOATRankingPipeline(config)

    # Ingest data
    if args.f1_historical:
        print("Extracting full F1 historical race-by-race Elo ratings (1950–present)...")
        snapshots = build_f1_historical_snapshots()
        print(f"Loaded {len(snapshots)} seasonal driver snapshots.")
    elif args.input:
        in_path = args.input
        if not in_path.exists():
            print(f"Error: input file {in_path} does not exist.")
            sys.exit(1)
        if in_path.suffix.lower() == ".json":
            snapshots = load_snapshots_from_json(in_path)
        else:
            snapshots = load_snapshots_from_csv(in_path)
        print(f"Loaded {len(snapshots)} snapshots from {in_path}.")
    else:
        # Default behavior: run on historical F1 archive if available, else run test suite
        default_f1 = Path(__file__).resolve().parents[1] / "data" / "cache" / "f1db-csv.zip"
        if default_f1.exists():
            print(f"No input specified. Found F1DB archive at {default_f1}; running historical pipeline...")
            snapshots = build_f1_historical_snapshots(default_f1)
            print(f"Loaded {len(snapshots)} seasonal driver snapshots.")
        else:
            print("No input specified and F1DB archive not found. Running self-test suite.")
            run_self_tests()
            sys.exit(0)

    # Compute Leaderboard
    mode_str = f"ENABLED (1950 = {args.era_min_weight*100:.0f}%, modern = 100%)" if args.era_penalty else "DISABLED (raw era Z-score)"
    print(f"Executing All-Time GOAT Composite Elo Ranking Pipeline [Era Depth Penalty: {mode_str}]...")
    leaderboard = pipeline.fit_leaderboard(snapshots)
    print(f"Pipeline complete. Ranked {len(leaderboard)} players.")

    # Export
    csv_path = pipeline.export_csv(leaderboard, args.output_csv)
    json_path = pipeline.export_json(leaderboard, args.output_json)
    print(f"Exported CSV -> {csv_path}")
    print(f"Exported JSON -> {json_path}")

    # Display Top Table
    print("\n" + "=" * 130)
    print(f"{'RANK':<5} {'NAME':<24} {'RAW PEAK':<10} {'RAW Z-PK':<10} {'ERA DEPTH':<10} {'ADJ Z-PK':<10} {'NORM PK':<9} {'NORM PR':<9} {'ADJ ELO':<9} {'GOAT SCORE':<10}")
    print("=" * 130)
    for row in leaderboard[: args.top_display]:
        print(
            f"{row.rank:<5} {row.name[:23]:<24} {row.raw_peak_elo:<10.1f} {row.raw_z_peak:<10.2f} "
            f"{f'{row.era_discount_factor*100:.0f}%':<10} {row.z_peak:<10.2f} {row.norm_peak:<9.1f} "
            f"{row.norm_prime:<9.1f} {row.era_adjusted_elo:<9.1f} {row.composite_score:<10.1f}"
        )
    print("=" * 130 + "\n")


if __name__ == "__main__":
    main()
