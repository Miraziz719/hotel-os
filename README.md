# HotelOS – Real-Time Hotel Management System

**Pearson BTEC Level 3 – Unit 4: Programming**  
**Student:** *Miraziz Ergashev*  
**Date:** 2026

---

## Project Overview

HotelOS is a real-time hotel management system built with **FastAPI**, **PostgreSQL**, **Redis Pub/Sub**, and a live WebSocket dashboard.  
It simulates four hotel departments communicating through events rather than direct calls.

---

## Quick-Start Guide

### 1. Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

### 2. Install and start PostgreSQL

**Windows (via installer):**
1. Download from https://www.postgresql.org/download/windows/
2. Install with default settings (port 5432)
3. Open **pgAdmin** or **psql** and run:

```sql
CREATE USER hotel_user WITH PASSWORD 'hotel_pass';
CREATE DATABASE hotel_os OWNER hotel_user;
GRANT ALL PRIVILEGES ON DATABASE hotel_os TO hotel_user;
```

### 3. Install and start Redis

**Windows (via WSL or Memurai):**
```bash
# WSL (Ubuntu):
sudo apt install redis-server
redis-server

# Or download Memurai from https://www.memurai.com/
```

### 4. Configure environment variables

```bash
copy backend/.env.example backend/.env
# Edit backend/.env if your PostgreSQL or Redis settings differ
```

### 5. Run database migrations

```bash
alembic -c backend/alembic.ini upgrade head
```

This creates all tables and seeds 10 demo rooms.

### 6. Start the server

```bash
uvicorn backend.app.main:app --reload
```

Or simply:

```bash
python backend/run.py
```

Server starts at **http://127.0.0.1:8000**

### 7. Open the dashboard

Visit **http://127.0.0.1:8000** in your browser.  
Default password: `hotel_admin_2024`

### 8. Run test scenarios

In a second terminal (with the server running):

```bash
python backend/tests/test_scenarios.py
```

---

## API Reference

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/reception/check-in` | Guest check-in + room assignment |
| POST | `/reception/check-out` | Guest check-out + invoice |
| GET  | `/reception/rooms` | All rooms inventory |
| POST | `/housekeeping/start-cleaning` | Begin cleaning a room |
| POST | `/housekeeping/complete-cleaning` | Mark room as clean |
| GET  | `/housekeeping/queue` | Current cleaning queue |
| POST | `/room-service/order` | Place food/drink order |
| POST | `/room-service/order/{id}/advance` | Advance order status |
| GET  | `/room-service/active` | Active orders |
| POST | `/maintenance/report` | Report maintenance issue |
| POST | `/maintenance/resolve` | Resolve a maintenance issue |
| GET  | `/maintenance/open` | All open issues (priority sorted) |
| POST | `/dashboard/login` | Get dashboard token |
| GET  | `/dashboard/snapshot?token=X` | Full hotel state snapshot |
| WS   | `/dashboard/ws?token=X` | Real-time WebSocket stream |

Interactive docs: **http://127.0.0.1:8000/docs**

---

## How Each Service Works

### Reception Service
- Accepts check-in requests with room type and optional floor/lift preferences.
- Room assignment algorithm selects the best available clean room using a multi-criteria sort: type → clean status → longest-since-cleaned → floor match → lift proximity.
- Uses `SELECT FOR UPDATE SKIP LOCKED` to prevent two concurrent check-ins from grabbing the same room.
- On check-out, calculates invoice: `(nightly_rate × nights) + service_charges + extras − discount`.

### Housekeeping Service
- Subscribes to `room.released` events from Redis.
- Maintains an in-memory FIFO queue of dirty rooms.
- Cleaner picks up rooms → status: `dirty → cleaning → clean`.
- Each state change is published back to Redis.

### Room Service
- Accepts item orders for any room.
- Progresses through: `received → preparing → delivering → delivered`.
- Order cost is automatically included in the guest's final invoice on checkout.

### Maintenance Service
- Reports are pushed into a Python `heapq` min-heap with priority = urgency value.
- Critical issues immediately put the room into `maintenance` status.
- Technicians are assigned round-robin from a pool.
- Resolved issues restore the room to `dirty` status (ready for housekeeping).

---

## Git Commit History (suggested)

```
1.  feat: initialise project structure and requirements.txt
2.  feat: add SQLAlchemy ORM models for all six database tables
3.  feat: add Alembic migration with initial schema and room seed data
4.  feat: implement room assignment algorithm with SELECT FOR UPDATE locking
5.  feat: implement check-in and billing (check-out) in reception service
6.  feat: add housekeeping service with cleaning queue and status transitions
7.  feat: add room service with order progression and Redis event publishing
8.  feat: add maintenance service with priority heap and technician assignment
9.  feat: add Redis Pub/Sub subscriber routing events between services
10. feat: add WebSocket dashboard with real-time broadcast and token auth
11. feat: add HTML/CSS/JS frontend dashboard with live event log
12. test: add all eight test scenarios (TS-01 through TS-08)
```

---

## Technical Explanation (for Assignment Report)

### Architecture

HotelOS follows an **event-driven microservices** pattern.  
Four services (Reception, Housekeeping, Room Service, Maintenance) never call each other directly.  
Instead, each service publishes events to Redis and subscribes to events it cares about.  
This is called **loose coupling** — services only know about event channels, not each other.

```
Reception ──publish──▶ room.released ──subscribe──▶ Housekeeping
                    ▶ guest.checkedIn ──────────────▶ Dashboard
