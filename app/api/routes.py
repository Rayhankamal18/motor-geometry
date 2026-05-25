from __future__ import annotations

from flask import Blueprint, Response, jsonify, request

from app.services.geometry_service_type1 import run_calculate, run_optimize
from app.services.geometry_service_type2 import run_calculate_type2, run_optimize_type2
from app.services.geometry_service_type3 import run_calculate_type3, run_optimize_type3
from app.services.geometry_service_type4 import run_calculate_type4, run_optimize_type4
from app.services.optimize_stream import stream_optimize_ndjson

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.post("/calculate")
def calculate():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        result = run_calculate(payload)
        return jsonify({"ok": True, "result": result})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/optimize/stream")
def optimize_stream():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        return Response(
            stream_optimize_ndjson(payload, motor_type=1),
            mimetype="application/x-ndjson",
        )
    except (TypeError, ValueError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/optimize")
def optimize():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        data = run_optimize(payload)
        return jsonify({"ok": True, **data})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type2/calculate")
def calculate_type2():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        result = run_calculate_type2(payload)
        return jsonify({"ok": True, "result": result})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type2/optimize/stream")
def optimize_type2_stream():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        return Response(
            stream_optimize_ndjson(payload, motor_type=2),
            mimetype="application/x-ndjson",
        )
    except (TypeError, ValueError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type2/optimize")
def optimize_type2():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        data = run_optimize_type2(payload)
        return jsonify({"ok": True, **data})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type3/calculate")
def calculate_type3():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        result = run_calculate_type3(payload)
        return jsonify({"ok": True, "result": result})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type3/optimize/stream")
def optimize_type3_stream():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        return Response(
            stream_optimize_ndjson(payload, motor_type=3),
            mimetype="application/x-ndjson",
        )
    except (TypeError, ValueError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type3/optimize")
def optimize_type3():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        data = run_optimize_type3(payload)
        return jsonify({"ok": True, **data})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type4/calculate")
def calculate_type4():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        result = run_calculate_type4(payload)
        return jsonify({"ok": True, "result": result})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type4/optimize/stream")
def optimize_type4_stream():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        return Response(
            stream_optimize_ndjson(payload, motor_type=4),
            mimetype="application/x-ndjson",
        )
    except (TypeError, ValueError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.post("/type4/optimize")
def optimize_type4():
    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("Body harus berupa JSON object.")
        data = run_optimize_type4(payload)
        return jsonify({"ok": True, **data})
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@api_bp.get("/health")
def health():
    return jsonify({"ok": True, "service": "motor-geometry"})
