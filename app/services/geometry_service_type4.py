from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, List, Optional

from app.services.opt_display_limits import clamp_display_count
from app.services.solution_sort import composite_balance_score, sort_solutions
from core.calculator_type4 import calc_bur_type4
from core.models_type4 import GeometryInputsType4
from core.optimizer_type4 import optimize_dc_type4
from core.progress import ProgressCallback


def geometry_type4_from_dict(data: Dict[str, Any]) -> GeometryInputsType4:
    required = (
        "L_bit",
        "L_TDB",
        "L_S1",
        "L_BH",
        "L_BS",
        "L_S2",
        "D_hole",
        "D_stab1",
        "D_stab2",
        "X_tdb_deg",
        "Y_bent_housing_deg",
        "Z_bent_sub_deg",
    )
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"Field geometri wajib: {', '.join(missing)}")
    return GeometryInputsType4(
        L_bit=float(data["L_bit"]),
        L_TDB=float(data["L_TDB"]),
        L_S1=float(data["L_S1"]),
        L_BH=float(data["L_BH"]),
        L_BS=float(data["L_BS"]),
        L_S2=float(data["L_S2"]),
        D_hole=float(data["D_hole"]),
        D_stab1=float(data["D_stab1"]),
        D_stab2=float(data["D_stab2"]),
        X_tdb_deg=float(data["X_tdb_deg"]),
        Y_bent_housing_deg=float(data["Y_bent_housing_deg"]),
        Z_bent_sub_deg=float(data["Z_bent_sub_deg"]),
    )


def run_calculate_type4(payload: Dict[str, Any]) -> Dict[str, Any]:
    inp = geometry_type4_from_dict(payload)
    result = calc_bur_type4(
        inp,
        DC_A=float(payload["DC_A"]),
        DC_B=float(payload["DC_B"]),
        DC_C=float(payload["DC_C"]),
        DC_D=float(payload["DC_D"]),
        DC_E=float(payload["DC_E"]),
    )
    return asdict(result)


def run_optimize_type4(
    payload: Dict[str, Any],
    *,
    on_progress: Optional[ProgressCallback] = None,
) -> Dict[str, Any]:
    inp = geometry_type4_from_dict(payload)
    dp_list = payload.get("dp_list")
    if not isinstance(dp_list, list) or not dp_list:
        raise ValueError("dp_list harus berupa array angka > 0.")

    bur_target = float(payload["bur_target"])
    eps = float(payload.get("eps", 0.5))
    max_iter = int(payload.get("max_iter", 25000))
    max_results = clamp_display_count(int(payload.get("max_results", 0)))
    max_total_dc = payload.get("max_total_dc")
    max_total_dc_f = float(max_total_dc) if max_total_dc is not None else None
    sort_mode = str(payload.get("sort_mode", "3"))
    include_history = bool(payload.get("include_history", False))

    history: Optional[List] = [] if include_history else None
    result = optimize_dc_type4(
        inp,
        dp_list=[float(x) for x in dp_list],
        bur_target=bur_target,
        eps=eps,
        max_iter=max_iter,
        max_total_dc=max_total_dc_f,
        max_matches=max_results,
        history=history,
        on_progress=on_progress,
    )

    sols_sorted: List = []
    if result.solutions:
        sols_sorted = sort_solutions(
            list(result.solutions),
            sort_mode,
            tie_breaker=lambda s: (s.DC_A, s.DC_B, s.DC_C, s.DC_D, s.DC_E),
        )

    display = sols_sorted[:max_results]
    total_found = result.matches_found_total or len(sols_sorted)

    def _sol_dict(s):
        d = {
            "DC_A": s.DC_A,
            "DC_B": s.DC_B,
            "DC_C": s.DC_C,
            "DC_D": s.DC_D,
            "DC_E": s.DC_E,
            "total": s.total,
            "BUR": s.BUR,
            "err": s.err,
        }
        if str(sort_mode) == "3" and sols_sorted:
            d["balance_score"] = composite_balance_score(sols_sorted, s)
        return d

    hist_out = [asdict(h) for h in history[:50]] if history else []

    return {
        "message": result.message,
        "found": result.exact_match,
        "approximate": not result.exact_match and len(display) > 0,
        "bur_target": bur_target,
        "eps": eps,
        "total_matches": total_found,
        "displayed_matches": len(display),
        "max_results": max_results,
        "sort_mode": sort_mode,
        "solutions": [_sol_dict(s) for s in display],
        "history": hist_out,
    }
