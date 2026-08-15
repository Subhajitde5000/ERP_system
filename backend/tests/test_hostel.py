"""Hostel API, validation and occupancy regressions."""
from datetime import date,timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock,MagicMock
import uuid,pytest
from fastapi import HTTPException
from app.main import app
from app.models.hostel import AllotmentStatus
from app.schemas.hostel import LeaveIn,RoomIn
from app.services.hostel_service import HostelService

def test_hostel_routes_registered():
 paths=app.openapi()["paths"]
 expected={"/api/v1/hostel/dashboard","/api/v1/hostel/rooms","/api/v1/hostel/rooms/{id}","/api/v1/hostel/allotments","/api/v1/hostel/attendance","/api/v1/hostel/leaves","/api/v1/hostel/complaints"}
 assert expected<=set(paths)
def test_room_contract_rejects_invalid_capacity():
 with pytest.raises(Exception): RoomIn(blockId=uuid.uuid4(),roomNumber="1",capacity=0,monthlyFee=0)
async def test_leave_requires_active_allotment(monkeypatch):
 user=SimpleNamespace(id=uuid.uuid4(),tenant_id=uuid.uuid4()); db=MagicMock(); db.scalar=AsyncMock(return_value=None); monkeypatch.setattr(HostelService,"access",AsyncMock(return_value="RESIDENT")); monkeypatch.setattr(HostelService,"allowed_students",AsyncMock(return_value=[user.id]))
 with pytest.raises(HTTPException) as raised: await HostelService.create_leave(db,user,LeaveIn(fromDate=date.today()+timedelta(days=1),toDate=date.today()+timedelta(days=2),reason="Family visit"))
 assert raised.value.status_code==409
async def test_closing_allotment_sets_end_date(monkeypatch):
 user=SimpleNamespace(id=uuid.uuid4(),tenant_id=uuid.uuid4()); allotment=SimpleNamespace(id=uuid.uuid4(),status=AllotmentStatus.ACTIVE,allotted_to=None); db=MagicMock(); db.scalar=AsyncMock(return_value=allotment); db.commit=AsyncMock(); db.rollback=AsyncMock(); monkeypatch.setattr(HostelService,"access",AsyncMock(return_value="MANAGE"))
 result=await HostelService.vacate(db,user,uuid.uuid4(),SimpleNamespace(status="VACATED",allotted_to=None))
 assert result["status"]=="VACATED" and allotment.allotted_to==date.today()
