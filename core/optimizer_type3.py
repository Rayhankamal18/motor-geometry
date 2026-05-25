from __future__ import annotations

import math
from typing import Dict, Iterator, List, Optional, Sequence, Set, Tuple

from core.calculator_type3 import calc_bur_only_type3
from core.models_type3 import (
    GeometryInputsType3,
    IterationLogType3,
    OptimizeResultType3,
    SolutionType3,
)
from core.shared_optimizer import build_reachable_dp, diversity_zero_band, parse_dp_list


def _build_reachable(dp_list, max_total):
    return build_reachable_dp(dp_list, max_total)
from core.progress import ProgressCallback, make_progress_emitter

__all__ = ["optimize_dc_type3", "parse_dp_list"]

Quad = Tuple[float, float, float, float]

_FINE_REACH_FT = 72.0
_MAX_INNER_LENGTHS = 44
_MAX_UNIQUE_QUADS = 70_000
_PARTITION_BATCH = 128
_DEFAULT_MAX_ITER = 35_000
_DEFAULT_STORE_PER_BIN = 15
_SAFETY_MAX_TOTAL_FT = 1500.0
_PROGRESS_EVERY = 50


class _DiversityMatchStore:
    """
    Simpan match per bin keragaman (bukan satu list error terkecil).

    Bin: regime pendulum/fulcrum × kuartil total DC × kepadatan nol × rasio D.
    Setiap bin menyimpan per_bin solusi terbaik → variasi seimbang, RAM tetap kecil.
    """

    __slots__ = ("_per_bin", "_limit", "_bins", "matches_seen")

    def __init__(self, *, per_bin: int, limit_total: float) -> None:
        self._per_bin = max(1, per_bin)
        self._limit = max(limit_total, 1.0)
        self._bins: Dict[Tuple[int, int, int, int], List[SolutionType3]] = {}
        self.matches_seen = 0

    def _key(self, sol: SolutionType3) -> Tuple[int, int, int, int]:
        regime = 0 if sol.DC_A == 0.0 else 1
        tq = min(3, int(4.0 * sol.total / self._limit))
        zeros = sum(1 for v in (sol.DC_A, sol.DC_B, sol.DC_C, sol.DC_D) if v == 0.0)
        zband = diversity_zero_band(zeros, 4)
        leg = sol.DC_C + sol.DC_D
        dr = sol.DC_D / leg if leg > 1e-9 else 0.0
        split = 0 if dr < 0.34 else (1 if dr < 0.67 else 2)
        return (regime, tq, zband, split)

    def add(self, sol: SolutionType3) -> bool:
        self.matches_seen += 1
        key = self._key(sol)
        bucket = self._bins.setdefault(key, [])
        if len(bucket) < self._per_bin:
            bucket.append(sol)
            return True
        worst_i = max(
            range(len(bucket)),
            key=lambda i: (bucket[i].err, bucket[i].total),
        )
        w = bucket[worst_i]
        if (sol.err, sol.total) < (w.err, w.total):
            bucket[worst_i] = sol
            return True
        return False

    def __len__(self) -> int:
        return sum(len(b) for b in self._bins.values())

    def bin_count(self) -> int:
        return len(self._bins)

    def stats(self) -> Dict[str, int]:
        all_s = [s for b in self._bins.values() for s in b]
        pendulum = sum(1 for s in all_s if s.DC_A == 0.0)
        sparse_zero = sum(
            1
            for s in all_s
            if sum(1 for v in (s.DC_A, s.DC_B, s.DC_C, s.DC_D) if v == 0.0) <= 1
        )
        dense_all = sum(
            1
            for s in all_s
            if s.DC_A > 0 and s.DC_B > 0 and s.DC_C > 0 and s.DC_D > 0
        )
        return {
            "stored": len(all_s),
            "pendulum": pendulum,
            "fulcrum": len(all_s) - pendulum,
            "sparse_zero": sparse_zero,
            "dense_all": dense_all,
            "bins_used": len(self._bins),
        }

    def to_sorted_list(self) -> List[SolutionType3]:
        all_sols = [s for b in self._bins.values() for s in b]
        return sorted(
            all_sols,
            key=lambda s: (s.err, s.total, s.DC_A, s.DC_B, s.DC_C, s.DC_D),
        )


