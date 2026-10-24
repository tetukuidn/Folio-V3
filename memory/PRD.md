# LPM — Laporan Aglonema

Aplikasi mobile iOS/Android untuk pencatatan penjualan tanaman aglonema. **Multi-akun, data online, wajib login Google.**

## Stack
- React Native + Expo (SDK 57), Expo Router (file-based)
- Backend: FastAPI (`/api` prefix) + MongoDB (motor)
- Auth: Emergent-managed Google Login (`expo-web-browser` + `expo-linking`), token di `expo-secure-store` (native) / `localStorage` (web)
- Library: `xlsx`, `expo-file-system`, `expo-sharing`, `expo-clipboard`, `@react-native-community/datetimepicker`, `@expo/vector-icons`

## Arsitektur data (online, terpisah per akun)
- `users`: {user_id, email (unique), name, picture, created_at, last_login}
- `user_sessions`: {session_token (unique), user_id, expires_at (TTL 7 hari), created_at}
- `app_data`: **satu dokumen per user** {user_id (unique), belanja[], suppliers[], pesanan[], sender{}, profil{namaPemilik,namaToko,waToko}, updated_at}
- Tidak ada data yang dibagi antar akun. Akun baru mulai dengan data kosong (tanpa seed demo).

## API
- `POST /api/auth/session` body `{session_id}` → `{session_token, user}` (tukar session_id Emergent, sekali pakai)
- `GET /api/auth/me` (Bearer) → `{user}`
- `POST /api/auth/logout` (Bearer) → hapus session
- `GET /api/data` (Bearer) → `{data:{belanja,suppliers,pesanan,sender,profil}, user}`
- `PUT /api/data` (Bearer) → simpan seluruh state (frontend debounce 700ms)
- `PUT /api/profile` (Bearer) → simpan `{namaPemilik,namaToko,waToko}`

## Struktur frontend
- `app/_layout.tsx` — AuthProvider → StoreProvider → ToastProvider → **Gate** (splash saat loading, redirect ke /login bila belum masuk)
- `app/login.tsx` — layar "Masuk dengan Google"
- `app/(tabs)/_layout.tsx` — bottom tab urutan: **Dashboard, Pesanan, Supplier, Persediaan, Customer, Ekspor** (label disembunyikan atas permintaan user)
- `app/(tabs)/dashboard.tsx` — kartu profil akun di paling atas, filter periode, tile metrik (1 baris scroll horizontal), terlaris, rekap kurir, hapus semua data
- `app/(tabs)/pesanan.tsx` — form 4 bagian + daftar card + **edit pesanan** + chat WA
- `app/(tabs)/supplier.tsx` / `persediaan.tsx` / `customer.tsx` / `ekspor.tsx` — seperti sebelumnya
- `src/api/client.ts` — fetch wrapper Bearer + penyimpanan token
- `src/auth/index.tsx` — AuthContext (loading/user/null), deep-link & cold-start handling
- `src/store/index.tsx` — state global dari server, auto-save debounce, indikator sinkron
- `src/components/profil-card.tsx` — foto + email (read-only) + nama pemilik/toko/WA (editable) + Keluar akun

## Fitur kunci
- Rumus persis sesuai spek (HPP tertimbang, FIFO stok, rekap transfer→keuntungan dengan baris cek Sesuai/Tidak)
- Normalisasi WA jadi `62...`, format Rupiah id-ID, tanggal "8 Okt 2026"
- Format Everpro: Jenis Pengiriman otomatis (COD prefix, J&T Express DROPOFF→PICKUP), No Referensi `ORD-<5digit>`
- Sel wajib kosong ditandai pink, maksimum 100 pesanan/file, unduh via Share Sheet
- Edit pesanan: tombol "Ubah pesanan" di detail card → form terisi otomatis (banner mode ubah), stok pesanan tsb dikembalikan sementara agar sisa stok benar, simpan menimpa data lama (id & status dipertahankan)

