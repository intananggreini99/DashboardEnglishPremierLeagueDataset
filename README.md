# Dashboard EPL 2020/21

## Tutorial Menjalankan Dashboard Webapps : 

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