Room Service ───────▶ roomService.orderCreated ─────▶ Dashboard
Maintenance ────────▶ maintenance.issueCreated ──────▶ Dashboard
```

### PostgreSQL Database Design

Six tables represent the hotel domain:

| Table | Purpose |
|-------|---------|
| `rooms` | Physical rooms with type, status, rate |
| `guests` | Guest personal details |
| `bookings` | Links guests to rooms with check-in/out dates |
| `room_service_orders` | Food/drink orders with status and price |
| `maintenance_issues` | Fault reports with urgency and resolution |
| `invoices` | Final billing records created at check-out |

Foreign key constraints enforce referential integrity.  
`SELECT FOR UPDATE SKIP LOCKED` is used during room assignment to prevent race conditions.

### SQLAlchemy ORM

SQLAlchemy maps Python classes to PostgreSQL tables.  
`AsyncSession` is used throughout so database calls don't block the web server.  
Relationships (`room.bookings`, `booking.invoice`) let us navigate between records without writing SQL.

### Data Structures

| Structure | Where used | Why |
|-----------|-----------|-----|
| `heapq` min-heap | Maintenance priority queue | O(log n) insert/pop, highest urgency served first |
| `deque` | Housekeeping cleaning queue | O(1) append/remove from either end |
| Python `dict` | Redis channel routing in subscriber | O(1) channel-to-handler lookup |
| JSON string | RoomServiceOrder.items column | Stores variable-length item list without a separate table |

### Algorithms

**Room Assignment (reception.py):**
1. Query all clean rooms of the requested type with `SELECT FOR UPDATE SKIP LOCKED`.
2. Sort ascending by `last_cleaned_at` (longest-clean first).
3. Partition into floor-match and non-match lists; concatenate preferred first.
4. Within each partition, sort by `near_lift` if lift preference given.
5. Return `ordered[0]`.

**Billing (reception.py):**
```
room_charges  = nightly_rate × max(1, days_stayed)
total = room_charges + service_charges + extra_charges − discount
total = max(0, total)   # edge case: discount > total
```

**Maintenance Priority Queue:**
- Urgency mapped to integers: Critical=4, High=3, Normal=2, Low=1.
- Python `heapq` stores `(-priority, issue_id)` — negation converts min-heap to max-heap.
- `heapq.heappush` is O(log n); the most critical issue is always at the front.

### WebSocket (Real-Time Dashboard)

`ConnectionManager` holds a list of active `WebSocket` objects.  
When any service publishes a `dashboard.update` event to Redis, the subscriber receives it and calls `manager.broadcast(data)`, which sends a JSON message to every connected browser simultaneously.  
The browser re-fetches the `/dashboard/snapshot` endpoint and re-renders all four panels without a page refresh.

### Redis Pub/Sub Message Broker

Redis Pub/Sub works like a radio station:
- A **publisher** sends a message to a named channel (e.g. `room.released`).
- All **subscribers** listening to that channel receive the message instantly.
- No message history is stored — it's fire-and-forget, which is fine for live status updates.

Channels used:
```
room.released          room.statusChanged
guest.checkedIn        guest.checkedOut
roomService.orderCreated    roomService.statusChanged
maintenance.issueCreated    maintenance.issueResolved
dashboard.update
```

### Security

| Threat | Mitigation |
|--------|-----------|
| Unauthorised dashboard access | Token issued only after correct password; `secrets.compare_digest` prevents timing attacks |
| SQL injection | SQLAlchemy ORM with parameterised queries — raw SQL is never constructed from user input |
| Sensitive data in WebSocket | Only non-sensitive fields (room number, status, order ID) are broadcast |
| Stack traces leaking | FastAPI returns `{"detail": "..."}` for `HTTPException`; raw Python tracebacks are never sent to the client |
| Database credentials in code | All credentials in `.env` file, read via `pydantic-settings`; `.env` is git-ignored |
| Input validation | All request bodies validated by Pydantic schemas; invalid types/values return 422 before reaching service logic |

### Debugging Examples

**Check what's in the cleaning queue:**
```bash
curl http://127.0.0.1:8000/housekeeping/queue
```

**Check the maintenance priority heap:**
```bash
curl http://127.0.0.1:8000/maintenance/queue-debug
```

**SQLAlchemy SQL logging** — set `echo=True` in `database.py` to print every SQL statement.

**Redis monitor** — run `redis-cli MONITOR` to see every publish/subscribe event in real time.

### Coding Standards

- **PEP 8** style throughout: snake_case functions/variables, PascalCase classes.
- Type hints on all function signatures.
- Each module has a docstring explaining its responsibility.
- Comments explain *why*, not *what* (e.g., why `SKIP LOCKED` is used).
- No hardcoded credentials — all configuration via environment variables.
- Input validated at the API boundary (Pydantic schemas) before touching the database.
