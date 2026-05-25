from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, List, Optional

from app.services.solution_sort import composite_balance_score, sort_solutions
from core.progress import ProgressCallback
from core import GeometryInputs, calc_bur, optimize_dc


def geometry_from_dict(data: Dict[str, Any]) -> GeometryInputs:
    required = (
        "L_bit",
        "L_S1BH",
        "L_S2",
        "D_hole",
        "D_stab1",
        "D_stab2",
        "X_bent_housing_deg",
    )
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"Field geometri wajib: {', '.join(missing)}")
    return GeometryInputs(
        L_bit=float(data["L_bit"]),
        L_S1BH=float(data["L_S1BH"]),
        L_S2=float(data["L_S2"]),
        D_hole=float(data["D_hole"]),
        D_stab1=float(data["D_stab1"]),
        D_stab2=float(data["D_stab2"]),
        X_bent_housing_deg=float(data["X_bent_housing_deg"]),
    )


def run_calculate(payload: Dict[str, Any]) -> Dict[str, Any]:
    inp = geometry_from_dict(payload)
    DC_A = float(payload["DC_A"])
    DC_B = float(payload["DC_B"])
    result = calc_bur(inp, DC_A=DC_A, DC_B=DC_B)
    return asdict(result)


def run_optimize(
    payload: Dict[str, Any],
    *,
    on_progress: Optional[ProgressCallback] = None,
) -> Dict[str, Any]:
    inp = geometry_from_dict(payload)
    dp_list = payload.get("dp_list")
    if not isinstance(dp_list, list) or not dp_list:
        raise ValueError("dp_list harus berupa array angka > 0.")

    bur_target = float(payload["bur_target"])
    eps = float(payload.get("eps", 0.5))
    max_iter = int(payload.get("max_iter", 5000))
    max_total_dc = payload.get("max_total_dc")
    max_total_dc_f = float(max_total_dc) if max_total_dc is not None else None
    sort_mode = str(payload.get("sort_mode", "3"))
    include_history = bool(payload.get("include_history", False))

    history: Optional[List] = [] if include_history else None
    result = optimize_dc(
        inp,
        dp_list=[float(x) for x in dp_list],
        bur_target=bur_target,
        eps=eps,
        max_iter=max_iter,
        max_total_dc=max_total_dc_f,
        history=history,
        on_progress=on_progress,
    )

    sols_sorted: List = []
    if result.solutions:
        sols_sorted = sort_solutions(
            list(result.solutions),
            sort_mode,
            tie_breaker=lambda s: (s.DC_A, s.DC_B),
        )

    def _sol_dict(s):
        d = asdict(s)
        if str(sort_mode) == "3" and sols_sorted:
            d["balance_score"] = composite_balance_score(sols_sorted, s)
        return d

    return {
        "message": result.message,
        "found": result.exact_match,
        "approximate": not result.exact_match and len(sols_sorted) > 0,
        "bur_target": bur_target,
        "eps": eps,
        "total_matches": len(sols_sorted),
        "sort_mode": sort_mode,
        "solutions": [_sol_dict(s) for s in sols_sorted],
        "history": [asdict(h) for h in history] if history else [],
    }
