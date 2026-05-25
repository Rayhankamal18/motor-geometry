from __future__ import annotations

from core.models_type1 import CalcResult, GeometryInputs


def calc_bur(inp: GeometryInputs, *, DC_A: float, DC_B: float) -> CalcResult:
    """
    Motor geometry type-1:
      S1 = D_hole - D_stab1
      S2 = D_hole - D_stab2
      L1 = L_bit + DC_A + 0.5*L_S1BH
      L2 = 0.5*L_S1BH + DC_B + 0.5*L_S2
      B' = X
      B1 = (57.3*S1/24) * (1/L1 + 1/L2)
      B2 = (57.3*S2/24) * (1/L2)
      Phi = B' - B1 + B2
      BUR = (Phi*200) / (L1+L2)   [deg/100ft]
    """
    if DC_A < 0 or DC_B < 0:
        raise ValueError("DC_A dan DC_B harus >= 0.")

    S1 = inp.D_hole - inp.D_stab1
    S2 = inp.D_hole - inp.D_stab2

    L1 = inp.L_bit + DC_A + 0.5 * inp.L_S1BH
    L2 = 0.5 * inp.L_S1BH + DC_B + 0.5 * inp.L_S2

    Bprime = inp.X_bent_housing_deg

    B1 = (57.3 * S1 / 24.0) * ((1.0 / L1) + (1.0 / L2))
    B2 = (57.3 * S2 / 24.0) * (1.0 / L2)

    Phi = Bprime - B1 + B2
    BUR = (Phi * 200.0) / (L1 + L2)

    return CalcResult(
        DC_A=DC_A,
        DC_B=DC_B,
        S1=S1,
        S2=S2,
        L1=L1,
        L2=L2,
        Bprime=Bprime,
        B1=B1,
        B2=B2,
        Phi=Phi,
        BUR=BUR,
    )
