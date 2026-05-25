from __future__ import annotations

import math
from typing import Dict, Iterator, List, Optional, Sequence, Set, Tuple

from core.calculator_type4 import Type4BurFast, calc_bur_fast_type4, make_type4_bur_fast
from core.models_type4 import (
    GeometryInputsType4,
    IterationLogType4,
    OptimizeResultType4,
    SolutionType4,
)
from core.shared_optimizer import build_reachable_dp, diversity_zero_band, parse_dp_list


def _build_reachable(dp_list, max_total):
    return build_reachable_dp(dp_list, max_total)
from core.progress import ProgressCallback, make_progress_emitter

__all__ = ["optimize_dc_type4", "parse_dp_list"]

Quint = Tuple[float, float, float, float, float]

_FINE_REACH_FT = 60.0
_MAX_INNER_LENGTHS = 36
_MAX_UNIQUE_QUINTS = 55_000
_PARTITION_BATCH = 96
_DEFAULT_MAX_ITER = 25_000
_DEFAULT_STORE_PER_BIN = 14
_SAFETY_MAX_TOTAL_FT = 1200.0
_PROGRESS_EVERY = 100
_ESTIMATE_BSEARCH = 22


class _DiversityMatchStore:
    __slots__ = ("_per_bin", "_limit", "_bins", "matches_seen")

    def __init__(self, *, per_bin: int, limit_total: float) -> None:
        self._per_bin = max(1, per_bin)
        self._limit = max(limit_total, 1.0)
        self._bins: Dict[Tuple[int, int, int, int], List[SolutionType4]] = {}
        self.matches_seen = 0

    def _key(self, sol: SolutionType4) -> Tuple[int, int, int, int]:
        regime = 0 if sol.DC_A == 0.0 else 1
        tq = min(3, int(4.0 * sol.total / self._limit))
        zeros = sum(
            1 for v in (sol.DC_A, sol.DC_B, sol.DC_C, sol.DC_D, sol.DC_E) if v == 0.0
        )
        zband = diversity_zero_band(zeros, 5)
        leg = sol.DC_D + sol.DC_E
        er = sol.DC_E / leg if leg > 1e-9 else 0.0
        split = 0 if er < 0.34 else (1 if er < 0.67 else 2)
        return (regime, tq, zband, split)

    def add(self, sol: SolutionType4) -> bool:
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

    def stats(self) -> Dict[str, int]:
        all_s = [s for b in self._bins.values() for s in b]
        pendulum = sum(1 for s in all_s if s.DC_A == 0.0)
        sparse_zero = sum(
            1
            for s in all_s
            if sum(1 for v in (s.DC_A, s.DC_B, s.DC_C, s.DC_D, s.DC_E) if v == 0.0) <= 1
        )
        dense_all = sum(
            1
            for s in all_s
            if all(
                v > 0
                for v in (s.DC_A, s.DC_B, s.DC_C, s.DC_D, s.DC_E)
            )
        )
        return {
            "stored": len(all_s),
            "pendulum": pendulum,
            "fulcrum": len(all_s) - pendulum,
            "sparse_zero": sparse_zero,
            "dense_all": dense_all,
            "bins_used": len(self._bins),
        }

    def to_sorted_list(self) -> List[SolutionType4]:
        all_sols = [s for b in self._bins.values() for s in b]
        return sorted(
            all_sols,
            key=lambda s: (s.err, s.total, s.DC_A, s.DC_B, s.DC_C, s.DC_D, s.DC_E),
        )


def _bur_or_none_fast(
    fast: Type4BurFast,
    dc_a: float,
    dc_b: float,
    dc_c: float,
    dc_d: float,
    dc_e: float,
) -> Optional[float]:
    try:
        return calc_bur_fast_type4(
            fast, DC_A=dc_a, DC_B=dc_b, DC_C=dc_c, DC_D=dc_d, DC_E=dc_e
        )
    except ValueError:
        return None


def _reference_bur(fast: Type4BurFast, dp_min: float) -> float:
    b = _bur_or_none_fast(fast, 0.0, 0.0, 0.0, 0.0, 0.0)
    if b is not None:
        return b
    for q in (
        (dp_min, 0.0, 0.0, 0.0, 0.0),
        (0.0, dp_min, 0.0, 0.0, 0.0),
        (0.0, 0.0, dp_min, 0.0, 0.0),
        (0.0, 0.0, 0.0, dp_min, 0.0),
        (0.0, 0.0, 0.0, 0.0, dp_min),
    ):
        b = _bur_or_none_fast(fast, *q)
        if b is not None:
            return b
    return 0.0


