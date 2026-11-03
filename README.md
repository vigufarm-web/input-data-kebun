# Input Data Kebun · PT Vigu Farm Indonesia

Halaman internal untuk tambah, revisi, cari, dan unduh Excel Progres Harian. Tampilan memuat 50 baris setiap kali dan mengambil daftar blok dari GIS. Data yang berasal dari Daily Mandor diberi label agar revisinya dilakukan melalui Daily.

## Uji lokal

1. Jalankan layanan Node Laporan Kebun yang kompatibel dengan API saat ini pada `127.0.0.1:3000`. Gunakan database uji terisolasi.
2. Jalankan `node server.mjs` dengan Node.js 22 atau lebih baru.
3. Buka `http://127.0.0.1:8090` dan masuk dengan akun admin dari database uji.

## Menjalankan di hosting aplikasi

Atur `KEBUN_API_ORIGIN` ke alamat HTTPS layanan Node Laporan Kebun yang akan menangani login dan simpan di luar Vercel. Atur `PUBLIC_ORIGIN` ke alamat HTTPS halaman Input Data Kebun. Layanan memakai sesi dan izin dari API tersebut. Revisi mengirim versi baris untuk melindungi perubahan dari dua tab.

Repo ini berisi kode halaman dan penerus API satu origin. Database, akun, foto, Excel, dan kredensial berada di layanan penyimpanan yang ditetapkan saat penerapan. Tahap ini mencakup Progres Harian untuk admin. Gunakan [Peta Kebun](https://vigufarm-web.github.io/peta-kebun/) untuk perubahan kelompok tanam dan [Dashboard Laporan Kebun](https://laporankebun.vercel.app/) untuk ringkasan.

## Uji online di Render

Buat Web Service Node dari repo ini. Isi Build Command dengan `bash prepare-demo.sh` dan Start Command dengan `npm run start:demo`. Tetapkan `DEMO_PASSWORD` sebagai environment variable di Render dengan panjang minimal 12 karakter. Nama pengguna uji default adalah `admin-demo`.

Saat mulai, layanan membuat database baru dengan blok `UJI-01` dan `UJI-PADI`. Data simulasi dibuat ulang saat layanan dimulai ulang; jangan masukkan data sebenarnya. Akses staf penjualan dan mandor diuji terpisah, termasuk penolakan akses campuran mandor/penjualan.

## Pemeriksaan sebelum digunakan

Setelah `bash prepare-demo.sh` berhasil, jalankan `npm test` untuk menguji login, pembatasan hak akses, simpan, revisi usang, unduhan Excel dan halaman setelah 200 rencana. Tes ini membuat database sementara sendiri; tidak menguji koneksi ke database produksi.

Kode aplikasi dan konfigurasi uji tidak memindahkan akun atau data produksi. Sebelum menghubungkan penyimpanan permanen, verifikasi sumber data terbaru, cadangan, otorisasi pada layanan yang dituju, dan konflik saat dua layanan menyimpan secara bersamaan. Jangan memasukkan kata sandi, token atau isi database ke repositori.
