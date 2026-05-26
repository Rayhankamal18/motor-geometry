# Panduan Deploy — Motor Geometry (Flask)

Deploy aplikasi ke internet untuk demo TA. **Rekomendasi utama: hosting gratis tanpa kartu kredit.**

| Platform | Gratis? | Kartu kredit? | Cocok untuk TA? |
|----------|---------|---------------|-----------------|
| **PythonAnywhere** | Ya (Beginner) | Tidak | **Paling disarankan** — Flask native |
| **Koyeb** | Ya (nano) | Tidak | Bagus, deploy dari GitHub |
| **Fly.io** | Kuota free | Ya (verifikasi) | Bagus jika punya kartu |
| **Render** | Free tier dibatasi/dihentikan | — | Banyak akun baru harus bayar |

Estimasi waktu pertama kali: **30–45 menit** (GitHub + PythonAnywhere).

---

## Ringkasan alur (PythonAnywhere)

```
Kode di laptop → GitHub → clone di PythonAnywhere → Web app → https://USER.pythonanywhere.com
```

Setelah deploy, halaman tersedia:

| Path | Isi |
|------|-----|
| `/` | Tipe 1 |
| `/type2` | Tipe 2 |
| `/type3` | Tipe 3 |
| `/type4` | Tipe 4 |
| `/api/health` | Cek API hidup |

---

## File deploy di repo

| File | Fungsi |
|------|--------|
| `run.py` | Entry Flask: `app = create_app()` |
| `wsgi.py` | Entry WSGI (PythonAnywhere) |
| `Procfile` | Start command (Koyeb / Railway / Heroku-style) |
| `requirements.txt` | `flask`, `gunicorn` |
| `Dockerfile` + `fly.toml` | Opsional — Fly.io |

---

## Bagian A — Persiapan di laptop

### 1. Install Git & Python

