from __future__ import annotations

from dataclasses import dataclass

from core.models_type4 import CalcResultType4, GeometryInputsType4


@dataclass(frozen=True, slots=True)
class Type4BurFast:
    """Konstanta geometri pra-hitung untuk loop optimizer."""

    s1: float
    s2: float
    a_off: float
    b_off: float
    c_off: float
    d_off: float
    e_off: float
    x: float
    y: float
    z: float
    k1: float
    k2: float


def make_type4_bur_fast(inp: GeometryInputsType4) -> Type4BurFast:
    s1 = inp.D_hole - inp.D_stab1
    s2 = inp.D_hole - inp.D_stab2
    return Type4BurFast(
        s1=s1,
        s2=s2,
        a_off=inp.L_bit + 0.5 * inp.L_TDB,
        b_off=0.5 * inp.L_TDB + 0.5 * inp.L_S1,
        c_off=0.5 * inp.L_S1 + 0.5 * inp.L_BH,
        d_off=0.5 * inp.L_BH + 0.5 * inp.L_BS,
        e_off=0.5 * inp.L_BS + 0.5 * inp.L_S2,
        x=inp.X_tdb_deg,
        y=inp.Y_bent_housing_deg,
        z=inp.Z_bent_sub_deg,
        k1=57.3 * s1 / 24.0,
        k2=57.3 * s2 / 24.0,
    )


def _sections(
    inp: GeometryInputsType4,
    dc_a: float,
    dc_b: float,
    dc_c: float,
    dc_d: float,
    dc_e: float,
) -> tuple[float, float, float, float, float]:
    a = inp.L_bit + dc_a + 0.5 * inp.L_TDB
    b = 0.5 * inp.L_TDB + dc_b + 0.5 * inp.L_S1
    c = 0.5 * inp.L_S1 + dc_c + 0.5 * inp.L_BH
    d = 0.5 * inp.L_BH + dc_d + 0.5 * inp.L_BS
    e = 0.5 * inp.L_BS + dc_e + 0.5 * inp.L_S2
    return a, b, c, d, e


def _bprime_type4(
    *,
    x: float,
    y: float,
    z: float,
    a: float,
    b: float,
    c: float,
    d: float,
    e: float,
) -> float:
    ab = a + b
    cde = c + d + e
    de = d + e
    if ab <= 0 or cde <= 0 or de <= 0:
        raise ValueError("A+B, C+D+E, dan D+E harus > 0 untuk B'.")
    mid = (y + z * (e / de)) * (de / cde)
    return mid + x * (a / ab)


def calc_bur_type4(
    inp: GeometryInputsType4,
    *,
    DC_A: float,
    DC_B: float,
    DC_C: float,
    DC_D: float,
    DC_E: float,
) -> CalcResultType4:
    """
    Motor geometry type-4 (335):
      A = L_bit + DC_A + 0.5*L_TDB
      B = 0.5*L_TDB + DC_B + 0.5*L_S1
      C = 0.5*L_S1 + DC_C + 0.5*L_BH
      D = 0.5*L_BH + DC_D + 0.5*L_BS
      E = 0.5*L_BS + DC_E + 0.5*L_S2
      L1 = A + B,  L2 = C + D + E
      B' = [y + z·E/(E+D)]·(D+E)/(C+D+E) + x·A/(A+B)
    """
    if any(v < 0 for v in (DC_A, DC_B, DC_C, DC_D, DC_E)):
        raise ValueError("DC_A … DC_E harus >= 0.")

    S1 = inp.D_hole - inp.D_stab1
    S2 = inp.D_hole - inp.D_stab2

    A, B, C, D, E = _sections(inp, DC_A, DC_B, DC_C, DC_D, DC_E)
    L1 = A + B
    L2 = C + D + E
    if L1 <= 0 or L2 <= 0:
        raise ValueError("L1 dan L2 harus > 0 (periksa panjang komponen dan DC).")

    Bprime = _bprime_type4(
        x=inp.X_tdb_deg,
        y=inp.Y_bent_housing_deg,
        z=inp.Z_bent_sub_deg,
        a=A,
        b=B,
        c=C,
        d=D,
        e=E,
    )

    B1 = (57.3 * S1 / 24.0) * ((1.0 / L1) + (1.0 / L2))
    B2 = (57.3 * S2 / 24.0) * (1.0 / L2)
    Phi = Bprime - B1 + B2
    BUR = (Phi * 200.0) / (L1 + L2)

    return CalcResultType4(
        DC_A=DC_A,
        DC_B=DC_B,
        DC_C=DC_C,
        DC_D=DC_D,
        DC_E=DC_E,
        S1=S1,
        S2=S2,
        A=A,
        B=B,
        C=C,
        D=D,
        E=E,
        L1=L1,
        L2=L2,
        Bprime=Bprime,
        B1=B1,
        B2=B2,
        Phi=Phi,
        BUR=BUR,
    )


def calc_bur_fast_type4(
    f: Type4BurFast,
    *,
    DC_A: float,
    DC_B: float,
    DC_C: float,
    DC_D: float,
    DC_E: float,
) -> float:
    a = f.a_off + DC_A
    b = f.b_off + DC_B
    c = f.c_off + DC_C
    d = f.d_off + DC_D
    e = f.e_off + DC_E
    l1 = a + b
    l2 = c + d + e
    if l1 <= 0 or l2 <= 0:
        raise ValueError("L1 dan L2 harus > 0.")

    de = d + e
    if de <= 0 or l2 <= 0:
        raise ValueError("D+E dan L2 harus > 0.")

    bprime = (f.y + f.z * (e / de)) * (de / l2) + f.x * (a / l1)
    b1 = f.k1 * ((1.0 / l1) + (1.0 / l2))
    b2 = f.k2 * (1.0 / l2)
    phi = bprime - b1 + b2
    return (phi * 200.0) / (l1 + l2)


def calc_bur_only_type4(
    inp: GeometryInputsType4,
    *,
    DC_A: float,
    DC_B: float,
    DC_C: float,
    DC_D: float,
    DC_E: float,
) -> float:
    if any(v < 0 for v in (DC_A, DC_B, DC_C, DC_D, DC_E)):
        raise ValueError("DC_A … DC_E harus >= 0.")
    return calc_bur_fast_type4(
        make_type4_bur_fast(inp),
        DC_A=DC_A,
        DC_B=DC_B,
        DC_C=DC_C,
        DC_D=DC_D,
        DC_E=DC_E,
    )
