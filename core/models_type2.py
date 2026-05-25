from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class GeometryInputsType2:
    # Lengths (ft): bit, stab1, bent housing, stab2
    L_bit: float
    L_S1: float
    L_BH: float
    L_S2: float

    # Diameters (in)
    D_hole: float
    D_stab1: float
    D_stab2: float

    # Bent housing angle (deg)
    X_bent_housing_deg: float


@dataclass(frozen=True)
class CalcResultType2:
    DC_A: float
    DC_B: float
    DC_C: float
    S1: float
    S2: float
    A: float
    B: float
    C: float
    L1: float
    L2: float
    Bprime: float
    B1: float
    B2: float
    Phi: float
    BUR: float


@dataclass(frozen=True)
class SolutionType2:
    DC_A: float
    DC_B: float
    DC_C: float
    total: float
    BUR: float
    err: float


@dataclass(frozen=True)
class OptimizeResultType2:
    solutions: List[SolutionType2]
    message: str
    exact_match: bool
    matches_found_total: int = 0


@dataclass(frozen=True)
class IterationLogType2:
    iter_idx: int
    total_dc: float
    triples_tested: int
    matches_found: int

    best_err_this_iter: float
    best_total_this_iter: float
    best_dc_a_this_iter: float
    best_dc_b_this_iter: float
    best_dc_c_this_iter: float
    best_bur_this_iter: float

    best_err_so_far: float
    best_total_so_far: float
    best_dc_a_so_far: float
    best_dc_b_so_far: float
    best_dc_c_so_far: float
    best_bur_so_far: float
    seen_size: int
