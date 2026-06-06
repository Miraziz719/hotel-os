# HotelOS

HotelOS mehmonxona uchun real vaqt rejimida ishlaydigan boshqaruv tizimi. Loyihada 4 ta alohida backend servis bor:

- `Reception` - check-in, check-out, guest history, dashboard auth va WebSocket
- `Housekeeping` - cleaning queue va room cleaning statuslari
- `Room Service` - buyurtmalarni qabul qilish va statuslarini yuritish
- `Maintenance` - nosozliklar va ularning prioriteti

Frontend shu servislarning har biridan alohida ma'lumot oladi. Agar biror servis ishlamay qolsa, interfeysda uning statusi `ishlamayapti` deb ko'rsatiladi. Servislar o'zaro bevosita chaqiriq qilmaydi, ular Redis Streams orqali xabar almashadi. Shu sababli servis vaqtincha o'chsa ham, xabar brokerda saqlanib turadi va servis qayta ishga tushganda yetkaziladi.

## Qisqacha arxitektura

- `PostgreSQL` - asosiy ma'lumotlar bazasi
- `Redis Streams` - servislar orasidagi persistent message broker
- `FastAPI` - backend servislar
- `React + Vite` - frontend
- `WebSocket` - admin/dashboard uchun real vaqtli yangilanishlar

Oddiy oqim:

1. `Reception` check-out qiladi
2. Redis stream'ga `room_released` xabari yoziladi
3. `Housekeeping` shu xabarni o'qib room'ni cleaning queue'ga qo'shadi
4. `Reception` WebSocket orqali frontendga update yuboradi

## Portlar

- `8001` - Reception service
- `8002` - Housekeeping service
- `8003` - Room Service
- `8004` - Maintenance service
- `5173` - Frontend dev server

## O'rnatish

### 1. Backend dependency

```bash
pip install -r backend/requirements.txt
```

### 2. Frontend dependency

```bash
cd frontend
npm install
cd ..
```

### 3. PostgreSQL tayyorlash

Database yarating:

```sql
CREATE USER hotel_user WITH PASSWORD 'hotel_pass';
CREATE DATABASE hotel_os OWNER hotel_user;
GRANT ALL PRIVILEGES ON DATABASE hotel_os TO hotel_user;
```

### 4. Redis ishga tushirish

Mahalliy Redis server ishlayotgan bo'lishi kerak.

### 5. Environment sozlash

```bash
copy backend/.env.example backend/.env
copy frontend/.env.example frontend/.env
```

Kerak bo'lsa URL va credential'larni o'zgartiring.

### 6. Bir komandada schema va demo data yaratish

```bash
python -m backend.app.bootstrap_demo
```

Bu bitta buyruq:

- migration'larni ishga tushiradi
- staff userlarni yaratadi yoki yangilaydi
- demo guest va active booking yaratadi
- sample room service order yaratadi
- sample maintenance issue yaratadi

Demo loginlar:

- `admin / admin`
- `reception / reception`
- `cleaner1 / cleaner1`
- `kitchen / kitchen`
- `technician1 / technician1`
- `+998901112233 / 2233`

## Ishga tushirish

### Variant 1. 4 ta backend servisni birga ishga tushirish

```bash
python backend/run.py
```

Bu quyidagi servislarni ko'taradi:

- `http://127.0.0.1:8001`
- `http://127.0.0.1:8002`
- `http://127.0.0.1:8003`
- `http://127.0.0.1:8004`

### Variant 2. Har bir servisni alohida ishga tushirish

```bash
uvicorn backend.app.service_apps:reception_app --host 127.0.0.1 --port 8001 --reload
uvicorn backend.app.service_apps:housekeeping_app --host 127.0.0.1 --port 8002 --reload
uvicorn backend.app.service_apps:room_service_app --host 127.0.0.1 --port 8003 --reload
uvicorn backend.app.service_apps:maintenance_app --host 127.0.0.1 --port 8004 --reload
```

### Frontend

```bash
cd frontend
npm run dev
```

Frontend odatda shu manzilda ochiladi:

```text
http://127.0.0.1:5173
```

## Foydalanish

1. Avval Redis va PostgreSQL ni yoqing
2. `python -m backend.app.bootstrap_demo` ni ishga tushiring
3. Backend servislarni ko'taring
4. Frontendni ishga tushiring
5. Brauzerda `http://127.0.0.1:5173` ni oching
6. Login orqali tizimga kiring

Test foydalanuvchilar login sahifasida ham ko'rsatiladi.

## Testlash

Baholashdagi `TS-01` dan `TS-08` gacha stsenariylar uchun tayyor skript bor:

```bash
python backend/tests/test_scenarios.py
```

Testdan oldin quyidagilar tayyor bo'lishi kerak:

1. Dependency'lar o'rnatilgan bo'lishi kerak
2. Database va demo data tayyor bo'lishi kerak:

```bash
python -m backend.app.bootstrap_demo
```

3. 4 ta backend servis ishga tushgan bo'lishi kerak:

```bash
python backend/run.py
```

Skript quyidagi stsenariylarni tekshiradi:

- `TS-01` - 3-qavat double room check-in
- `TS-02` - 204-xona check-out va cleaning queue
- `TS-03` - 204-xonani tozalash va qayta available bo'lishi
- `TS-04` - 301-xona room service buyurtmasi va statuslari
- `TS-05` - 115-xona uchun kritik maintenance issue
- `TS-06` - parallel check-in
- `TS-07` - barcha suite xonalar band bo'lgandagi xabar
- `TS-08` - noto'g'ri xona raqami validatsiyasi

Natija terminalda `PASS` yoki `FAIL` ko'rinishida chiqadi. Eng toza va takrorlanuvchi natija uchun testlarni yangi tayyorlangan demo baza ustida ishga tushirish tavsiya etiladi.
`rich` kutubxonasi o'rnatilgan bo'lsa, yakunda rangli jadval ko'rinishida umumiy natija ham chiqadi.

## Muhim endpointlar

### Reception

- `POST /auth/login`
- `POST /reception/check-in`
- `POST /reception/check-out`
- `GET /reception/rooms`
- `GET /reception/occupied-rooms`
- `GET /dashboard/ws`

### Housekeeping

- `GET /housekeeping/queue`
- `POST /housekeeping/start-cleaning`
- `POST /housekeeping/complete-cleaning`
- `POST /housekeeping/request-cleaning`

### Room Service

- `POST /room-service/order`
- `POST /room-service/order/{id}/advance`
- `GET /room-service/active`

### Maintenance

- `POST /maintenance/report`
- `POST /maintenance/resolve`
- `GET /maintenance/open`

## Health check

Har bir servisda health endpoint bor:

```text
http://127.0.0.1:8001/health
http://127.0.0.1:8002/health
http://127.0.0.1:8003/health
http://127.0.0.1:8004/health
```

## Eslatma

- Frontend status indikatorlari servislar holatini tekshiradi
- Redis Streams sababli event'lar servis offline bo'lsa ham yo'qolmaydi
- Admin sahifasi ma'lumotni bir nechta servisdan yig'adi
- Upload qilingan rasmlar backend `uploads` papkasida saqlanadi
