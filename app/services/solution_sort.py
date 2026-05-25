from __future__ import annotations

from typing import Callable, List, Protocol, Tuple, TypeVar

T = TypeVar("T", bound="SolutionLike")


class SolutionLike(Protocol):
    err: float
    total: float


def composite_balance_score(solutions: List[SolutionLike], solution: SolutionLike) -> float:
    """
    Skor kompromi error + total DC (semakin kecil semakin baik).

    Kedua tujuan dinormalisasi ke [0, 1] lalu dijumlahkan dengan bobot sama,
    sehingga urutan berbeda dari sort lexicographic (err, total).
    """
    errs = [s.err for s in solutions]
    totals = [s.total for s in solutions]
    min_e, max_e = min(errs), max(errs)
    min_t, max_t = min(totals), max(totals)
    span_e = max(max_e - min_e, 1e-12)
    span_t = max(max_t - min_t, 1e-12)
    norm_err = (solution.err - min_e) / span_e
    norm_total = (solution.total - min_t) / span_t
    return norm_err + norm_total


def sort_solutions(
    solutions: List[T],
    sort_mode: str,
    *,
    tie_breaker: Callable[[T], Tuple[float, ...]] | None = None,
) -> List[T]:
    """
    Mode 1: error terkecil dulu (abaikan panjang DC kecuali tie-break).
    Mode 2: total DC terpendek dulu.
    Mode 3: rekomendasi seimbang — skor komposit error + total DC (kompromi).
    """
    if not solutions:
        return solutions

    tb = tie_breaker or (lambda _s: ())

    mode = str(sort_mode)
    if mode == "1":
        return sorted(solutions, key=lambda s: (s.err, *tb(s)))
    if mode == "2":
        return sorted(solutions, key=lambda s: (s.total, *tb(s)))

    return sorted(
        solutions,
        key=lambda s: (composite_balance_score(solutions, s), *tb(s)),
    )
