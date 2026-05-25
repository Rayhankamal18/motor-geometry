from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class GeometryInputsType3:
    # Lengths (ft)
    L_bit: float
    L_S1: float
    L_BH: float
    L_BS: float
    L_S2: float

    # Diameters (in)
    D_hole: float
    D_stab1: float
    D_stab2: float

    # Bend angles (deg): x = BH, y = BS
    X_bent_housing_deg: float
    Y_bent_sub_deg: float


@dataclass(frozen=True)
class CalcResultType3:
    DC_A: float
    DC_B: float
    DC_C: float
    DC_D: float
    S1: float
    S2: float
    A: float
    B: float
    C: float
    D: float
    L1: float
    L2: float
    Bprime: float
    B1: float
    B2: float
    Phi: float
    BUR: float


@dataclass(frozen=True)
class SolutionType3:
    DC_A: float
    DC_B: float
    DC_C: float
    DC_D: float
    total: float
    BUR: float
    err: float


@dataclass(frozen=True)
class OptimizeResultType3:
    solutions: List[SolutionType3]
    message: str
    exact_match: bool
    matches_found_total: int = 0


@dataclass(frozen=True)
class IterationLogType3:
    iter_idx: int
    total_dc: float
    quads_tested: int
    matches_found: int

    best_err_this_iter: float
    best_total_this_iter: float
    best_dc_a_this_iter: float
    best_dc_b_this_iter: float
    best_dc_c_this_iter: float
    best_dc_d_this_iter: float
    best_bur_this_iter: float

    best_err_so_far: float
    best_total_so_far: float
    best_dc_a_so_far: float
    best_dc_b_so_far: float
    best_dc_c_so_far: float
    best_dc_d_so_far: float
    best_bur_so_far: float
    seen_size: int
