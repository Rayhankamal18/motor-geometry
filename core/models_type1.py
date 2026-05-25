from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class GeometryInputs:
    # Lengths (ft)
    L_bit: float
    L_S1BH: float
    L_S2: float

    # Diameters (in)
    D_hole: float
    D_stab1: float
    D_stab2: float

    # Angle (deg)
    X_bent_housing_deg: float


@dataclass(frozen=True)
class CalcResult:
    DC_A: float
    DC_B: float
    S1: float
    S2: float
    L1: float
    L2: float
    Bprime: float
    B1: float
    B2: float
    Phi: float
    BUR: float


@dataclass(frozen=True)
class Solution:
    DC_A: float
    DC_B: float
    total: float
    BUR: float
    err: float


@dataclass(frozen=True)
class OptimizeResult:
    solutions: List[Solution]
    message: str
    exact_match: bool


@dataclass(frozen=True)
class IterationLog:
    iter_idx: int
    total_dc: float
    pairs_tested: int
    matches_found: int

    best_err_this_iter: float
    best_total_this_iter: float
    best_dc_a_this_iter: float
    best_dc_b_this_iter: float
    best_bur_this_iter: float

    best_err_so_far: float
    best_total_so_far: float
    best_dc_a_so_far: float
    best_dc_b_so_far: float
    best_bur_so_far: float
    heap_size: int
    seen_size: int
