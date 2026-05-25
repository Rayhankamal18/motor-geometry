from __future__ import annotations

import math
from typing import Callable, List, Optional, Sequence, Set, Tuple

from core.calculator_type1 import calc_bur
from core.progress import ProgressCallback, make_progress_emitter
from core.models_type1 import GeometryInputs, IterationLog, OptimizeResult, Solution
from core.shared_optimizer import build_reachable_dp, parse_dp_list


def _build_reachable(dp_list, max_total):
    return build_reachable_dp(dp_list, max_total)


def _estimate_max_total_dc(
    inp: GeometryInputs,
    bur_target: float,
    dp_list: Sequence[float],
) -> float:
    """
    Estimasi batas atas total DC berdasarkan prinsip fulcrum–pendulum (PDF Dril-036):

    - L1 (leg A, dekat bit / fulcrum): DC_A memanjangkan jarak ke bent-housing.
    - L2 (leg B, pendulum): DC_B memanjangkan jarak antar stabilizer → efek pendulum
      menurunkan sudut build (BUR turun saat L2 memanjang).

    Target BUR rendah → perlu DC_B panjang (pendulum).
    Target BUR tinggi → eksplorasi total DC lebih pendek (fulcrum).
    """
    dp_max = max(dp_list)
    bur_zero = calc_bur(inp, DC_A=0.0, DC_B=0.0).BUR

    if bur_zero > bur_target:
        lo, hi = 0.0, 1000.0
        for _ in range(50):
            mid = (lo + hi) / 2.0
            if calc_bur(inp, DC_A=0.0, DC_B=mid).BUR > bur_target:
                lo = mid
            else:
                hi = mid
        return min(1000.0, hi + 5.0 * dp_max)

    lo, hi = 0.0, 300.0
    for _ in range(50):
        mid = (lo + hi) / 2.0
        if calc_bur(inp, DC_A=0.0, DC_B=mid).BUR > bur_target:
            hi = mid
        else:
            lo = mid
    return min(300.0, hi + 3.0 * dp_max)


def _generate_pairs(reachable: Set[float]) -> List[Tuple[float, float]]:
    """Pasangan (DC_A, DC_B) valid: keduanya terbentuk dari DP dan DC_A + DC_B = T."""
    reach_sorted = sorted(reachable)
    pairs: List[Tuple[float, float]] = []
    for total in reach_sorted:
        for dc_a in reach_sorted:
            if dc_a > total:
                break
            dc_b = total - dc_a
            if dc_b in reachable:
                pairs.append((dc_a, dc_b))
    return pairs


def _order_pairs(
    inp: GeometryInputs,
    pairs: List[Tuple[float, float]],
    bur_target: float,
) -> List[Tuple[float, float]]:
    """
    Urutan evaluasi fulcrum–pendulum (PDF Dril-036):

    - **Pendulum** (DC_B panjang, DC_A kecil): menurunkan BUR — cocok jika target
      di bawah BUR(0,0).
    - **Fulcrum** (DC_A panjang, DC_B pendek): meningkatkan pengaruh dekat bit —
      juga bisa mencapai target yang sama dengan total DC berbeda.

    Untuk target menengah/rendah, gabungkan kedua regime (interleave) agar solusi
    DC_A > 0 tidak terlewat karena early-stop di cabang pendulum saja.
    """
    bur_zero = calc_bur(inp, DC_A=0.0, DC_B=0.0).BUR
    if bur_target >= bur_zero:
        return sorted(pairs, key=lambda p: (p[0] + p[1], p[0], p[1]))

    pendulum = sorted(pairs, key=lambda p: (p[0], -p[1], p[0] + p[1]))
    fulcrum = sorted(pairs, key=lambda p: (-p[0], p[1], p[0] + p[1]))

    merged: List[Tuple[float, float]] = []
    seen: set[Tuple[float, float]] = set()
    i = j = 0
    while i < len(pendulum) or j < len(fulcrum):
        if i < len(pendulum):
            p = pendulum[i]
            i += 1
            if p not in seen:
                seen.add(p)
                merged.append(p)
        if j < len(fulcrum):
            p = fulcrum[j]
            j += 1
            if p not in seen:
                seen.add(p)
                merged.append(p)
    return merged


