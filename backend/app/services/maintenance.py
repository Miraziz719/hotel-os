"""
Maintenance Service
-------------------
Handles room issue reports with a priority queue.
Status flow: open -> in_progress -> resolved
"""
import heapq
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IssueStatus, IssueUrgency, MaintenanceIssue, Room, RoomStatus
from app.redis_client import publish_event
from app.schemas import MaintenanceIssueCreate

URGENCY_PRIORITY = {
    IssueUrgency.critical: 4,
    IssueUrgency.high: 3,
    IssueUrgency.normal: 2,
    IssueUrgency.low: 1,
}

ISSUE_PROGRESSION = {
    IssueStatus.open: IssueStatus.in_progress,
    IssueStatus.in_progress: IssueStatus.resolved,
}

_issue_heap: list[tuple[int, int]] = []


async def init_issue_heap() -> None:
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        stmt = select(MaintenanceIssue).where(
            MaintenanceIssue.status != IssueStatus.resolved
        )
        result = await db.execute(stmt)
        issues = result.scalars().all()
        for issue in issues:
            priority = URGENCY_PRIORITY[issue.urgency]
            heapq.heappush(_issue_heap, (-priority, issue.id))
    print(f"[Maintenance] Heap restored from DB: {len(_issue_heap)} open issues")


async def report_issue(db: AsyncSession, data: MaintenanceIssueCreate, reportedBy: str = "staff") -> MaintenanceIssue:
    async with db.begin():
        stmt = select(Room).where(Room.number == data.room_number)
        result = await db.execute(stmt)
        room = result.scalar_one_or_none()

        if not room:
            raise ValueError(f"Room '{data.room_number}' not found")

        issue = MaintenanceIssue(
            room_id=room.id,
            description=data.description,
            urgency=data.urgency,
            status=IssueStatus.open,
            technician=None,
            reported_by=reportedBy,
            image_url=data.image_url,
        )
        db.add(issue)

        room.status = RoomStatus.maintenance

        await db.flush()
        issue_id = issue.id

    priority = URGENCY_PRIORITY[data.urgency]
    heapq.heappush(_issue_heap, (-priority, issue_id))
    await db.refresh(issue)

    await publish_event("room_status_changed", {
        "room_number": data.room_number,
        "old_status": "unknown",
        "new_status": "maintenance",
    })
    await publish_event("issue_created", {
        "issue_id": issue_id,
        "room_number": data.room_number,
        "urgency": data.urgency.value,
        "technician": None,
    })
    await publish_event("dashboard_update", {
        "type": "new_issue",
        "issue_id": issue_id,
        "room": data.room_number,
        "urgency": data.urgency.value,
    })
    return issue


async def advance_issue_status(
    db: AsyncSession,
    issue_id: int,
    acted_by: str = None,
    resolution_note: str = None,
    resolution_image_url: str = None,
) -> MaintenanceIssue:
    async with db.begin():
        stmt = select(MaintenanceIssue).where(MaintenanceIssue.id == issue_id)
        result = await db.execute(stmt)
        issue = result.scalar_one_or_none()

        if not issue:
            raise ValueError(f"Issue #{issue_id} not found")

        next_status = ISSUE_PROGRESSION.get(issue.status)
        if not next_status:
            raise ValueError(f"Issue #{issue_id} already resolved")

        issue.status = next_status
        if acted_by:
            issue.technician = acted_by
        if next_status == IssueStatus.resolved:
            issue.resolved_at = datetime.now(timezone.utc)
            if resolution_note:
                issue.resolution_note = resolution_note
            if resolution_image_url:
                issue.resolution_image_url = resolution_image_url

            other_stmt = select(MaintenanceIssue).where(
                MaintenanceIssue.room_id == issue.room_id,
                MaintenanceIssue.status != IssueStatus.resolved,
                MaintenanceIssue.id != issue_id,
            )
            other_result = await db.execute(other_stmt)
            other_open = other_result.scalars().first()

            room_stmt = select(Room).where(Room.id == issue.room_id)
            room_result = await db.execute(room_stmt)
            room = room_result.scalar_one()

            if not other_open and room.status == RoomStatus.maintenance:
                room.status = RoomStatus.dirty

    await db.refresh(issue)

    await publish_event("dashboard_update", {
        "type": "issue_status",
        "issue_id": issue_id,
        "status": issue.status.value,
    })

    if issue.status == IssueStatus.resolved:
        await publish_event("issue_resolved", {
            "issue_id": issue_id,
            "room_number": room.number,
        })

    return issue


async def resolve_issue(db: AsyncSession, issue_id: int) -> MaintenanceIssue:
    return await advance_issue_status(db, issue_id)


def _issue_to_dict(issue: MaintenanceIssue, room: Room) -> dict:
    return {
        "id": issue.id,
        "room_id": room.number,
        "room_number": room.number,
        "description": issue.description,
        "urgency": issue.urgency.value,
        "status": issue.status.value,
        "technician": issue.technician,
        "reported_by": issue.reported_by,
        "image_url": issue.image_url,
        "resolution_note": issue.resolution_note,
        "resolution_image_url": issue.resolution_image_url,
        "created_at": issue.created_at,
        "resolved_at": issue.resolved_at,
    }


async def get_open_issues(db: AsyncSession) -> list[dict]:
    stmt = (
        select(MaintenanceIssue, Room)
        .join(Room, MaintenanceIssue.room_id == Room.id)
        .where(MaintenanceIssue.status != IssueStatus.resolved)
    )
    result = await db.execute(stmt)
    rows = result.all()
    rows.sort(key=lambda row: URGENCY_PRIORITY[row[0].urgency], reverse=True)
    return [_issue_to_dict(i, r) for i, r in rows]


async def get_completed_issues(db: AsyncSession) -> list[dict]:
    stmt = (
        select(MaintenanceIssue, Room)
        .join(Room, MaintenanceIssue.room_id == Room.id)
        .where(MaintenanceIssue.status == IssueStatus.resolved)
        .order_by(MaintenanceIssue.resolved_at.desc(), MaintenanceIssue.created_at.desc())
    )
    result = await db.execute(stmt)
    return [_issue_to_dict(i, r) for i, r in result.all()]


def get_priority_queue_snapshot() -> list[tuple[int, int]]:
    return list(_issue_heap)
