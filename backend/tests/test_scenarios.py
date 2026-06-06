"""
HotelOS Test Scenarios
======================
Run all 8 test scenarios against a live server.

Usage:
    python backend/tests/test_scenarios.py

Requirements:
    - Server running:  uvicorn backend.app.main:app --reload
    - Database seeded: alembic -c backend/alembic.ini upgrade head
    - pip install httpx
"""
import asyncio
import httpx

BASE = "http://127.0.0.1:8000"
PASSWORD = "hotel_admin_2024"

# в”Ђв”Ђ Helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def header(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def ok(label, res):
    status = "вњ… PASS" if res.status_code < 400 else "вќЊ FAIL"
    print(f"{status}  {label}  [{res.status_code}]")
    if res.status_code >= 400:
        print(f"       Error: {res.json().get('detail', res.text)}")
    else:
        data = res.json()
        # Print a concise summary
        if "message" in data:
            print(f"       {data['message']}")
        elif "room" in data:
            print(f"       Room: {data['room'].get('number')} | Status: {data['room'].get('status')}")
    return res

# в”Ђв”Ђ Auth в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

async def get_token(client: httpx.AsyncClient) -> str:
    res = await client.post("/dashboard/login", json={"password": PASSWORD})
    return res.json()["token"]

# в”Ђв”Ђ Test Scenarios в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

async def ts01(client):
    """TS-01: Guest checks in requesting a double room on the 3rd floor."""
    header("TS-01: Check-in вЂ“ double room, 3rd floor preference")
    res = await client.post("/reception/check-in", json={
        "guest": {
            "full_name": "Alice Johnson",
            "email": "alice@example.com",
            "phone": "07700900001"
        },
        "room_type": "double",
        "floor_preference": 3,
        "lift_preference": False
    })
    ok("Check-in Alice on floor 3", res)
    if res.status_code == 200:
        data = res.json()
        print(f"       Assigned room: {data['room']['number']} (floor {data['room']['floor']})")
    return res


async def ts02(client):
    """TS-02: Guest checks out of room 204."""
    header("TS-02: Check-out вЂ“ room 204")
    # First check someone into room 204 so we have an active booking
    await client.post("/reception/check-in", json={
        "guest": {"full_name": "Bob Smith", "email": "bob@example.com"},
        "room_type": "double",
        "floor_preference": 2,
    })
    res = await client.post("/reception/check-out", json={
        "room_number": "204",
        "discount": "10.00",
        "extra_charges": "0.00"
    })
    ok("Check-out room 204", res)
    if res.status_code == 200:
        inv = res.json()["invoice"]
        print(f"       Total charged: ВЈ{inv['total']}  (discount: ВЈ{inv['discount']})")


async def ts03(client):
    """TS-03: Cleaner cleans room 204 after check-out."""
    header("TS-03: Housekeeping вЂ“ clean room 204")
    res1 = await client.post("/housekeeping/start-cleaning", json={"room_number": "204"})
    ok("Start cleaning room 204", res1)
    res2 = await client.post("/housekeeping/complete-cleaning", json={"room_number": "204"})
    ok("Complete cleaning room 204", res2)


async def ts04(client):
    """TS-04: Room 301 guest orders 2 coffees and 1 sandwich."""
    header("TS-04: Room Service вЂ“ room 301 order")
    # Ensure room 301 has a guest
    await client.post("/reception/check-in", json={
        "guest": {"full_name": "Carol Davis", "email": "carol@example.com"},
        "room_type": "double",
        "floor_preference": 3,
    })
    res = await client.post("/room-service/order", json={
        "room_number": "301",
        "items": [
            {"name": "Coffee", "quantity": 2, "unit_price": "3.50"},
            {"name": "Sandwich", "quantity": 1, "unit_price": "6.00"},
        ]
    })
    ok("Place order (2x Coffee, 1x Sandwich)", res)
    if res.status_code == 200:
        order = res.json()
        print(f"       Order #{order['id']} вЂ“ Total: ВЈ{order['total_price']} вЂ“ Status: {order['status']}")
        # Advance through statuses
        for step in ["Preparing", "Delivering", "Delivered"]:
            adv = await client.post(f"/room-service/order/{order['id']}/advance")
            ok(f"  Advance to {step}", adv)