def _estimate_max_total_dc(
    fast: Type4BurFast,
    bur_target: float,
    dp_list: Sequence[float],
) -> float:
    dp_max = max(dp_list)
    dp_min = min(dp_list)
    bur_zero = _reference_bur(fast, dp_min)
    steps = _ESTIMATE_BSEARCH

    def search_pendulum(hi_cap: float) -> float:
        lo, hi = 0.0, hi_cap
        for _ in range(steps):
            mid = (lo + hi) / 2.0
            b = _bur_or_none_fast(fast, 0.0, 0.0, 0.0, 0.0, mid)
            if b is None or b > bur_target:
                lo = mid
            else:
                hi = mid
        return hi

    def search_fulcrum(hi_cap: float) -> float:
        lo, hi = 0.0, hi_cap
        for _ in range(steps):
            mid = (lo + hi) / 2.0
            b = _bur_or_none_fast(fast, mid, 0.0, 0.0, 0.0, 0.0)
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


def _quint_valid(fast: Type4BurFast, dc_a: float, dc_b: float, dc_c: float, dc_d: float, dc_e: float) -> bool:
    l1 = fast.a_off + fast.b_off + dc_a + dc_b
    l2 = fast.c_off + fast.d_off + fast.e_off + dc_c + dc_d + dc_e
    return l1 > 0 and l2 > 0