## Tema
Light-only sesuai pilihan user (bg #F1F5F0, hijau #1F5A41, pink aksen #C42F5C).

## Status tes
Backend 13/13 pytest (`/app/backend/tests/test_lpm_backend.py`), frontend e2e lulus semua (lihat `/app/test_reports/iteration_1.json`). Kredensial QA di `/app/memory/test_credentials.md`.

## Update — Jun 2026: UI rework & rebrand to "folia"
- App renamed to **folia** (`app.json` name + scheme `folia`). Icon/splash/favicon/adaptive icon regenerated from the user's logo (white frame removed, transparent rounded corners) → `assets/images/logo.png`, `icon.png`, `adaptive-icon.png`, `splash-image.png`, `favicon.png`.
- Bottom nav: 4 tabs (Dashboard, Pesanan, Customer, Ekspor) + centered FAB "+" in brand green `#17C06B` (`colors.action`), no red. Pill width capped at 520pt for tablets.
- "Persediaan" renamed **Stok barang**, removed from the tab bar, moved to `app/stok-barang.tsx` (stack route with back button), opened from a Dashboard shortcut card (`buka-stok-barang`).
- Login redesigned (`app/login.tsx`): logo centered, "folio" wordmark removed, tagline under the logo, white Google button with official multicolour G (`src/components/google-icon.tsx`, react-native-svg), trust line below; centered layout, max width 480, safe-area aware.
- Responsiveness: `src/theme.ts` exports `ms()` moderate scale (clamped 0.88–1.12 of a 390pt baseline) applied to spacing, fontSize and nav geometry.
- Login bug "Invalid state parameter": `WebBrowser.openAuthSessionAsync` now uses `preferEphemeralSession: true` + `showInRecents: true`, plus a double-tap guard and error surfacing in `src/auth/index.tsx`. Needs real-device verification.
- QA: web-preview login bypass via `localStorage lpm_session_token=qa-test-session-token` (see `memory/test_credentials.md`). Backend 13/13 and frontend flows verified (`test_reports/iteration_1.json`).

## Update — Jun 2026 (lanjutan)
- Nama app kembali ke **folio** (`app.json` name + scheme `folio`).
- Splash & launcher icon: tile hijau dibuang, sekarang hanya glyph (daun + wordmark putih) transparan di atas background hijau `#11C87C` → tidak ada lagi sudut putih. `splash-image.png` (92% canvas), `adaptive-icon.png` (62%, safe zone), `favicon.png` pakai tile full-bleed.
- Dashboard: kartu **Ringkasan hari ini** (testID `ringkasan-harian`) di paling atas — penjualan, keuntungan, jumlah pesanan & pohon keluar hari ini (dihitung dari `state.pesanan` + `hitungRekap`).
- Tab bar: ikon + label bertumpuk (semua label selalu terlihat), jarak ke FAB `fabSize + 12` (narrow screen: +2, sideInset 10), label `adjustsFontSizeToFit` → tidak ada tab yang menempel ke tombol "+". Diuji 320/390/430.
- Backend: `DataPayload` sekarang `extra="forbid"` supaya body salah bentuk (mis. `{"data": {...}}`) ditolak 422, bukan menghapus data user. 13/13 pytest lolos.

## Import ke environment baru (Juni 2026)
- Kode diimpor dari github.com/tetukuidn/folio-v2 (branch main), apa adanya.
- Dependency disesuaikan ke Expo SDK 58 (repo asal SDK 57); ditambah datetimepicker, clipboard, file-system, sharing, svg, xlsx, @expo/vector-icons.
- Fix: tab-bar.tsx disesuaikan dengan API tab bar SDK 58 (emitter/navigateToTab) — sebelumnya crash saat ketuk tab.
- Backend 21/21 tes lulus; login, dashboard, pesanan, customer, ekspor, stok, supplier terbuka normal.
## Backlog
- P1: Uji login Google + simpan/ekspor di HP via Expo Go
- P2: Fitur baru sesuai permintaan
