from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import MaintenanceIssueCreate, IssueResolveRequest, IssueAdvanceRequest, IssueOut
from app.services import maintenance as svc
from app.auth import requireRoles

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

_access = requireRoles("maintenance", "reception", "admin")
_report_access = requireRoles("maintenance", "reception", "admin", "guest")


@router.post("/report", response_model=IssueOut)
async def report_issue(
    data: MaintenanceIssueCreate,
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_report_access),
):
    if currentUser.get("role") == "guest":
        room_number = currentUser.get("room_number")
        if data.room_number != room_number:
            raise HTTPException(status_code=403, detail=f"Siz faqat {room_number}-xona uchun xabar bera olasiz")
        from app.services.reception import has_active_booking
        if not await has_active_booking(db, room_number):
            raise HTTPException(status_code=403, detail="Siz check-out qilgansiz. Murojaat yuborish uchun check-in holatida bo'lishingiz kerak.")

    reportedBy = currentUser.get("username", currentUser.get("role", "staff"))
    try:
        issue = await svc.report_issue(db, data, reportedBy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return issue


@router.post("/resolve")
async def resolve_issue(
    data: IssueResolveRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_access),
):
    try:
        issue = await svc.resolve_issue(db, data.issue_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"Issue #{data.issue_id} resolved", "issue": issue}


@router.post("/issue/{issue_id}/advance")
async def advance_issue(
    issue_id: int,
    data: IssueAdvanceRequest = IssueAdvanceRequest(),
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_access),
):
    acted_by = currentUser.get("username", currentUser.get("role", "staff"))
    try:
        issue = await svc.advance_issue_status(
            db, issue_id,
            acted_by=acted_by,
            resolution_note=data.resolution_note,
            resolution_image_url=data.resolution_image_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"Issue #{issue_id} is now '{issue.status.value}'", "issue": issue}


@router.get("/open")
async def open_issues(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_access),
):
    return await svc.get_open_issues(db)


@router.get("/completed")
async def completed_issues(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_access),
):
    return await svc.get_completed_issues(db)


@router.get("/queue-debug")
async def queue_debug(_: dict = Depends(_access)):
    return {"heap": svc.get_priority_queue_snapshot()}


@router.get("/rooms")
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_access),
):
    from sqlalchemy import select
    from app.models import Room
    result = await db.execute(select(Room).order_by(Room.number))
    rooms = result.scalars().all()
    return [{"number": r.number, "floor": r.floor, "room_type": r.room_type.value, "status": r.status.value} for r in rooms]


@router.get("/my-issues")
async def my_issues(
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(requireRoles("guest")),
):
    from sqlalchemy import select
    from app.models import MaintenanceIssue, Room

    room_number = currentUser.get("room_number")
    room_result = await db.execute(select(Room).where(Room.number == room_number))
    room = room_result.scalar_one_or_none()
    if not room:
        return []

    result = await db.execute(
        select(MaintenanceIssue)
        .where(MaintenanceIssue.room_id == room.id)
        .order_by(MaintenanceIssue.created_at.desc())
    )
    from app.services.maintenance import _issue_to_dict
    return [_issue_to_dict(i, room) for i in result.scalars().all()]

