# Impor Project "folio-v2" dari GitHub

folio adalah app pembukuan penjualan untuk usaha tanaman aglonema: mencatat persediaan, pesanan, customer, dan supplier, lalu mengekspor data.
Project diambil dari repo publik `tetukuidn/folio-v2` (branch `main`), dipasang di sini, dan dijalankan apa adanya.

## Untuk siapa
- Pemilik dan pengelola usaha aglonema yang mencatat penjualan, stok, dan pelanggan dari HP.
- Pemilik repo, yang ingin project ini jalan di environment ini supaya bisa dikembangkan lagi nanti.

## Fitur dan pengalaman inti (sesuai repo, tidak ada yang diubah)
- **Login Google** — masuk dengan akun Google lewat login Google yang dikelola Emergent (tidak perlu API key).
- **Dashboard** — ringkasan penjualan.
- **Persediaan** — daftar dan kelola stok tanaman.
- **Pesanan & Pesanan Baru** — catat dan lihat pesanan, lengkap dengan pemilih tanggal.
- **Customer & Supplier** — data pelanggan dan pemasok.
- **Ekspor** — ekspor data ke file spreadsheet, salin ke clipboard, dan bagikan.
- Navigasi tab bawah, font, dan gambar sama seperti di repo.

## Alur pengguna
1. Buka app → layar login "folio — lembar pembukuan penjualan aglonema".
2. Ketuk "Masuk untuk mulai" → login Google → kembali ke app.
3. Masuk ke dashboard → pindah antar tab (persediaan, pesanan, customer, dll.).
4. Tambah atau ubah data → data tersimpan di akun pengguna.
5. Ekspor data bila perlu.

## Nuansa UI/UX
Tampilan, warna, font, dan tata letak diambil persis dari repo (termasuk panduan desain di dalamnya). Tidak ada desain ulang.

## Tahapan pengerjaan
- **Tahap 1 (MVP, dikerjakan sekarang):** Ambil kode dari branch `main`, pasang semua dependency frontend dan backend, sesuaikan hanya bagian yang perlu agar jalan di environment ini (alamat backend, jalur `/api`, koneksi database bawaan), lalu pastikan layar login tampil, backend sehat, dan data yang dilindungi menolak akses tanpa login. Tampilan dan fitur tidak diubah.
- **Tahap 2:** Uji penuh alur login sampai simpan dan ekspor data di HP lewat Expo Go, lalu perbaiki kalau ada yang tidak jalan.
- **Tahap 3:** Penambahan fitur atau perbaikan sesuai permintaan Anda berikutnya.

## Asumsi
- Diimpor apa adanya; 2 peringatan kode bawaan repo (`tab-bar.tsx` dan `theme.ts`) tidak diperbaiki karena tidak memengaruhi jalannya app.
- Login tetap pakai login Google seperti di repo.
- Repo publik, jadi tidak perlu token GitHub.
- Pengaturan koneksi di environment ini (alamat preview dan database) tetap dipakai dan tidak ditimpa oleh pengaturan dari repo.
- Data lama dari tempat project ini dulu dijalankan tidak ikut dipindahkan; app mulai dengan database kosong.
- Login Google penuh paling baik dicoba lewat Expo Go di HP; preview di browser cukup untuk mengecek layar login.