def _sections(
    inp: GeometryInputsType3,
    dc_a: float,
    dc_b: float,
    dc_c: float,
    dc_d: float,
) -> Tuple[float, float, float, float]:
    a = inp.L_bit + dc_a + 0.5 * inp.L_S1
    b = 0.5 * inp.L_S1 + dc_b + 0.5 * inp.L_BH
    c = 0.5 * inp.L_BH + dc_c + 0.5 * inp.L_BS
    d = 0.5 * inp.L_BS + dc_d + 0.5 * inp.L_S2
    return a, b, c, d


def _bur_or_none(
    inp: GeometryInputsType3,
    dc_a: float,
    dc_b: float,
    dc_c: float,
    dc_d: float,
) -> Optional[float]:
    try:
        return calc_bur_only_type3(inp, DC_A=dc_a, DC_B=dc_b, DC_C=dc_c, DC_D=dc_d)
    except ValueError:
        return None


def _quad_valid(inp: GeometryInputsType3, dc_a: float, dc_b: float, dc_c: float, dc_d: float) -> bool:
    a, b, c, d = _sections(inp, dc_a, dc_b, dc_c, dc_d)
    return a > 0 and (b + c + d) > 0


def _reference_bur(inp: GeometryInputsType3, dp_min: float) -> float:
    b = _bur_or_none(inp, 0.0, 0.0, 0.0, 0.0)
    if b is not None:
        return b
    for quad in (
        (dp_min, 0.0, 0.0, 0.0),
        (0.0, dp_min, 0.0, 0.0),
        (0.0, 0.0, dp_min, 0.0),
        (0.0, 0.0, 0.0, dp_min),
    ):
        b = _bur_or_none(inp, *quad)
        if b is not None:
            return b
    return 0.0


def _estimate_max_total_dc(
    inp: GeometryInputsType3,
    bur_target: float,
    dp_list: Sequence[float],
) -> float:
    dp_max = max(dp_list)
    dp_min = min(dp_list)
    bur_zero = _reference_bur(inp, dp_min)

    def search_pendulum(hi_cap: float) -> float:
        lo, hi = 0.0, hi_cap
        for _ in range(40):
            mid = (lo + hi) / 2.0
            b = _bur_or_none(inp, 0.0, 0.0, 0.0, mid)
            if b is None or b > bur_target:
                lo = mid
            else:
                hi = mid
        return hi

    def search_fulcrum(hi_cap: float) -> float:
        lo, hi = 0.0, hi_cap
        for _ in range(40):
            mid = (lo + hi) / 2.0
            b = _bur_or_none(inp, mid, 0.0, 0.0, 0.0)
            if b is None or b > bur_target:
                lo = mid
            else:
                hi = mid
        return hi

    if bur_zero > bur_target:
        est_p = search_pendulum(1000.0)
        est_f = search_fulcrum(500.0)
        return min(_SAFETY_MAX_TOTAL_FT, max(est_p, est_f) + 5.0 * dp_max)

    est_p = search_pendulum(1000.0)
    est_f = search_fulcrum(500.0)
    return min(_SAFETY_MAX_TOTAL_FT, max(est_p, est_f, 50.0) + 5.0 * dp_max)


def _d_ratio_proxy(q: Quad) -> float:
    leg = q[2] + q[3]
    return q[3] / leg if leg > 1e-12 else 0.0


def _nonzero_count(q: Quad) -> int:
    return sum(1 for v in q if v > 0.0)


