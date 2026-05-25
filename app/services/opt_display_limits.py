"""Batas jumlah solusi optimizer yang dikirim ke browser."""

OPT_DISPLAY_DEFAULT = 280
OPT_DISPLAY_MAX = 350
OPT_DISPLAY_MIN = 1


def clamp_display_count(raw: int) -> int:
    if raw <= 0:
        return OPT_DISPLAY_DEFAULT
    return max(OPT_DISPLAY_MIN, min(raw, OPT_DISPLAY_MAX))
