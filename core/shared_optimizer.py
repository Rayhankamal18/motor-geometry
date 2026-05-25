from __future__ import annotations

import heapq
from typing import List, Sequence, Set


def parse_dp_list(text: str) -> List[float]:
    parts = [p.strip() for p in text.replace(";", ",").split(",") if p.strip()]
    if not parts:
        raise ValueError("DP list kosong.")
    dp: List[float] = []
    for p in parts:
        v = float(p)
        if v <= 0:
            raise ValueError("Semua DP harus > 0.")
        dp.append(v)
    return sorted(set(dp))


def diversity_zero_band(zeros: int, n_dc: int) -> int:
    """Pisahkan bin penyimpanan: penuh DC, satu nol, sparse, sangat sparse."""
    if zeros == 0:
        return 0
    if zeros == 1:
        return 1
    if zeros == n_dc - 1:
        return 2
    return 3


def build_reachable_dp(dp_list: Sequence[float], max_total: float) -> Set[float]:
    """Semua panjang DC yang dapat dibentuk dari kombinasi batang DP (subset sum)."""
    seen: Set[float] = {0.0}
    heap = [0.0]
    while heap:
        t = heapq.heappop(heap)
        for d in dp_list:
            nxt = t + d
            if nxt <= max_total and nxt not in seen:
                seen.add(nxt)
                heapq.heappush(heap, nxt)
    return seen
