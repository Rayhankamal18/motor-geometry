from __future__ import annotations

from typing import Callable, Optional

ProgressCallback = Callable[[int, int], None]


def make_progress_emitter(
    on_progress: Optional[ProgressCallback],
    total: int,
) -> Callable[[int], None]:
    """Kirim progress throttled (~1% atau setiap selesai)."""
    last_percent = [-1]

    def emit(done: int) -> None:
        if not on_progress or total <= 0:
            return
        done_clamped = min(done, total)
        percent = min(100, int(100 * done_clamped / total))
        if done_clamped >= total or percent != last_percent[0]:
            last_percent[0] = percent
            on_progress(done_clamped, total)

    return emit
