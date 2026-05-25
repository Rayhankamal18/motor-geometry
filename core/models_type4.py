from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class GeometryInputsType4:
    # Lengths (ft)
    L_bit: float
    L_TDB: float
    L_S1: float
    L_BH: float
    L_BS: float
    L_S2: float

    # Diameters (in)
    D_hole: float
    D_stab1: float
    D_stab2: float

    # Bend angles (deg): x = TDB, y = BH, z = BS
    X_tdb_deg: float
    Y_bent_housing_deg: float
    Z_bent_sub_deg: float


@dataclass(frozen=True)
class CalcResultType4:
    DC_A: float
    DC_B: float
    DC_C: float
    DC_D: float
    DC_E: float
    S1: float
    S2: float
    A: float
    B: float
    C: float
    D: float
    E: float
    L1: float
    L2: float
    Bprime: float
    B1: float
    B2: float
    Phi: float
    BUR: float


@dataclass(frozen=True)
class SolutionType4:
    DC_A: float
    DC_B: float
    DC_C: float
    DC_D: float
    DC_E: float
    total: float
    BUR: float
    err: float


@dataclass(frozen=True)
class OptimizeResultType4:
    solutions: List[SolutionType4]
    message: str
    exact_match: bool
    matches_found_total: int = 0


@dataclass(frozen=True)
class IterationLogType4:
    iter_idx: int
    total_dc: float
    quints_tested: int
    matches_found: int

    best_err_this_iter: float
    best_total_this_iter: float
    best_dc_a_this_iter: float
    best_dc_b_this_iter: float
    best_dc_c_this_iter: float
    best_dc_d_this_iter: float
    best_dc_e_this_iter: float
    best_bur_this_iter: float

    best_err_so_far: float
    best_total_so_far: float
    best_dc_a_so_far: float
    best_dc_b_so_far: float
    best_dc_c_so_far: float
    best_dc_d_so_far: float
    best_dc_e_so_far: float
    best_bur_so_far: float
    seen_size: int