def _reachable_layers(
    full_sorted: Sequence[float],
    max_total: float,
    *,
    fine_cap: float = _FINE_REACH_FT,
    max_inner: int = _MAX_INNER_LENGTHS,
) -> Tuple[List[float], List[float]]:
    totals = [v for v in full_sorted if v <= max_total]
    full = list(full_sorted)
    if len(full) <= max_inner:
        return totals, full

    fine_cap_eff = max(fine_cap, 1.0)
    fine = [v for v in full if v <= min(fine_cap_eff, max_total)]
    coarse = [v for v in full if v > fine_cap_eff and v <= max_total]

    inner: Set[float] = set(fine)
    inner.add(0.0)
    if totals:
        inner.add(totals[-1])

    budget = max_inner - len(inner)
    if budget > 0 and coarse:
        step = max(1, len(coarse) // budget)
        for idx in range(0, len(coarse), step):
            inner.add(coarse[idx])
            if len(inner) >= max_inner:
                break
        inner.add(coarse[-1])

    return totals, sorted(inner)


def _iter_partition_for_total(
    total: float,
    reach_inner: Sequence[float],
    full_reach: Set[float],
    *,
    filter_fn,
    sort_key,
    max_unique: int,
    seen: Set[Quad],
) -> Iterator[Quad]:
    if len(seen) >= max_unique:
        return
    bucket: List[Quad] = []
    for dc_a in reach_inner:
        if dc_a > total:
            break
        for dc_b in reach_inner:
            if dc_a + dc_b > total:
                break
            for dc_c in reach_inner:
                rem = total - dc_a - dc_b - dc_c
                if rem < 0:
                    break
                if rem not in full_reach:
                    continue
                q = (dc_a, dc_b, dc_c, rem)
                if q in seen or not filter_fn(q):
                    continue
                bucket.append(q)
                if len(bucket) >= _PARTITION_BATCH:
                    bucket.sort(key=sort_key)
                    for item in bucket:
                        if item in seen:
                            continue
                        if len(seen) >= max_unique:
                            return
                        seen.add(item)
                        yield item
                    bucket = []
    if bucket:
        bucket.sort(key=sort_key)
        for item in bucket:
            if item in seen:
                continue
            if len(seen) >= max_unique:
                return
            seen.add(item)
            yield item


def _iter_partition_stream(
    totals: Sequence[float],
    reach_inner: Sequence[float],
    full_reach: Set[float],
    limit_total: float,
    *,
    filter_fn,
    sort_key,
    max_unique: int,
    seen: Set[Quad],
) -> Iterator[Quad]:
    for total in totals:
        if total > limit_total:
            continue
        if len(seen) >= max_unique:
            return
        yield from _iter_partition_for_total(
            total,
            reach_inner,
            full_reach,
            filter_fn=filter_fn,
            sort_key=sort_key,
            max_unique=max_unique,
            seen=seen,
        )


def _iter_quads_diverse(
    totals: Sequence[float],
    reach_inner: Sequence[float],
    full_reach: Set[float],
    limit_total: float,
    bur_target: float,
    bur_zero: float,
    *,
    max_unique: int,
) -> Iterator[Quad]:
    seen: Set[Quad] = set()
    pendulum_leg = lambda q: q[1] + q[2] + q[3]
    total_sum = lambda q: q[0] + q[1] + q[2] + q[3]
    totals_asc = sorted(t for t in totals if t <= limit_total)

    fulcrum_filter = lambda q: q[0] > 0.0
    pendulum_filter = lambda q: q[0] == 0.0
    mixed_filter = lambda q: _nonzero_count(q) >= 2
    dense_filter = lambda q: q[0] > 0 and q[1] > 0 and q[2] > 0 and q[3] > 0
    all_filter = lambda q: True

    fulcrum_key = lambda q: (-q[0], -_d_ratio_proxy(q), total_sum(q))
    pendulum_key = lambda q: (-pendulum_leg(q), -q[3], -_d_ratio_proxy(q), total_sum(q))
    mixed_key = lambda q: (abs(_d_ratio_proxy(q) - 0.5), total_sum(q), q[0], q[3])
    dense_key = lambda q: (total_sum(q), q[0], q[1], q[2], q[3])
    all_key = lambda q: (total_sum(q), q[0], q[1], q[2], q[3])

    # Interleave per total DC: fulcrum ↔ pendulum ↔ mixed ↔ penuh-DC.
    for total in totals_asc:
        if total > limit_total or len(seen) >= max_unique:
            break
        for filter_fn, sort_key in (
            (fulcrum_filter, fulcrum_key),
            (pendulum_filter, pendulum_key),
            (mixed_filter, mixed_key),
            (dense_filter, dense_key),
        ):
            if len(seen) >= max_unique:
                break
            yield from _iter_partition_for_total(
                total,
                reach_inner,
                full_reach,
                filter_fn=filter_fn,
                sort_key=sort_key,
                max_unique=max_unique,
                seen=seen,
            )

    if len(seen) < max_unique:
        yield from _iter_partition_stream(
            totals_asc,
            reach_inner,
            full_reach,
            limit_total,
            filter_fn=all_filter,
            sort_key=all_key,
            max_unique=max_unique,
            seen=seen,
        )


def optimize_dc_type3(
    inp: GeometryInputsType3,
    *,
    dp_list: Sequence[float],
    bur_target: float,
    eps: float,
    max_iter: int = _DEFAULT_MAX_ITER,
    history: Optional[List[IterationLogType3]] = None,
    patience_no_new_match: int = 0,
    max_matches: int = 0,
    max_total_dc: Optional[float] = None,
    on_progress: Optional[ProgressCallback] = None,
) -> OptimizeResultType3:
    if max_iter <= 0:
        raise ValueError("max_iter harus > 0.")
    if eps < 0:
        raise ValueError("eps harus >= 0.")
    if any(d <= 0 for d in dp_list):
        raise ValueError("Semua DP harus > 0.")

    dp_sorted = sorted(set(float(d) for d in dp_list))
    dp_min = dp_sorted[0]
    limit_total = max_total_dc if max_total_dc is not None else _estimate_max_total_dc(
        inp, bur_target, dp_sorted
    )
    full_sorted = sorted(_build_reachable(dp_sorted, limit_total))
    totals, reach_inner = _reachable_layers(full_sorted, limit_total)
    full_reach = set(full_sorted)
    bur_zero = _reference_bur(inp, dp_min)
    max_unique = min(_MAX_UNIQUE_QUADS, max(max_iter * 2, max_iter))

    per_bin = _DEFAULT_STORE_PER_BIN
    if max_matches > 0:
        per_bin = max(5, max_matches // 50)
    matches = _DiversityMatchStore(per_bin=per_bin, limit_total=limit_total)

    quad_iter = _iter_quads_diverse(
        totals,
        reach_inner,
        full_reach,
        limit_total,
        bur_target,
        bur_zero,
        max_unique=max_unique,
    )

    planned_total = max_iter
    emit_progress = make_progress_emitter(on_progress, planned_total)

    best_sol: Optional[SolutionType3] = None
    best_err = math.inf
    quads_evaluated = 0
    unique_generated = 0
    iter_idx = 0

    last_total: Optional[float] = None
    batch_tested = 0
    batch_matches = 0
    batch_best: Optional[SolutionType3] = None
    batch_best_err = math.inf

    def flush_batch() -> None:
        nonlocal iter_idx, batch_tested, batch_matches
        nonlocal batch_best, batch_best_err, last_total
        if last_total is None or batch_tested == 0:
            return

        iter_idx += 1
        if history is not None and len(history) < 50 and best_sol is not None and batch_best is not None:
            history.append(
                IterationLogType3(
                    iter_idx=iter_idx,
                    total_dc=last_total,
                    quads_tested=batch_tested,
                    matches_found=batch_matches,
                    best_err_this_iter=batch_best.err,
                    best_total_this_iter=batch_best.total,
                    best_dc_a_this_iter=batch_best.DC_A,
                    best_dc_b_this_iter=batch_best.DC_B,
                    best_dc_c_this_iter=batch_best.DC_C,
                    best_dc_d_this_iter=batch_best.DC_D,
                    best_bur_this_iter=batch_best.BUR,
                    best_err_so_far=best_sol.err,
                    best_total_so_far=best_sol.total,
                    best_dc_a_so_far=best_sol.DC_A,
                    best_dc_b_so_far=best_sol.DC_B,
                    best_dc_c_so_far=best_sol.DC_C,
                    best_dc_d_so_far=best_sol.DC_D,
                    best_bur_so_far=best_sol.BUR,
                    seen_size=len(totals),
                )
            )

        batch_tested = 0
        batch_matches = 0
        batch_best = None
        batch_best_err = math.inf

    for DC_A, DC_B, DC_C, DC_D in quad_iter:
        if quads_evaluated >= max_iter:
            break
        unique_generated += 1
        if not _quad_valid(inp, DC_A, DC_B, DC_C, DC_D):
            continue

        total = DC_A + DC_B + DC_C + DC_D
        if last_total is not None and total != last_total:
            flush_batch()
        last_total = total

        quads_evaluated += 1
        batch_tested += 1
        if quads_evaluated % _PROGRESS_EVERY == 0 or quads_evaluated >= max_iter:
            emit_progress(quads_evaluated)

        try:
            bur = calc_bur_only_type3(
                inp, DC_A=DC_A, DC_B=DC_B, DC_C=DC_C, DC_D=DC_D
            )
        except ValueError:
            continue

        err = abs(bur - bur_target)
        sol = SolutionType3(
            DC_A=DC_A, DC_B=DC_B, DC_C=DC_C, DC_D=DC_D,
            total=total, BUR=bur, err=err,
        )
        if err < batch_best_err:
            batch_best_err = err
            batch_best = sol
        if err < best_err:
            best_err = err
            best_sol = sol
        if err <= eps:
            batch_matches += 1
            matches.add(sol)

    flush_batch()
    emit_progress(planned_total)

    all_matches = matches.to_sorted_list()
    stats = matches.stats()

    if all_matches:
        best = all_matches[0]
        diversity_note = (
            f"\nKeragaman tersimpan: pendulum {stats['pendulum']}, "
            f"fulcrum {stats['fulcrum']}, penuh-DC {stats['dense_all']}, "
            f"kombinasi jarang-nol {stats['sparse_zero']}, "
            f"{stats['bins_used']} bin aktif."
        )
        cap_note = ""
        if matches.matches_seen > len(all_matches):
            cap_note = (
                f"\n{matches.matches_seen} match dalam toleransi; "
                f"{len(all_matches)} reprezentatif (binned) disimpan."
            )

        msg = (
            f"Ditemukan {matches.matches_seen} kombinasi (±{eps:g} deg/100ft), "
            f"{len(all_matches)} solusi representatif beragam.\n"
            f"{quads_evaluated} evaluasi / {unique_generated} kandidat unik, "
            f"{len(totals)} total DC subset-sum, batas ≈{limit_total:g} ft."
            f"{diversity_note}{cap_note}\n"
            f"Best: DC_A={best.DC_A:g} ft, DC_B={best.DC_B:g} ft, "
            f"DC_C={best.DC_C:g} ft, DC_D={best.DC_D:g} ft, "
            f"Total={best.total:g} ft, BUR={best.BUR:.6g}, err={best.err:.6g}."
        )
        return OptimizeResultType3(
            solutions=all_matches,
            message=msg,
            exact_match=True,
            matches_found_total=matches.matches_seen,
        )

    tips = (
        "Coba ubah parameter berikut:\n"
        "- Perbesar toleransi eps\n"
        "- Ubah BUR_target\n"
        "- Kurangi jumlah opsi DP\n"
        "- Perbesar max evaluasi kombinasi\n"
        "- Ubah geometri atau sudut x/y"
    )

    bur_ref = _reference_bur(inp, dp_min)
    mode = "pendulum" if bur_target < bur_ref else "fulcrum"

    if best_sol is not None:
        msg = (
            f"Tidak ditemukan kombinasi dalam toleransi ±{eps:g} (deg/100ft).\n"
            f"Mode {mode}, {quads_evaluated} evaluasi, total DC hingga {limit_total:g} ft.\n"
            f"Terdekat: DC_A={best_sol.DC_A:g}, DC_B={best_sol.DC_B:g}, "
            f"DC_C={best_sol.DC_C:g}, DC_D={best_sol.DC_D:g}, "
            f"BUR={best_sol.BUR:.6g}, selisih={best_sol.err:.6g}.\n\n{tips}"
        )
        return OptimizeResultType3(
            solutions=[best_sol],
            message=msg,
            exact_match=False,
            matches_found_total=0,
        )

    msg = f"Tidak ada kombinasi valid (max_iter={max_iter}).\n{tips}"
    return OptimizeResultType3(
        solutions=[],
        message=msg,
        exact_match=False,
        matches_found_total=0,
    )
