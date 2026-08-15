"""Hostel request and response contracts."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from pydantic import Field, model_validator
from app.schemas.common import APIResponse, Wire

class BlockIn(Wire): name:str=Field(min_length=1,max_length=100); gender:Literal["MALE","FEMALE","OTHER"]; warden_id:uuid.UUID|None=None
class RoomIn(Wire): block_id:uuid.UUID; room_number:str=Field(min_length=1,max_length=20); floor:int=Field(0,ge=0,le=100); capacity:int=Field(2,ge=1,le=100); room_type:Literal["SINGLE","SHARED","DORMITORY"]="SHARED"; monthly_fee:Decimal=Field(ge=0); amenities:list[str]=Field(default_factory=list)
class AllotmentIn(Wire): student_id:uuid.UUID; room_id:uuid.UUID; academic_year_id:uuid.UUID; bed_number:int=Field(ge=1); allotted_from:date; allotted_to:date|None=None
class VacateIn(Wire): status:Literal["VACATED","TRANSFERRED"]="VACATED"; allotted_to:date|None=None
class AttendanceEntry(Wire): student_id:uuid.UUID; status:Literal["PRESENT","ABSENT","ON_LEAVE"]
class AttendanceIn(Wire): date:date; entries:list[AttendanceEntry]=Field(min_length=1)
class LeaveIn(Wire): from_date:date; to_date:date; reason:str=Field(min_length=3,max_length=2000); destination:str|None=Field(None,max_length=500); contact_during_leave:str|None=Field(None,max_length=20)
class ReviewIn(Wire): status:Literal["APPROVED","REJECTED"]
class ComplaintIn(Wire): category:Literal["MAINTENANCE","FOOD","SECURITY","OTHER"]; description:str=Field(min_length=3,max_length=3000)
class ComplaintStatusIn(Wire): status:Literal["IN_PROGRESS","RESOLVED"]
class BlockRow(Wire): id:uuid.UUID; name:str; gender:str; warden_id:uuid.UUID|None; warden_name:str|None; total_rooms:int; total_capacity:int; occupied:int; is_active:bool
class RoomRow(Wire): id:uuid.UUID; block_id:uuid.UUID; block_name:str; room_number:str; floor:int; capacity:int; occupied:int; room_type:str; monthly_fee:Decimal; amenities:list[str]; is_active:bool
class AllotmentRow(Wire): id:uuid.UUID; student_id:uuid.UUID; student_name:str; student_ref:str; room_id:uuid.UUID; room_number:str; block_name:str; bed_number:int; allotted_from:date; allotted_to:date|None; status:str
class AttendanceRow(Wire): student_id:uuid.UUID; student_name:str; room_number:str; status:str; date:date
class LeaveRow(Wire): id:uuid.UUID; student_id:uuid.UUID; student_name:str; from_date:date; to_date:date; reason:str; destination:str|None; contact_during_leave:str|None; status:str; reviewed_by_name:str|None; created_at:datetime
class ComplaintRow(Wire): id:uuid.UUID; student_id:uuid.UUID; student_name:str; room_id:uuid.UUID|None; room_number:str|None; category:str; description:str; status:str; resolved_by_name:str|None; resolved_at:datetime|None; created_at:datetime
class Dashboard(Wire): blocks:int; rooms:int; capacity:int; occupied:int; available:int; absent_today:int; pending_leaves:int; open_complaints:int; can_manage:bool; own_room:RoomRow|None=None
class HostelPage(Wire): items:list; total:int; can_manage:bool; can_create:bool=False
APIResponseDashboard=APIResponse[Dashboard]; APIResponsePage=APIResponse[HostelPage]; APIResponseBlock=APIResponse[BlockRow]; APIResponseRoom=APIResponse[RoomRow]; APIResponseAllotment=APIResponse[AllotmentRow]; APIResponseAttendance=APIResponse[list[AttendanceRow]]; APIResponseLeave=APIResponse[LeaveRow]; APIResponseComplaint=APIResponse[ComplaintRow]
