from __future__ import annotations

import json
import queue
import threading
from typing import Any, Dict, Generator

from app.services.geometry_service_type1 import run_optimize
from app.services.geometry_service_type2 import run_optimize_type2
from app.services.geometry_service_type3 import run_optimize_type3
from app.services.geometry_service_type4 import run_optimize_type4


def _stream_optimize_worker(
    event_q: queue.Queue,
    *,
    motor_type: int,
    payload: Dict[str, Any],
) -> None:
    def on_progress(done: int, total: int) -> None:
        percent = min(100, int(100 * done / total)) if total else 0
        event_q.put(
            {
                "type": "progress",
                "percent": percent,
                "evaluated": done,
                "total": total,
            }
        )

    try:
        if motor_type == 4:
            data = run_optimize_type4(payload, on_progress=on_progress)
        elif motor_type == 3:
            data = run_optimize_type3(payload, on_progress=on_progress)
        elif motor_type == 2:
            data = run_optimize_type2(payload, on_progress=on_progress)
        else:
            data = run_optimize(payload, on_progress=on_progress)
        event_q.put({"type": "done", "ok": True, **data})
    except (TypeError, ValueError, KeyError) as exc:
        event_q.put({"type": "error", "error": str(exc)})


def stream_optimize_ndjson(
    payload: Dict[str, Any],
    *,
    motor_type: int = 1,
) -> Generator[str, None, None]:
    """NDJSON stream: progress events lalu hasil akhir."""
    event_q: queue.Queue = queue.Queue()

    thread = threading.Thread(
        target=_stream_optimize_worker,
        kwargs={"event_q": event_q, "motor_type": motor_type, "payload": payload},
        daemon=True,
    )
    thread.start()

    while True:
        msg = event_q.get()
        yield json.dumps(msg, ensure_ascii=False) + "\n"
        if msg.get("type") in ("done", "error"):
            break

    thread.join(timeout=1.0)
