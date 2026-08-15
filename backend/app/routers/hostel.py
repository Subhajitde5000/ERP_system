"""Hostel room, allotment, roll-call, leave and complaint API."""
import uuid
from typing import Annotated
from fastapi import APIRouter,Depends,Query,status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies.auth import get_current_tenant_user
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.hostel import *
from app.services.hostel_service import HostelService
router=APIRouter(prefix="/hostel",tags=["Hostel"]); DB=Annotated[AsyncSession,Depends(get_db)]; Current=Annotated[User,Depends(get_current_tenant_user)]
@router.get("/dashboard",response_model=APIResponseDashboard)
async def dashboard(db:DB,user:Current): return APIResponse(data=await HostelService.dashboard(db,user))
@router.get("/management-context")
async def context(db:DB,user:Current): return APIResponse(data=await HostelService.management_context(db,user))
@router.get("/blocks",response_model=APIResponsePage)
async def blocks(db:DB,user:Current): return APIResponse(data=await HostelService.blocks(db,user))
@router.post("/blocks",response_model=APIResponseBlock,status_code=201)
async def create_block(p:BlockIn,db:DB,user:Current): return APIResponse(data=await HostelService.create_block(db,user,p))
@router.get("/rooms",response_model=APIResponsePage)
async def rooms(db:DB,user:Current,query:str|None=Query(None,max_length=100)): return APIResponse(data=await HostelService.rooms(db,user,query))
@router.get("/rooms/{id}")
async def room(id:uuid.UUID,db:DB,user:Current): return APIResponse(data=await HostelService.room_detail(db,user,id))
@router.post("/rooms",response_model=APIResponseRoom,status_code=201)
async def create_room(p:RoomIn,db:DB,user:Current): return APIResponse(data=await HostelService.create_room(db,user,p))
@router.post("/allotments",response_model=APIResponseAllotment,status_code=201)
async def allot(p:AllotmentIn,db:DB,user:Current): return APIResponse(data=await HostelService.allot(db,user,p))
@router.post("/allotments/{id}/close")
async def vacate(id:uuid.UUID,p:VacateIn,db:DB,user:Current): return APIResponse(data=await HostelService.vacate(db,user,id,p))
@router.put("/attendance",response_model=APIResponseAttendance)
async def attendance(p:AttendanceIn,db:DB,user:Current): return APIResponse(data=await HostelService.mark_attendance(db,user,p))
@router.get("/leaves",response_model=APIResponsePage)
async def leaves(db:DB,user:Current,status_filter:str|None=Query(None,alias="status")): return APIResponse(data=await HostelService.leaves(db,user,status_filter))
@router.post("/leaves",response_model=APIResponseLeave,status_code=201)
async def leave(p:LeaveIn,db:DB,user:Current): return APIResponse(data=await HostelService.create_leave(db,user,p))
@router.post("/leaves/{id}/review",response_model=APIResponseLeave)
async def review(id:uuid.UUID,p:ReviewIn,db:DB,user:Current): return APIResponse(data=await HostelService.review_leave(db,user,id,p))
@router.get("/complaints",response_model=APIResponsePage)
async def complaints(db:DB,user:Current): return APIResponse(data=await HostelService.complaints(db,user))
@router.post("/complaints",response_model=APIResponseComplaint,status_code=201)
async def complaint(p:ComplaintIn,db:DB,user:Current): return APIResponse(data=await HostelService.create_complaint(db,user,p))
@router.patch("/complaints/{id}")
async def complaint_status(id:uuid.UUID,p:ComplaintStatusIn,db:DB,user:Current): return APIResponse(data=await HostelService.update_complaint(db,user,id,p))
