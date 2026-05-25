from __future__ import annotations

import csv
from dataclasses import asdict
from typing import List, Sequence

from core import GeometryInputs, IterationLog, calc_bur, optimize_dc, parse_dp_list


def _ask_float(prompt: str) -> float:
    while True:
        try:
            return float(input(prompt).strip())
        except ValueError:
            print("Input tidak valid. Masukkan angka (contoh: 8.5).")


def _print_calc(res) -> None:
    print("\n=== HASIL PERHITUNGAN ===")
    print(f"DC_A (ft)           : {res.DC_A:g}")
    print(f"DC_B (ft)           : {res.DC_B:g}")
    print(f"S1 (in)             : {res.S1:g}")
    print(f"S2 (in)             : {res.S2:g}")
    print(f"L1=A (ft)           : {res.L1:g}")
    print(f"L2=B (ft)           : {res.L2:g}")
    print(f"B' (deg)            : {res.Bprime:g}")
    print(f"B1 (deg)            : {res.B1:g}")
    print(f"B2 (deg)            : {res.B2:g}")
    print(f"Phi (deg)           : {res.Phi:g}")
    print(f"BUR (deg/100ft)     : {res.BUR:g}")


def _print_iteration_history(history: Sequence[IterationLog]) -> None:
    if not history:
        print("\n(Tidak ada history iterasi.)")
        return

    print("\n=== HISTORY ITERASI ===")
    print(
        "iter | T(total) | pairs | match | best_iter(err,total,DC_A,DC_B,BUR) | best_so_far(err,total,DC_A,DC_B,BUR) | heap | seen"
    )
    for h in history:
        print(
            f"{h.iter_idx:>4} | {h.total_dc:>7g} | {h.pairs_tested:>5} | {h.matches_found:>5} | "
            f"{h.best_err_this_iter:>7.5g},{h.best_total_this_iter:>7g},"
            f"{h.best_dc_a_this_iter:g},{h.best_dc_b_this_iter:g},{h.best_bur_this_iter:>7.5g} | "
            f"{h.best_err_so_far:>7.5g},{h.best_total_so_far:>7g},"
            f"{h.best_dc_a_so_far:g},{h.best_dc_b_so_far:g},{h.best_bur_so_far:>7.5g} | "
            f"{h.heap_size:>4} | {h.seen_size:>4}"
        )


def _export_iteration_history_csv(history: Sequence[IterationLog], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(asdict(history[0]).keys()))
        w.writeheader()
        for h in history:
            w.writerow(asdict(h))


def main() -> None:
    print("Motor Geometry Type-1 (PDM BHA) Calculator/Optimizer\n")
    print("Satuan: panjang ft, diameter in, sudut deg.\n")

    inp = GeometryInputs(
        L_bit=_ask_float("Panjang Bit L_bit (ft): "),
        L_S1BH=_ask_float("Panjang S1 & BH L_S1BH (ft): "),
        L_S2=_ask_float("Panjang Stabilizer 2 L_S2 (ft): "),
        D_hole=_ask_float("Hole diameter D_hole (in): "),
        D_stab1=_ask_float("Diameter stabilizer 1 D_stab1 (in): "),
        D_stab2=_ask_float("Diameter stabilizer 2 D_stab2 (in): "),
        X_bent_housing_deg=_ask_float("Bent housing angle X (deg): "),
    )

    print("\nPilih mode:")
    print("1) Kalkulator (input DC_A & DC_B langsung)")
    print("2) Optimizer (cari kombinasi DC_A/DC_B dari DP tersedia)")
    mode = input("Mode (1/2): ").strip()

    if mode == "1":
        DC_A = _ask_float("DC_A (ft): ")
        DC_B = _ask_float("DC_B (ft): ")
        res = calc_bur(inp, DC_A=DC_A, DC_B=DC_B)
        _print_calc(res)
        return

    if mode == "2":
        dp_text = input("DP tersedia (ft) pisahkan koma, contoh: 3,7,10 : ").strip()
        dp_list = parse_dp_list(dp_text)
        bur_target = _ask_float("BUR target (deg/100ft): ")
        eps = _ask_float("Error toleransi eps (deg/100ft), contoh 0.5: ")

        history: List[IterationLog] = []
        opt_result = optimize_dc(
            inp,
            dp_list=dp_list,
            bur_target=bur_target,
            eps=eps,
            max_iter=5000,
            history=history,
        )
        print("\n" + opt_result.message)
        if not opt_result.solutions:
            show_hist = input("\nTampilkan history iterasi? (y/n): ").strip().lower()
            if show_hist == "y":
                _print_iteration_history(history)
                export_csv = input("\nExport ke CSV? (y/n): ").strip().lower()
                if export_csv == "y" and history:
                    out_path = input("Nama file (contoh: iteration_log.csv): ").strip() or "iteration_log.csv"
                    _export_iteration_history_csv(history, out_path)
                    print(f"CSV tersimpan: {out_path}")
            return

        print("\nUrutkan solusi berdasarkan:")
        print("1) Prioritas error BUR saja")
        print("2) Prioritas total DC terpendek saja")
        print("3) Rekomendasi seimbang (skor komposit error + total DC)")
        sort_mode = input("Pilih (1/2/3, default 3): ").strip() or "3"
        from app.services.solution_sort import sort_solutions

        sols_sorted = sort_solutions(
            list(opt_result.solutions),
            sort_mode,
            tie_breaker=lambda s: (s.DC_A, s.DC_B),
        )

        show_n_text = input(f"\nTampilkan berapa solusi? (default 10, max {len(sols_sorted)}): ").strip()
        try:
            show_n = int(show_n_text) if show_n_text else 10
        except ValueError:
            show_n = 10
        show_n = max(1, min(show_n, len(sols_sorted)))

        print(f"\n=== SOLUSI (tampil {show_n} dari {len(sols_sorted)}) ===")
        for i, s in enumerate(sols_sorted[:show_n], start=1):
            print(
                f"{i:>2}. DC_A={s.DC_A:g} ft, DC_B={s.DC_B:g} ft, "
                f"Total={s.total:g} ft, BUR={s.BUR:.6g}, err={s.err:.6g}"
            )

        pick = input("\nLihat detail solusi nomor berapa? (Enter skip): ").strip()
        if pick:
            try:
                idx = int(pick)
                if 1 <= idx <= show_n:
                    chosen = sols_sorted[idx - 1]
                    _print_calc(calc_bur(inp, DC_A=chosen.DC_A, DC_B=chosen.DC_B))
                else:
                    print("Nomor di luar rentang.")
            except ValueError:
                print("Input tidak valid.")

        show_hist = input("\nTampilkan history iterasi? (y/n): ").strip().lower()
        if show_hist == "y":
            _print_iteration_history(history)
            export_csv = input("\nExport ke CSV? (y/n): ").strip().lower()
            if export_csv == "y" and history:
                out_path = input("Nama file (contoh: iteration_log.csv): ").strip() or "iteration_log.csv"
                _export_iteration_history_csv(history, out_path)
                print(f"CSV tersimpan: {out_path}")
        return

    print("Mode tidak dikenal. Jalankan ulang dan pilih 1 atau 2.")
