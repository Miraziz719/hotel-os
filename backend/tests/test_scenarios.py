"""
HotelOS Test Scenarios
======================
Run all 8 brief scenarios against the 4-service backend.

Usage:
    python backend/tests/test_scenarios.py

Requirements:
    - Services running on ports 8001-8004
    - Database prepared with: python -m backend.app.bootstrap_demo
    - pip install httpx rich
"""
import asyncio
from typing import Awaitable, Callable

import httpx
from rich import box
from rich.console import Console
from rich.table import Table

RECEPTION_BASE = "http://127.0.0.1:8001"
HOUSEKEEPING_BASE = "http://127.0.0.1:8002"
ROOM_SERVICE_BASE = "http://127.0.0.1:8003"
MAINTENANCE_BASE = "http://127.0.0.1:8004"

ADMIN_CREDENTIALS = {"username": "admin", "password": "admin"}
console = Console()
scenario_results: list[dict] = []


def header(title: str):
    console.print(f"\n[bold cyan]{title}[/bold cyan]")


def pass_line(message: str):
    console.print(f"[green]PASS[/green]  {message}")


def fail_line(message: str):
    console.print(f"[red]FAIL[/red]  {message}")


def record_result(scenario_id: str, description: str, passed: bool, detail: str):
    scenario_results.append({
        "id": scenario_id,
        "description": description,
        "status": "Passed" if passed else "Failed",
        "detail": detail,
    })
    if passed:
        pass_line(detail)
    else:
        fail_line(detail)


def render_summary():
    table = Table(title="HotelOS Test Natijalari", box=box.ROUNDED, header_style="bold white on dark_green")
    table.add_column("ID", style="bold cyan", no_wrap=True)
    table.add_column("Stsenariy", style="white")
    table.add_column("Natija", justify="center")
    table.add_column("Izoh", style="dim")

    for result in scenario_results:
        status_style = "[bold green]Passed[/bold green]" if result["status"] == "Passed" else "[bold red]Failed[/bold red]"
        table.add_row(result["id"], result["description"], status_style, result["detail"])

    console.print()
    console.print(table)
    console.print()


async def wait_for(
    label: str,
    predicate: Callable[[], Awaitable[bool]],
    *,
    timeout: float = 5.0,
    interval: float = 0.2,
) -> bool:
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if await predicate():
            return True
        await asyncio.sleep(interval)
    fail_line(label)
    return False