def _subsample_sorted(values: Sequence[float], budget: int) -> List[float]:
    if budget <= 0 or not values:
        return []
    if len(values) <= budget:
        return list(values)
    out: List[float] = [values[0]]
    step = max(1, (len(values) - 1) // max(1, budget - 1))
    idx = step
    while idx < len(values) - 1 and len(out) < budget - 1:
        out.append(values[idx])
        idx += step
    if values[-1] not in out:
        out.append(values[-1])
    return out


def _reachable_layers(
    full_sorted: Sequence[float],
    max_total: float,
    dp_list: Sequence[float],
    *,
    fine_cap: float = _FINE_REACH_FT,
    max_inner: int = _MAX_INNER_LENGTHS,
) -> Tuple[List[float], List[float]]:
    totals = [v for v in full_sorted if v <= max_total]
    full = list(full_sorted)
    if len(full) <= max_inner:
        return totals, full

    fine_cap_eff = max(fine_cap, 1.0)
    dp_max = max(dp_list) if dp_list else fine_cap_eff
    fine_all = [v for v in full if v <= min(fine_cap_eff, max_total)]
    coarse_all = [v for v in full if v > fine_cap_eff and v <= max_total]
    small_cap = min(fine_cap_eff, max(24.0, 3.0 * dp_max))
    small_all = [v for v in full if v <= min(small_cap, max_total)]

    fine_budget = max(6, int(max_inner * 0.72))
    coarse_budget = max(0, max_inner - fine_budget - 1)

    inner_set: Set[float] = {0.0}
    for d in dp_list:
        if 0.0 < d <= max_total:
            inner_set.add(float(d))

    if len(small_all) <= fine_budget:
        inner_set.update(small_all)
    else:
        for v in _subsample_sorted(fine_all, fine_budget):
            inner_set.add(v)

    if coarse_all and coarse_budget:
        for v in _subsample_sorted(coarse_all, coarse_budget):
            inner_set.add(v)
    if totals:
        inner_set.add(totals[-1])

    inner = sorted(inner_set)
    if len(inner) > max_inner:
        inner = _subsample_sorted(inner, max_inner)
        if totals and totals[-1] not in inner:
            inner[-1] = totals[-1]
            inner.sort()

    return totals, inner


def _e_ratio_proxy(q: Quint) -> float:
    leg = q[3] + q[4]
    return q[4] / leg if leg > 1e-12 else 0.0


def _nonzero_count(q: Quint) -> int:
    return sum(1 for v in q if v > 0.0)


def _iter_partition_for_total(
    total: float,
    reach_inner: Sequence[float],
    full_reach: Set[float],
    *,
    filter_fn,
    sort_key,
    max_unique: int,
    seen: Set[Quint],
) -> Iterator[Quint]:
    if len(seen) >= max_unique:
        return
    bucket: List[Quint] = []
    for dc_a in reach_inner:
        if dc_a > total:
            break
        for dc_b in reach_inner:
            if dc_a + dc_b > total:
                break
            for dc_c in reach_inner:
                rem2 = total - dc_a - dc_b - dc_c
                if rem2 < 0:
                    break
                for dc_d in reach_inner:
                    dc_e = rem2 - dc_d
                    if dc_e < 0:
                        break
                    if dc_e not in full_reach:
                        continue
                    q = (dc_a, dc_b, dc_c, dc_d, dc_e)
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


def _iter_quints_diverse(
    totals: Sequence[float],
    reach_inner: Sequence[float],
    full_reach: Set[float],
    limit_total: float,
    *,
    max_unique: int,
) -> Iterator[Quint]:
    seen: Set[Quint] = set()
    pendulum_leg = lambda q: q[1] + q[2] + q[3] + q[4]
    total_sum = lambda q: q[0] + q[1] + q[2] + q[3] + q[4]
    totals_asc = sorted(t for t in totals if t <= limit_total)

    fulcrum_filter = lambda q: q[0] > 0.0
    pendulum_filter = lambda q: q[0] == 0.0
    mixed_filter = lambda q: _nonzero_count(q) >= 2
    dense_filter = lambda q: all(v > 0 for v in q)
    all_filter = lambda q: True

    fulcrum_key = lambda q: (-q[0], -_e_ratio_proxy(q), total_sum(q))
    pendulum_key = lambda q: (-pendulum_leg(q), -q[4], -_e_ratio_proxy(q), total_sum(q))
    mixed_key = lambda q: (abs(_e_ratio_proxy(q) - 0.5), total_sum(q), q[0], q[4])
    dense_key = lambda q: (total_sum(q), q[0], q[1], q[2], q[3], q[4])
    all_key = lambda q: (total_sum(q), q[0], q[1], q[2], q[3], q[4])

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
        for total in totals_asc:
            if total > limit_total or len(seen) >= max_unique:
                break
            yield from _iter_partition_for_total(
                total,
                reach_inner,
                full_reach,
                filter_fn=all_filter,
                sort_key=all_key,
                max_unique=max_unique,
                seen=seen,
            )


def optimize_dc_type4(
    inp: GeometryInputsType4,
    *,
    dp_list: Sequence[float],
    bur_target: float,
    eps: float,
    max_iter: int = _DEFAULT_MAX_ITER,
    history: Optional[List[IterationLogType4]] = None,
    patience_no_new_match: int = 0,
    max_matches: int = 0,
    max_total_dc: Optional[float] = None,
    on_progress: Optional[ProgressCallback] = None,
) -> OptimizeResultType4:
    if max_iter <= 0:
        raise ValueError("max_iter harus > 0.")
    if eps < 0:
        raise ValueError("eps harus >= 0.")
    if any(d <= 0 for d in dp_list):
        raise ValueError("Semua DP harus > 0.")

    dp_sorted = sorted(set(float(d) for d in dp_list))
    bur_fast = make_type4_bur_fast(inp)
    limit_total = max_total_dc if max_total_dc is not None else _estimate_max_total_dc(
        bur_fast, bur_target, dp_sorted
    )
    full_sorted = sorted(_build_reachable(dp_sorted, limit_total))
    totals, reach_inner = _reachable_layers(full_sorted, limit_total, dp_sorted)
    full_reach = set(full_sorted)
    max_unique = min(_MAX_UNIQUE_QUINTS, max(max_iter * 2, max_iter))

    per_bin = _DEFAULT_STORE_PER_BIN
    if max_matches > 0:
        per_bin = max(5, max_matches // 55)
    matches = _DiversityMatchStore(per_bin=per_bin, limit_total=limit_total)

    quint_iter = _iter_quints_diverse(
        totals,
        reach_inner,
        full_reach,
        limit_total,
        max_unique=max_unique,
    )

    planned_total = max_iter
    emit_progress = make_progress_emitter(on_progress, planned_total)

    best_sol: Optional[SolutionType4] = None
    best_err = math.inf
    quints_evaluated = 0
    unique_generated = 0
    iter_idx = 0

    last_total: Optional[float] = None
    batch_tested = 0
    batch_matches = 0
    batch_best: Optional[SolutionType4] = None
    batch_best_err = math.inf

    def flush_batch() -> None:
        nonlocal iter_idx, batch_tested, batch_matches
        nonlocal batch_best, batch_best_err, last_total
        if last_total is None or batch_tested == 0:
            return

        iter_idx += 1
        if history is not None and len(history) < 50 and best_sol is not None and batch_best is not None:
            history.append(
                IterationLogType4(
                    iter_idx=iter_idx,
                    total_dc=last_total,
                    quints_tested=batch_tested,
                    matches_found=batch_matches,
                    best_err_this_iter=batch_best.err,
                    best_total_this_iter=batch_best.total,
                    best_dc_a_this_iter=batch_best.DC_A,
                    best_dc_b_this_iter=batch_best.DC_B,
                    best_dc_c_this_iter=batch_best.DC_C,
                    best_dc_d_this_iter=batch_best.DC_D,
                    best_dc_e_this_iter=batch_best.DC_E,
                    best_bur_this_iter=batch_best.BUR,
                    best_err_so_far=best_sol.err,
                    best_total_so_far=best_sol.total,
                    best_dc_a_so_far=best_sol.DC_A,
                    best_dc_b_so_far=best_sol.DC_B,
                    best_dc_c_so_far=best_sol.DC_C,
                    best_dc_d_so_far=best_sol.DC_D,
                    best_dc_e_so_far=best_sol.DC_E,
                    best_bur_so_far=best_sol.BUR,
                    seen_size=len(totals),
                )
            )

        batch_tested = 0
        batch_matches = 0
        batch_best = None
        batch_best_err = math.inf

    for DC_A, DC_B, DC_C, DC_D, DC_E in quint_iter:
        if quints_evaluated >= max_iter:
            break
        unique_generated += 1
        if not _quint_valid(bur_fast, DC_A, DC_B, DC_C, DC_D, DC_E):
            continue

        total = DC_A + DC_B + DC_C + DC_D + DC_E
        if last_total is not None and total != last_total:
            flush_batch()
        last_total = total

        quints_evaluated += 1
        batch_tested += 1
        if quints_evaluated % _PROGRESS_EVERY == 0 or quints_evaluated >= max_iter:
            emit_progress(quints_evaluated)

        try:
            bur = calc_bur_fast_type4(
                bur_fast,
                DC_A=DC_A,
                DC_B=DC_B,
                DC_C=DC_C,
                DC_D=DC_D,
                DC_E=DC_E,
            )
        except ValueError:
            continue

        err = abs(bur - bur_target)
        sol = SolutionType4(
            DC_A=DC_A,
            DC_B=DC_B,
            DC_C=DC_C,
            DC_D=DC_D,
            DC_E=DC_E,
            total=total,
            BUR=bur,
            err=err,
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
            f"\nKeragaman: pendulum {stats['pendulum']}, fulcrum {stats['fulcrum']}, "
            f"penuh-DC {stats['dense_all']}, jarang-nol {stats['sparse_zero']}, "
            f"{stats['bins_used']} bin."
        )
        cap_note = ""
        if matches.matches_seen > len(all_matches):
            cap_note = (
                f"\n{matches.matches_seen} match; "
                f"{len(all_matches)} representatif disimpan."
            )

        msg = (
            f"Ditemukan {matches.matches_seen} kombinasi (±{eps:g} deg/100ft), "
            f"{len(all_matches)} solusi representatif beragam.\n"
            f"{quints_evaluated} evaluasi / {unique_generated} kandidat unik, "
            f"{len(totals)} total DC, batas ≈{limit_total:g} ft."
            f"{diversity_note}{cap_note}\n"
            f"Best: DC_A={best.DC_A:g} ft, DC_B={best.DC_B:g} ft, "
            f"DC_C={best.DC_C:g} ft, DC_D={best.DC_D:g} ft, DC_E={best.DC_E:g} ft, "
            f"Total={best.total:g} ft, BUR={best.BUR:.6g}, err={best.err:.6g}."
        )
        return OptimizeResultType4(
            solutions=all_matches,
            message=msg,
            exact_match=True,
            matches_found_total=matches.matches_seen,
        )

    tips = (
        "Coba ubah parameter berikut:\n"
        "- Perbesar toleransi eps\n"
        "- Ubah BUR_target\n"
        "- Tambahkan opsi DP tersedia\n"
        "- Perbesar max evaluasi kombinasi\n"
        "- Ubah geometri atau sudut x/y/z"
    )

    bur_ref = _reference_bur(bur_fast, dp_sorted[0])
    mode = "pendulum" if bur_target < bur_ref else "fulcrum"

    if best_sol is not None:
        msg = (
            f"Tidak ditemukan kombinasi dalam toleransi ±{eps:g} (deg/100ft).\n"
            f"Mode {mode}, {quints_evaluated} evaluasi, total DC hingga {limit_total:g} ft.\n"
            f"Terdekat: DC_A={best_sol.DC_A:g}, DC_B={best_sol.DC_B:g}, "
            f"DC_C={best_sol.DC_C:g}, DC_D={best_sol.DC_D:g}, DC_E={best_sol.DC_E:g}, "
            f"BUR={best_sol.BUR:.6g}, selisih={best_sol.err:.6g}.\n\n{tips}"
        )
        return OptimizeResultType4(
            solutions=[best_sol],
            message=msg,
            exact_match=False,
            matches_found_total=0,
        )

    msg = f"Tidak ada kombinasi valid (max_iter={max_iter}).\n{tips}"
    return OptimizeResultType4(
        solutions=[],
        message=msg,
        exact_match=False,
        matches_found_total=0,
    )