def optimize_dc(
    inp: GeometryInputs,
    *,
    dp_list: Sequence[float],
    bur_target: float,
    eps: float,
    max_iter: int = 5000,
    top_k: int = 10,
    history: Optional[List[IterationLog]] = None,
    patience_no_new_match: int = 0,
    max_matches: int = 5000,
    max_total_dc: Optional[float] = None,
    on_progress: Optional[ProgressCallback] = None,
) -> OptimizeResult:
    if max_iter <= 0:
        raise ValueError("max_iter harus > 0.")
    if top_k <= 0:
        raise ValueError("top_k harus > 0.")
    if eps < 0:
        raise ValueError("eps harus >= 0.")
    if any(d <= 0 for d in dp_list):
        raise ValueError("Semua DP harus > 0.")

    dp_sorted = sorted(set(float(d) for d in dp_list))
    limit_total = max_total_dc if max_total_dc is not None else _estimate_max_total_dc(
        inp, bur_target, dp_sorted
    )
    reachable = _build_reachable(dp_sorted, limit_total)
    pairs_ordered = _order_pairs(inp, _generate_pairs(reachable), bur_target)
    planned_total = min(len(pairs_ordered), max_iter)
    emit_progress = make_progress_emitter(on_progress, planned_total)

    best_sol: Optional[Solution] = None
    best_err = math.inf
    all_matches: List[Solution] = []
    iters_since_new_match = 0
    pairs_evaluated = 0
    iter_idx = 0

    last_total: Optional[float] = None
    batch_pairs: List[Tuple[float, float]] = []
    batch_sols: List[Solution] = []
    batch_tested = 0
    batch_matches = 0
    batch_best: Optional[Solution] = None
    batch_best_err = math.inf

    def flush_batch() -> bool:
        nonlocal iter_idx, iters_since_new_match, batch_sols, batch_pairs
        nonlocal batch_tested, batch_matches, batch_best, batch_best_err, last_total
        if last_total is None or not batch_pairs:
            return False

        iter_idx += 1
        if history is not None and best_sol is not None and batch_best is not None:
            history.append(
                IterationLog(
                    iter_idx=iter_idx,
                    total_dc=last_total,
                    pairs_tested=batch_tested,
                    matches_found=batch_matches,
                    best_err_this_iter=batch_best.err,
                    best_total_this_iter=batch_best.total,
                    best_dc_a_this_iter=batch_best.DC_A,
                    best_dc_b_this_iter=batch_best.DC_B,
                    best_bur_this_iter=batch_best.BUR,
                    best_err_so_far=best_sol.err,
                    best_total_so_far=best_sol.total,
                    best_dc_a_so_far=best_sol.DC_A,
                    best_dc_b_so_far=best_sol.DC_B,
                    best_bur_so_far=best_sol.BUR,
                    heap_size=0,
                    seen_size=len(reachable),
                )
            )

        if batch_sols:
            all_matches.extend(batch_sols)
            iters_since_new_match = 0
        else:
            iters_since_new_match += 1

        batch_pairs = []
        batch_sols = []
        batch_tested = 0
        batch_matches = 0
        batch_best = None
        batch_best_err = math.inf
        return True

    for DC_A, DC_B in pairs_ordered:
        if pairs_evaluated >= max_iter:
            break
        total = DC_A + DC_B
        if last_total is not None and total != last_total:
            flush_batch()
            if max_matches > 0 and len(all_matches) >= max_matches:
                break
            if all_matches and patience_no_new_match > 0 and iters_since_new_match >= patience_no_new_match:
                break
        last_total = total
        batch_pairs.append((DC_A, DC_B))

        pairs_evaluated += 1
        batch_tested += 1
        emit_progress(pairs_evaluated)

        res = calc_bur(inp, DC_A=DC_A, DC_B=DC_B)
        err = abs(res.BUR - bur_target)
        sol = Solution(DC_A=DC_A, DC_B=DC_B, total=total, BUR=res.BUR, err=err)

        if err < batch_best_err:
            batch_best_err = err
            batch_best = sol
        if err < best_err:
            best_err = err
            best_sol = sol
        if err <= eps:
            batch_matches += 1
            batch_sols.append(sol)

    flush_batch()
    emit_progress(planned_total)

    if all_matches:
        best = min(all_matches, key=lambda s: (s.err, s.total, s.DC_A, s.DC_B))
        n_pendulum = sum(1 for s in all_matches if s.DC_A == 0.0)
        n_fulcrum = len(all_matches) - n_pendulum
        regime_note = ""
        if n_pendulum and n_fulcrum:
            regime_note = (
                f"\nRegime pendulum (DC_A~0): {n_pendulum}, "
                f"regime fulcrum (DC_A>0): {n_fulcrum}."
            )
        elif n_pendulum:
            regime_note = "\nHanya regime pendulum (DC_A=0) dalam toleransi."
        elif n_fulcrum:
            regime_note = "\nHanya regime fulcrum (DC_A>0) dalam toleransi."

        msg = (
            f"Ditemukan {len(all_matches)} kombinasi (±{eps:g} deg/100ft).\n"
            f"Rentang total DC: 0–{limit_total:g} ft, {pairs_evaluated} kombinasi dievaluasi."
            f"{regime_note}\n"
            f"Best: DC_A={best.DC_A:g} ft, DC_B={best.DC_B:g} ft, Total={best.total:g} ft, "
            f"BUR={best.BUR:.6g}, err={best.err:.6g}."
        )
        return OptimizeResult(solutions=all_matches, message=msg, exact_match=True)

    tips = (
        "Coba ubah parameter berikut:\n"
        "- Perbesar toleransi eps (mis. 0.5 → 1.0)\n"
        "- Ubah BUR_target\n"
        "- Tambahkan opsi DP tersedia (lebih banyak variasi panjang)\n"
        "- Ubah geometri tetap: L_bit, L_S1BH, L_S2, atau X (bend angle)\n"
        "- Ubah clearance lewat D_hole / D_stab1 / D_stab2"
    )

    if best_sol is not None:
        mode = "pendulum" if bur_target < calc_bur(inp, DC_A=0.0, DC_B=0.0).BUR else "fulcrum"
        msg = (
            f"Tidak ditemukan kombinasi dalam toleransi ±{eps:g} (deg/100ft).\n"
            f"Pencarian mode {mode} (fulcrum–pendulum), total DC hingga {limit_total:g} ft.\n"
            f"Menampilkan pendekatan terdekat ke BUR target ({bur_target:g}):\n"
            f"DC_A={best_sol.DC_A:g} ft, DC_B={best_sol.DC_B:g} ft, Total={best_sol.total:g} ft, "
            f"BUR={best_sol.BUR:.6g}, selisih={best_sol.err:.6g}.\n\n"
            f"{tips}"
        )
        return OptimizeResult(solutions=[best_sol], message=msg, exact_match=False)

    msg = f"Tidak ada kombinasi yang dievaluasi (max_iter={max_iter}).\n{tips}"
    return OptimizeResult(solutions=[], message=msg, exact_match=False)