- Git: [https://git-scm.com/download/win](https://git-scm.com/download/win)
- Python 3.10+:

```powershell
python --version
cd "d:\Pembelajaran\Kuliah\TA\source_code"
python -m pip install -r requirements.txt
python run.py
```

Buka [http://127.0.0.1:5000](http://127.0.0.1:5000), lalu `Ctrl+C`.

### 2. Git commit & push ke GitHub

```powershell
cd "d:\Pembelajaran\Kuliah\TA\source_code"
git init
git add .
git commit -m "Motor geometry web app — siap deploy"
git branch -M main
git remote add origin https://github.com/NAMA_USER/motor-geometry.git
git push -u origin main
```

(Ganti `NAMA_USER`. Login GitHub pakai **Personal Access Token** jika diminta.)

---

## Bagian B — Deploy gratis di PythonAnywhere (disarankan)

**Kenapa ini?** Gratis, tanpa kartu, mendukung Flask + WSGI, URL stabil `https://username.pythonanywhere.com`.

### 1. Daftar akun

1. Buka [https://www.pythonanywhere.com](https://www.pythonanywhere.com)
2. **Pricing & signup** → plan **Beginner** (gratis)
3. Buat username, mis. `rayhan-ta` → URL nanti: `https://rayhan-ta.pythonanywhere.com`

### 2. Clone project dari GitHub

Tab **Consoles** → **Bash**:

```bash
cd ~
git clone https://github.com/NAMA_USER/motor-geometry.git
cd motor-geometry
pip install --user -r requirements.txt
```

Jika `git clone` gagal (repo private), upload ZIP lewat tab **Files** lalu extract di `/home/USERNAME/motor-geometry`.

### 3. Buat Web app

Tab **Web** → **Add a new web app**:

| Pilihan | Nilai |
|---------|--------|
| Framework | **Manual configuration** |
| Python | **3.12** (atau 3.11) |

Lalu di konfigurasi web app:

| Field | Nilai |
|-------|--------|
| **Source code** | `/home/USERNAME/motor-geometry` |
| **Working directory** | `/home/USERNAME/motor-geometry` |
| **WSGI configuration file** | Klik link file → ganti isi dengan di bawah |

Isi file WSGI (ganti `USERNAME`):

```python
import sys
path = "/home/USERNAME/motor-geometry"
if path not in sys.path:
    sys.path.insert(0, path)

from run import app as application
```

Atau cukup:

```python
from run import app as application
```

…jika working directory sudah benar.

### 4. Virtualenv (disarankan)

Di tab **Web**, bagian **Virtualenv**:

```
/home/USERNAME/motor-geometry/venv
```

Di Bash (sekali saja):

```bash
cd ~/motor-geometry
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Lalu **Reload** web app.

### 5. Static files (CSS/JS)

Di tab **Web**, bagian **Static files** → **Add**:

| URL | Directory |
|-----|-----------|
| `/static/` | `/home/USERNAME/motor-geometry/static/` |

Klik **Reload** lagi.

### 6. Variabel lingkungan (opsional)

Di WSGI file, bisa set:

```python
import os
os.environ.setdefault("SECRET_KEY", "ganti-dengan-string-acak-panjang")
```

Atau tambahkan di file terpisah yang di-import sebelum `create_app`.

### 7. Verifikasi

1. Buka `https://USERNAME.pythonanywhere.com`
2. Cek `/api/health` → `{"ok": true, ...}`
3. Tes kalkulator & optimizer (Tipe 4 bisa lama — normal)

### 8. Update kode setelah ada perubahan

```bash
cd ~/motor-geometry
git pull
# jika pakai venv:
source venv/bin/activate && pip install -r requirements.txt
```

Lalu tab **Web** → tombol hijau **Reload**.

### Catatan PythonAnywhere (gratis)

| Hal | Penjelasan |
|-----|------------|
| **Reload manual** | Setiap update kode, klik **Reload** di tab Web |
| **CPU** | Optimizer berat (Tipe 3/4) lebih lambat dari laptop |
| **HTTPS** | Otomatis di `*.pythonanywhere.com` |
| **Database** | Tidak dipakai — tidak perlu setup DB |
| **Outbound internet** | Akun gratis terbatas; aplikasi ini tidak butuh API eksternal |

---

## Bagian C — Alternatif: Koyeb (gratis, dari GitHub)

1. [https://www.koyeb.com](https://www.koyeb.com) → signup (GitHub)
2. **Create App** → **GitHub** → pilih repo `motor-geometry`
3. **Builder**: Python / atau Dockerfile
4. **Run command** (jika tanpa Docker):

```
gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120 run:app
```

5. **Environment**: `SECRET_KEY` = string acak
6. **Instance**: Free nano
7. Deploy → URL `https://....koyeb.app`

`Procfile` di repo sudah siap jika platform mendeteksi otomatis.

---

## Bagian D — Alternatif: Fly.io (kuota free, perlu kartu)

```powershell
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
cd "d:\Pembelajaran\Kuliah\TA\source_code"
fly launch --no-deploy
fly secrets set SECRET_KEY="string-acak-panjang"
fly deploy
```

File `Dockerfile` dan `fly.toml` sudah disediakan. Region default: Singapore (`sin`).

---

## Bagian E — Render (jika tidak ada opsi gratis)

Render **tidak lagi** menawarkan free tier yang stabil untuk banyak pengguna baru. Jika dashboard hanya menampilkan plan berbayar:

- Pakai **PythonAnywhere** atau **Koyeb** di atas, atau
- Upgrade Render (Starter ~$7/bulan)

Konfigurasi lama (jika Anda sudah punya free tier):

| Field | Nilai |
|-------|--------|
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 run:app` |

---

## Demo tanpa cloud (WiFi kampus)

```powershell
cd "d:\Pembelajaran\Kuliah\TA\source_code"
python -m pip install waitress
python -c "from run import app; from waitress import serve; serve(app, host='0.0.0.0', port=5000)"
```

Dari HP di WiFi sama: `http://IP-LAPTOP:5000` (`ipconfig` → IPv4).

---

## Troubleshooting

### Halaman 502 / error di PythonAnywhere

- Tab **Web** → **Error log** / **Server log**
- Pastikan `pip install -r requirements.txt` sukses di venv yang sama
- Pastikan path static files benar

### Optimizer timeout

- Kurangi `max_iter` di UI
- PythonAnywhere: request web dibatasi ~5 menit (cukup untuk kebanyakan kasus)

### CSS/JS tidak load

- Pastikan mapping **Static files** `/static/` → folder `static/`

### `git` tidak dikenali

- Install Git, restart terminal

---

## Checklist presentasi TA

- [ ] URL publik bisa dibuka dari HP
- [ ] `/api/health` → `ok: true`
- [ ] Kalkulator & optimizer Tipe 4 jalan
- [ ] Screenshot URL + tab Web/logs disimpan untuk laporan

---

## Butuh bantuan?

Siapkan:

1. Platform yang dipakai (PythonAnywhere / Koyeb / Fly)
2. URL aplikasi
3. Cuplikan **error log** dari dashboard hosting
