# Dashboard EPL 2020/21 — revisi visualisasi

Dashboard D3.js untuk penyelenggara dan penonton, berdasarkan panduan **Eksplorasi Data EPL 2020/21 – Statistik Pemain** yang dilampirkan. Paket memuat source code, CSS hasil build, D3 lokal, dataset asli, Docker Compose, serta pengujian.

## Memperbarui dashboard yang sudah berjalan

1. Ekstrak ZIP revisi ke folder sementara.
2. Salin seluruh folder `frontend` dari paket ini untuk mengganti folder `frontend` pada proyek lama. Ketiga file JS saling bergantung; jangan hanya menyalin `app.js`.
3. Buka PowerShell/terminal pada folder proyek lama yang memuat `compose.yaml`, kemudian jalankan:

   ```powershell
   docker compose up -d --build --no-deps penyelenggara penonton
   ```

   Perintah ini cocok jika API dan database proyek lama masih berjalan. CSS siap pakai sudah disertakan; tidak perlu menjalankan npm untuk pembaruan ini. Konfigurasi lokal `compose.yaml`, `.env`, dataset, dan volume PostgreSQL dapat tetap digunakan.
4. Muat ulang browser dengan **Ctrl + F5**.

Jika layanan sebelumnya belum berjalan, gunakan langkah menjalankan paket lengkap di bawah.

## Menjalankan paket lengkap

1. Ekstrak ZIP dan buka folder `epl-dual-dashboard` di VS Code.
2. Pastikan Docker Desktop aktif dalam mode Linux containers.
3. Dataset sudah tersedia pada `data/epl-goalScorer(20-21)(in).csv` (522 pemain). Nama ini sama persis dengan `DATASET_PATH` dalam `compose.yaml`. Jika nama file diubah, sesuaikan path tersebut.
4. Jalankan dari folder yang memuat `compose.yaml`:

   ```powershell
   docker compose up --build -d
   docker compose ps -a
   ```

   Importer merupakan proses satu kali; status `Exited (0)` menandakan impor berhasil.
5. Buka alamat berikut:

   | Dashboard | Alamat |
   |---|---|
   | Penyelenggara | http://localhost:8081 |
   | Penonton | http://localhost:8082 |

Jika belum tampil, periksa `docker compose logs --tail=100 importer api`.