async def ts05(client):
    """TS-05: Room 115 reports a critical maintenance issue (broken shower)."""
    header("TS-05: Maintenance вЂ“ room 115 critical issue")
    res = await client.post("/maintenance/report", json={
        "room_number": "115",
        "description": "Broken shower вЂ“ water leaking onto floor",
        "urgency": "critical"
    })
    ok("Report critical issue room 115", res)
    if res.status_code == 200:
        issue = res.json()
        print(f"       Issue #{issue['id']} assigned to: {issue['technician']}")
        # Resolve it
        resolve = await client.post("/maintenance/resolve", json={"issue_id": issue["id"], "technician": issue["technician"]})
        ok("Resolve issue", resolve)


async def ts06(client):
    """TS-06: Two guests simultaneously request the same room type."""
    header("TS-06: Concurrent check-in вЂ“ same room type")
    import asyncio
    payload_a = {"guest": {"full_name": "Dan Evans",  "email": "dan@example.com"},  "room_type": "single"}
    payload_b = {"guest": {"full_name": "Eve Roberts", "email": "eve@example.com"}, "room_type": "single"}
    res_a, res_b = await asyncio.gather(
        client.post("/reception/check-in", json=payload_a),
        client.post("/reception/check-in", json=payload_b),
    )
    ok("Simultaneous check-in A", res_a)
    ok("Simultaneous check-in B", res_b)
    if res_a.status_code == 200 and res_b.status_code == 200:
        room_a = res_a.json()["room"]["number"]
        room_b = res_b.json()["room"]["number"]
        if room_a != room_b:
            print(f"       вњ… Different rooms assigned: {room_a} and {room_b}")
        else:
            print(f"       вќЊ CONFLICT вЂ“ both assigned to room {room_a}")


async def ts07(client):
    """TS-07: Request a room type that is fully occupied."""
    header("TS-07: No rooms available вЂ“ suite fully occupied")
    # Fill all suite rooms
    suite_guests = [
        {"full_name": f"Suite Guest {i}", "email": f"suite{i}@example.com"}
        for i in range(5)
    ]
    for g in suite_guests:
        await client.post("/reception/check-in", json={"guest": g, "room_type": "suite"})

    # Now try again вЂ“ should fail
    res = await client.post("/reception/check-in", json={
        "guest": {"full_name": "Overflow Guest", "email": "overflow@example.com"},
        "room_type": "suite"
    })
    if res.status_code == 400 and "No rooms available" in res.json().get("detail", ""):
        print("вњ… PASS  Correct 'No rooms available' error returned")
    else:
        print(f"вќЊ FAIL  Unexpected response: {res.status_code} вЂ“ {res.text}")


async def ts08(client):
    """TS-08: Invalid room number input."""
    header("TS-08: Invalid room number")
    res = await client.post("/reception/check-out", json={"room_number": "FAKE999"})
    if res.status_code == 400:
        print(f"вњ… PASS  Correct error: {res.json()['detail']}")
    else:
        print(f"вќЊ FAIL  Expected 400, got {res.status_code}")


# в”Ђв”Ђ Main в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

async def main():
    print("\nрџЏЁ  HotelOS вЂ“ Running all test scenarios\n")
    async with httpx.AsyncClient(base_url=BASE, timeout=15.0) as client:
        try:
            await get_token(client)
        except Exception:
            print("вќЊ  Could not connect to HotelOS. Is the server running on http://127.0.0.1:8000?")
            return

        await ts01(client)
        await ts02(client)
        await ts03(client)
        await ts04(client)
        await ts05(client)
        await ts06(client)
        await ts07(client)
        await ts08(client)

    print("\n" + "="*60)
    print("  All scenarios complete.")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())