class ScenarioRunner:
    def __init__(self, token: str):
        headers = {"Authorization": f"Bearer {token}"}
        self.reception = httpx.AsyncClient(base_url=RECEPTION_BASE, headers=headers, timeout=20.0)
        self.housekeeping = httpx.AsyncClient(base_url=HOUSEKEEPING_BASE, headers=headers, timeout=20.0)
        self.room_service = httpx.AsyncClient(base_url=ROOM_SERVICE_BASE, headers=headers, timeout=20.0)
        self.maintenance = httpx.AsyncClient(base_url=MAINTENANCE_BASE, headers=headers, timeout=20.0)
        self.counter = 1000

    async def close(self):
        await self.reception.aclose()
        await self.housekeeping.aclose()
        await self.room_service.aclose()
        await self.maintenance.aclose()

    async def get_rooms(self):
        res = await self.reception.get("/reception/rooms")
        res.raise_for_status()
        return res.json()

    async def get_room(self, room_number: str):
        rooms = await self.get_rooms()
        for room in rooms:
            if room["number"] == room_number:
                return room
        return None

    async def get_occupied_rooms(self):
        res = await self.reception.get("/reception/occupied-rooms")
        res.raise_for_status()
        return res.json()

    async def get_booking_for_room(self, room_number: str):
        occupied = await self.get_occupied_rooms()
        for booking in occupied:
            if booking["room_number"] == room_number:
                return booking
        return None

    async def get_open_issues(self):
        res = await self.maintenance.get("/maintenance/open")
        res.raise_for_status()
        return res.json()

    async def get_active_orders(self):
        res = await self.room_service.get("/room-service/active")
        res.raise_for_status()
        return res.json()

    def unique_guest(self, prefix: str):
        self.counter += 1
        return {
            "full_name": f"{prefix} Guest {self.counter}",
            "email": f"{prefix.lower()}{self.counter}@example.com",
            "phone": f"+99890{self.counter:07d}"[:13],
        }

    async def ensure_room_clean(self, room_number: str):
        booking = await self.get_booking_for_room(room_number)
        if booking:
            await self.reception.post("/reception/check-out", json={"room_number": room_number})
            await asyncio.sleep(0.3)

        room = await self.get_room(room_number)
        if not room:
            raise RuntimeError(f"Room {room_number} not found")

        if room["status"] == "maintenance":
            issues = [issue for issue in await self.get_open_issues() if issue["room_number"] == room_number]
            for issue in issues:
                while issue["status"] != "resolved":
                    res = await self.maintenance.post(f"/maintenance/issue/{issue['id']}/advance", json={})
                    res.raise_for_status()
                    issue = res.json()["issue"]
            await asyncio.sleep(0.3)
            room = await self.get_room(room_number)

        if room["status"] == "dirty":
            res = await self.housekeeping.post("/housekeeping/start-cleaning", json={"room_number": room_number})
            res.raise_for_status()
            room = await self.get_room(room_number)

        if room["status"] == "cleaning":
            res = await self.housekeeping.post("/housekeeping/complete-cleaning", json={"room_number": room_number})
            res.raise_for_status()

    async def ensure_checked_in(self, room_number: str, room_type: str, prefix: str):
        booking = await self.get_booking_for_room(room_number)
        if booking:
            return booking

        await self.ensure_room_clean(room_number)
        guest = self.unique_guest(prefix)
        res = await self.reception.post("/reception/check-in", json={
            "guest": guest,
            "room_type": room_type,
            "room_number": room_number,
        })
        res.raise_for_status()
        return await self.get_booking_for_room(room_number)

    async def ts01(self):
        scenario_id = "TS-01"
        description = "3-qavatdagi double xona check-in"
        header(f"{scenario_id}: {description}")
        await self.ensure_room_clean("301")
        res = await self.reception.post("/reception/check-in", json={
            "guest": self.unique_guest("TS01"),
            "room_type": "double",
            "floor_preference": 3,
            "lift_preference": False,
        })
        if res.status_code >= 400:
            record_result(scenario_id, description, False, f"Check-in xato qaytdi: {res.text}")
            return
        data = res.json()
        room = data["room"]
        if room["floor"] == 3 and room["status"] == "occupied":
            record_result(scenario_id, description, True, f"3-qavatdagi xona tayinlandi: {room['number']}")
        else:
            record_result(scenario_id, description, False, f"Kutilgan floor/status emas: {room}")

    async def ts02(self):
        scenario_id = "TS-02"
        description = "204-xonadan check-out va cleaning queue"
        header(f"{scenario_id}: {description}")
        await self.ensure_checked_in("204", "double", "TS02")
        preview_res = await self.reception.get("/reception/checkout-preview/204?discount=0&extra_charges=0")
        preview_res.raise_for_status()
        preview = preview_res.json()

        res = await self.reception.post("/reception/check-out", json={"room_number": "204"})
        if res.status_code >= 400:
            record_result(scenario_id, description, False, f"Check-out xato qaytdi: {res.text}")
            return
        invoice = res.json()["invoice"]

        room = await self.get_room("204")
        queue: list[str] = []

        async def room_reached_queue():
            nonlocal queue
            queue_res = await self.housekeeping.get("/housekeeping/queue")
            queue_res.raise_for_status()
            queue = queue_res.json()["cleaning_queue"]
            return "204" in queue

        queue_ok = await wait_for("204 xona housekeeping queue ga tushmadi", room_reached_queue)

        checks = [
            room["status"] == "dirty",
            float(invoice["total"]) >= float(preview["service_charges"]),
            queue_ok,
        ]
        if all(checks):
            record_result(scenario_id, description, True, "204 dirty holatga o'tdi, hisob yaratildi va xona cleaning queue ga tushdi")
        else:
            record_result(scenario_id, description, False, f"Kutilgan natija to'liq emas: room={room['status']} queue={queue} invoice={invoice}")

    async def ts03(self):
        scenario_id = "TS-03"
        description = "204-xonani tozalash"
        header(f"{scenario_id}: {description}")
        room = await self.get_room("204")
        if room["status"] != "dirty":
            await self.ts02()

        start_res = await self.housekeeping.post("/housekeeping/start-cleaning", json={"room_number": "204"})
        complete_res = await self.housekeeping.post("/housekeeping/complete-cleaning", json={"room_number": "204"})
        if start_res.status_code >= 400 or complete_res.status_code >= 400:
            record_result(scenario_id, description, False, f"Cleaning xatosi: start={start_res.text} complete={complete_res.text}")
            return

        room = await self.get_room("204")
        available_res = await self.reception.get("/reception/available-rooms?room_type=double")
        available_res.raise_for_status()
        available_numbers = {item["number"] for item in available_res.json()}

        if room["status"] == "clean" and "204" in available_numbers:
            record_result(scenario_id, description, True, "204 xona clean bo'ldi va yana tayinlash uchun mavjud")
        else:
            record_result(scenario_id, description, False, f"204 hali available emas: status={room['status']}")

    async def ts04(self):
        scenario_id = "TS-04"
        description = "301-xona room service buyurtmasi"
        header(f"{scenario_id}: {description}")
        await self.ensure_checked_in("301", "double", "TS04")
        order_res = await self.room_service.post("/room-service/order", json={
            "room_number": "301",
            "items": [
                {"name": "Coffee", "quantity": 2, "unit_price": "3.50"},
                {"name": "Sandwich", "quantity": 1, "unit_price": "6.00"},
            ],
        })
        if order_res.status_code >= 400:
            record_result(scenario_id, description, False, f"Order yaratilmadi: {order_res.text}")
            return
        order = order_res.json()

        statuses = []
        for _ in range(3):
            advance_res = await self.room_service.post(f"/room-service/order/{order['id']}/advance", json={})
            if advance_res.status_code >= 400:
                record_result(scenario_id, description, False, f"Order status advance xato: {advance_res.text}")
                return
            statuses.append(advance_res.json()["order"]["status"])

        preview_res = await self.reception.get("/reception/checkout-preview/301?discount=0&extra_charges=0")
        preview_res.raise_for_status()
        preview = preview_res.json()

        if statuses == ["preparing", "delivering", "delivered"] and float(preview["service_charges"]) >= 13.0:
            record_result(scenario_id, description, True, "Buyurtma statuslari ketma-ket o'tdi va charge hisobga qo'shildi")
        else:
            record_result(scenario_id, description, False, f"Statuslar yoki charge noto'g'ri: statuses={statuses}, service={preview['service_charges']}")

    async def ts05(self):
        scenario_id = "TS-05"
        description = "115-xona kritik maintenance"
        header(f"{scenario_id}: {description}")
        await self.ensure_room_clean("115")
        report_res = await self.maintenance.post("/maintenance/report", json={
            "room_number": "115",
            "description": "Broken shower in test scenario",
            "urgency": "critical",
        })
        if report_res.status_code >= 400:
            record_result(scenario_id, description, False, f"Issue yaratilmagan: {report_res.text}")
            return
        issue = report_res.json()
        open_issues = await self.get_open_issues()
        room = await self.get_room("115")

        top_issue = open_issues[0] if open_issues else None
        first_ok = top_issue and top_issue["id"] == issue["id"] and room["status"] == "maintenance"

        advance_a = await self.maintenance.post(f"/maintenance/issue/{issue['id']}/advance", json={})
        advance_b = await self.maintenance.post(f"/maintenance/issue/{issue['id']}/advance", json={})
        room_after = await self.get_room("115")
        issue_after = advance_b.json()["issue"] if advance_b.status_code < 400 else {}

        if first_ok and advance_a.status_code < 400 and advance_b.status_code < 400 and issue_after.get("status") == "resolved":
            record_result(scenario_id, description, True, f"Kritik issue navbat boshiga chiqdi va yakunda hal qilindi, xona holati {room_after['status']}")
        else:
            record_result(scenario_id, description, False, "Maintenance oqimi kutilgandek yakunlanmadi")

    async def ts06(self):
        scenario_id = "TS-06"
        description = "Bir xil xona turiga parallel check-in"
        header(f"{scenario_id}: {description}")
        for room_number in ("101", "201"):
            await self.ensure_room_clean(room_number)

        payload_a = {"guest": self.unique_guest("TS06A"), "room_type": "single"}
        payload_b = {"guest": self.unique_guest("TS06B"), "room_type": "single"}
        res_a, res_b = await asyncio.gather(
            self.reception.post("/reception/check-in", json=payload_a),
            self.reception.post("/reception/check-in", json=payload_b),
        )
        if res_a.status_code >= 400 or res_b.status_code >= 400:
            record_result(scenario_id, description, False, f"Parallel check-in xato: A={res_a.text} B={res_b.text}")
            return

        room_a = res_a.json()["room"]["number"]
        room_b = res_b.json()["room"]["number"]
        if room_a != room_b:
            record_result(scenario_id, description, True, f"Ikki mehmon turli xonalarni oldi: {room_a} va {room_b}")
        else:
            record_result(scenario_id, description, False, f"Bir xil xona ikki marta berildi: {room_a}")

    async def ts07(self):
        scenario_id = "TS-07"
        description = "Suite xonalar to'liq band"
        header(f"{scenario_id}: {description}")
        for room_number in ("203", "302"):
            await self.ensure_checked_in(room_number, "suite", "TS07")

        res = await self.reception.post("/reception/check-in", json={
            "guest": self.unique_guest("TS07"),
            "room_type": "suite",
        })
        if res.status_code == 400 and "No rooms available" in res.json().get("detail", ""):
            record_result(scenario_id, description, True, "Aniq 'No rooms available' xabari qaytdi")
        else:
            record_result(scenario_id, description, False, f"Kutilgan xato qaytmadi: {res.status_code} {res.text}")

    async def ts08(self):
        scenario_id = "TS-08"
        description = "Noto'g'ri xona raqami validatsiyasi"
        header(f"{scenario_id}: {description}")
        res = await self.reception.post("/reception/check-in", json={
            "guest": self.unique_guest("TS08"),
            "room_type": "double",
            "room_number": "FAKE999",
        })
        if res.status_code == 400 and "not found" in res.json().get("detail", "").lower():
            record_result(scenario_id, description, True, f"Aniq xato qaytdi: {res.json()['detail']}")
        else:
            record_result(scenario_id, description, False, f"Kutilgan validatsiya xatosi qaytmadi: {res.status_code} {res.text}")


async def get_admin_token() -> str:
    async with httpx.AsyncClient(base_url=RECEPTION_BASE, timeout=20.0) as client:
        res = await client.post("/auth/login", json=ADMIN_CREDENTIALS)
        res.raise_for_status()
        return res.json()["access_token"]


async def health_check() -> None:
    services = [
        ("reception", RECEPTION_BASE),
        ("housekeeping", HOUSEKEEPING_BASE),
        ("room_service", ROOM_SERVICE_BASE),
        ("maintenance", MAINTENANCE_BASE),
    ]
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, base in services:
            res = await client.get(f"{base}/health")
            res.raise_for_status()
            pass_line(f"{name} health OK")


async def main():
    console.print("\n[bold]HotelOS - Running TS-01 ... TS-08[/bold]\n")
    await health_check()
    token = await get_admin_token()
    runner = ScenarioRunner(token)
    try:
        await runner.ts01()
        await runner.ts02()
        await runner.ts03()
        await runner.ts04()
        await runner.ts05()
        await runner.ts06()
        await runner.ts07()
        await runner.ts08()
    finally:
        await runner.close()

    render_summary()
    console.print("[bold green]Scenario run complete.[/bold green]\n")


if __name__ == "__main__":
    asyncio.run(main())
