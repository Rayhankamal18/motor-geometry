from __future__ import annotations

from dataclasses import dataclass

from core.models_type2 import CalcResultType2, GeometryInputsType2


@dataclass(frozen=True, slots=True)
class Type2BurFast:
    """Konstanta geometri pra-hitung untuk loop optimizer."""

    l1_off: float
    b_off: float
    c_off: float
    x: float
    k1: float
    k2: float


def make_type2_bur_fast(inp: GeometryInputsType2) -> Type2BurFast:
    s1 = inp.D_hole - inp.D_stab1
    s2 = inp.D_hole - inp.D_stab2
    return Type2BurFast(
        l1_off=inp.L_bit + 0.5 * inp.L_S1,
        b_off=0.5 * inp.L_S1 + 0.5 * inp.L_BH,
        c_off=0.5 * inp.L_BH + 0.5 * inp.L_S2,
        x=inp.X_bent_housing_deg,
        k1=57.3 * s1 / 24.0,
        k2=57.3 * s2 / 24.0,
    )


def calc_bur_fast_type2(f: Type2BurFast, *, DC_A: float, DC_B: float, DC_C: float) -> float:
    l1 = f.l1_off + DC_A
    b_sec = f.b_off + DC_B
    c_sec = f.c_off + DC_C
    l2 = b_sec + c_sec
    if l1 <= 0 or l2 <= 0:
        raise ValueError("L1 dan L2 harus > 0.")

    bprime = f.x * (c_sec / l2)
    b1 = f.k1 * ((1.0 / l1) + (1.0 / l2))
    b2 = f.k2 * (1.0 / l2)
    phi = bprime - b1 + b2
    return (phi * 200.0) / (l1 + l2)


def calc_bur_type2(
    inp: GeometryInputsType2,
    *,
    DC_A: float,
    DC_B: float,
    DC_C: float,
) -> CalcResultType2:
    """
    Motor geometry type-2:
      S1 = D_hole - D_stab1,  S2 = D_hole - D_stab2
      A = L_bit + DC_A + 0.5*L_S1
      B = 0.5*L_S1 + DC_B + 0.5*L_BH
      C = 0.5*L_BH + DC_C + 0.5*L_S2
      L1 = A,  L2 = B + C
      B' = x * C/(B+C)
      B1 = (57.3*S1/24) * (1/L1 + 1/L2)
      B2 = (57.3*S2/24) * (1/L2)
      Phi = B' - B1 + B2
      BUR = (Phi*200) / (L1+L2)   [deg/100ft]
    """
    if DC_A < 0 or DC_B < 0 or DC_C < 0:
        raise ValueError("DC_A, DC_B, dan DC_C harus >= 0.")

    S1 = inp.D_hole - inp.D_stab1
    S2 = inp.D_hole - inp.D_stab2

    A = inp.L_bit + DC_A + 0.5 * inp.L_S1
    B = 0.5 * inp.L_S1 + DC_B + 0.5 * inp.L_BH
    C = 0.5 * inp.L_BH + DC_C + 0.5 * inp.L_S2

    L1 = A
    L2 = B + C
    if L1 <= 0 or L2 <= 0:
        raise ValueError("L1 dan L2 harus > 0 (periksa panjang komponen dan DC).")

    bc_sum = B + C
    if bc_sum <= 0:
        raise ValueError("B + C harus > 0 untuk menghitung B'.")

    Bprime = inp.X_bent_housing_deg * (C / bc_sum)

    B1 = (57.3 * S1 / 24.0) * ((1.0 / L1) + (1.0 / L2))
    B2 = (57.3 * S2 / 24.0) * (1.0 / L2)

    Phi = Bprime - B1 + B2
    BUR = (Phi * 200.0) / (L1 + L2)

    return CalcResultType2(
        DC_A=DC_A,
        DC_B=DC_B,
        DC_C=DC_C,
        S1=S1,
        S2=S2,
        A=A,
        B=B,
        C=C,
        L1=L1,
        L2=L2,
        Bprime=Bprime,
        B1=B1,
        B2=B2,
        Phi=Phi,
        BUR=BUR,
    )


def calc_bur_only_type2(
    inp: GeometryInputsType2,
    *,
    DC_A: float,
    DC_B: float,
    DC_C: float,
) -> float:
    """Hanya BUR — untuk loop optimizer (tanpa alokasi CalcResult)."""
    if DC_A < 0 or DC_B < 0 or DC_C < 0:
        raise ValueError("DC_A, DC_B, dan DC_C harus >= 0.")
    return calc_bur_fast_type2(make_type2_bur_fast(inp), DC_A=DC_A, DC_B=DC_B, DC_C=DC_C)
