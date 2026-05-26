# Motor Geometry (PDM BHA)

Program untuk menghitung **BUR (deg/100ft)** — **Tipe 1–4**.

**Deploy online:** lihat panduan lengkap di [DEPLOY.md](DEPLOY.md).

## Tipe 1

Rumus Geometri Motor Tipe 1:

- \(S_1 = D_h - D_{s1}\), \(S_2 = D_h - D_{s2}\)
- \(L_1 = L_\text{bit} + DC_A + 0.5 L_{S1BH}\)
- \(L_2 = 0.5 L_{S1BH} + DC_B + 0.5 L_{S2}\)
- \(B' = X\)
- \(B_1 = (57.3 S_1 / 24)\, (1/L_1 + 1/L_2)\)
- \(B_2 = (57.3 S_2 / 24)\, (1/L_2)\)
- \(\Phi = B' - B_1 + B_2\)
- \(BUR = (\Phi \cdot 200)/(L_1+L_2)\)

## Struktur direktori & penamaan file

Konvensi: **`_typeN`** = khusus tipe motor N · **`shared_`** = dipakai semua tipe

```
source_code/
├── core/
│   ├── calculator_type1.py … calculator_type4.py
│   ├── models_type1.py … models_type4.py
│   ├── optimizer_type1.py … optimizer_type4.py
│   └── shared_optimizer.py      # parse DP, subset-sum (semua tipe)
├── app/
│   ├── api/routes.py
│   └── services/
│       ├── geometry_service_type1.py … type4.py
│       ├── optimize_stream.py
│       └── solution_sort.py     # urutan & skor solusi
├── templates/
│   ├── type1.html … type4.html
│   └── _shared_*.html              # potongan UI bersama
├── static/
│   ├── css/shared.css
│   └── js/                         # shared_*.js, app_typeN.js, vendor/
├── cli/
├── run.py
├── wsgi.py                         # deploy PythonAnywhere
└── motor_geometry_type1.py           # entry CLI (opsional)
```

## Instalasi

```bash
pip install -r requirements.txt
```

## Menjalankan Web UI

```bash
python run.py
```

Buka browser:
- Tipe 1: [http://127.0.0.1:5000](http://127.0.0.1:5000)
- Tipe 2: [http://127.0.0.1:5000/type2](http://127.0.0.1:5000/type2)

### Tipe 1 — Mode di UI
- **Kalkulator**: `DC_A`, `DC_B` → BUR.
- **Optimizer**: cari kombinasi `DC_A` / `DC_B`.

## Tipe 2

Section A/B/C dan sudut ekuivalen:

- \(A = L_{bit} + DC_A + \tfrac{1}{2}L_{S1}\)
- \(B = \tfrac{1}{2}L_{S1} + DC_B + \tfrac{1}{2}L_{BH}\)
- \(C = \tfrac{1}{2}L_{BH} + DC_C + \tfrac{1}{2}L_{S2}\)
- \(L_1 = A,\; L_2 = B + C\)
- \(B' = x \cdot C/(B+C)\)
- \(B_1, B_2, \Phi, BUR\) sama seperti Tipe 1

### Tipe 2 — Mode di UI
- **Kalkulator**: `DC_A`, `DC_B`, `DC_C` → BUR.
- **Optimizer**: cari kombinasi **tiga** DC dari daftar DP.

## API Endpoints

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/health` | Cek status API |
| POST | `/api/calculate` | Hitung BUR |
| POST | `/api/optimize` | Optimasi DC (Tipe 1) |
| POST | `/api/type2/calculate` | Hitung BUR (Tipe 2) |
| POST | `/api/type2/optimize` | Optimasi DC_A, DC_B, DC_C |

### Contoh `POST /api/calculate`

```json
{
  "L_bit": 8,
  "L_S1BH": 12,
  "L_S2": 6,
  "D_hole": 8.5,
  "D_stab1": 6.75,
  "D_stab2": 6.5,
  "X_bent_housing_deg": 1.5,
  "DC_A": 0,
  "DC_B": 7
}
```

### Contoh `POST /api/optimize`

```json
{
  "L_bit": 8,
  "L_S1BH": 12,
  "L_S2": 6,
  "D_hole": 8.5,
  "D_stab1": 6.75,
  "D_stab2": 6.5,
  "X_bent_housing_deg": 1.5,
  "dp_list": [3, 7, 10],
  "bur_target": 8,
  "eps": 0.5,
  "sort_mode": "3",
  "include_history": false
}
```

## Menjalankan CLI (terminal)

```bash
python motor_geometry_type1.py
```
