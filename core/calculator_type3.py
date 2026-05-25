from __future__ import annotations

from core.models_type3 import CalcResultType3, GeometryInputsType3


def calc_bur_type3(
    inp: GeometryInputsType3,
    *,
    DC_A: float,
    DC_B: float,
    DC_C: float,
    DC_D: float,
) -> CalcResultType3:
    """
    Motor geometry type-3:
      S1 = D_hole - D_stab1,  S2 = D_hole - D_stab2
      A = L_bit + DC_A + 0.5*L_S1
      B = 0.5*L_S1 + DC_B + 0.5*L_BH
      C = 0.5*L_BH + DC_C + 0.5*L_BS
      D = 0.5*L_BS + DC_D + 0.5*L_S2
      L1 = A,  L2 = B + C + D
      B' = [x + y·D/(C+D)] · (C+D)/(B+C+D) = (x·(C+D) + y·D) / (B+C+D)
      B1, B2, Phi, BUR — sama Tipe 1/2
    """
    if DC_A < 0 or DC_B < 0 or DC_C < 0 or DC_D < 0:
        raise ValueError("DC_A, DC_B, DC_C, dan DC_D harus >= 0.")

    S1 = inp.D_hole - inp.D_stab1
    S2 = inp.D_hole - inp.D_stab2

    A = inp.L_bit + DC_A + 0.5 * inp.L_S1
    B = 0.5 * inp.L_S1 + DC_B + 0.5 * inp.L_BH
    C = 0.5 * inp.L_BH + DC_C + 0.5 * inp.L_BS
    D = 0.5 * inp.L_BS + DC_D + 0.5 * inp.L_S2

    L1 = A
    L2 = B + C + D
    if L1 <= 0 or L2 <= 0:
        raise ValueError("L1 dan L2 harus > 0 (periksa panjang komponen dan DC).")

    bcd_sum = B + C + D
    if bcd_sum <= 0:
        raise ValueError("B + C + D harus > 0 untuk menghitung B'.")

    cd_sum = C + D
    Bprime = (
        inp.X_bent_housing_deg * cd_sum + inp.Y_bent_sub_deg * D
    ) / bcd_sum

    B1 = (57.3 * S1 / 24.0) * ((1.0 / L1) + (1.0 / L2))
    B2 = (57.3 * S2 / 24.0) * (1.0 / L2)

    Phi = Bprime - B1 + B2
    BUR = (Phi * 200.0) / (L1 + L2)

    return CalcResultType3(
        DC_A=DC_A,
        DC_B=DC_B,
        DC_C=DC_C,
        DC_D=DC_D,
        S1=S1,
        S2=S2,
        A=A,
        B=B,
        C=C,
        D=D,
        L1=L1,
        L2=L2,
        Bprime=Bprime,
        B1=B1,
        B2=B2,
        Phi=Phi,
        BUR=BUR,
    )


def calc_bur_only_type3(
    inp: GeometryInputsType3,
    *,
    DC_A: float,
    DC_B: float,
    DC_C: float,
    DC_D: float,
) -> float:
    """Hanya BUR — untuk loop optimizer (tanpa alokasi CalcResult)."""
    if DC_A < 0 or DC_B < 0 or DC_C < 0 or DC_D < 0:
        raise ValueError("DC_A, DC_B, DC_C, dan DC_D harus >= 0.")

    s1 = inp.D_hole - inp.D_stab1
    s2 = inp.D_hole - inp.D_stab2

    l1 = inp.L_bit + DC_A + 0.5 * inp.L_S1
    l2 = (
        0.5 * inp.L_S1
        + DC_B
        + 0.5 * inp.L_BH
        + 0.5 * inp.L_BH
        + DC_C
        + 0.5 * inp.L_BS
        + 0.5 * inp.L_BS
        + DC_D
        + 0.5 * inp.L_S2
    )
    if l1 <= 0 or l2 <= 0:
        raise ValueError("L1 dan L2 harus > 0.")

    b = 0.5 * inp.L_S1 + DC_B + 0.5 * inp.L_BH
    c = 0.5 * inp.L_BH + DC_C + 0.5 * inp.L_BS
    d = 0.5 * inp.L_BS + DC_D + 0.5 * inp.L_S2
    bcd = b + c + d
    if bcd <= 0:
        raise ValueError("B + C + D harus > 0.")

    cd = c + d
    bprime = (inp.X_bent_housing_deg * cd + inp.Y_bent_sub_deg * d) / bcd
    b1 = (57.3 * s1 / 24.0) * ((1.0 / l1) + (1.0 / l2))
    b2 = (57.3 * s2 / 24.0) * (1.0 / l2)
    phi = bprime - b1 + b2
    return (phi * 200.0) / (l1 + l2)
