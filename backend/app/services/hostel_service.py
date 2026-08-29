"""Hostel operations with module, role, tenant, room and resident fences."""
from __future__ import annotations
import uuid
from datetime import date, datetime, timezone
from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.academic import AcademicYear
from app.models.billing import TenantModule
from app.models.hostel import *
from app.models.role import Role, RoleAssignment
from app.models.user import User
from app.schemas.hostel import *

MANAGE={"HOSTEL_WARDEN"}; OVERSEE={"PRINCIPAL","VICE_PRINCIPAL","INSTITUTION_ADMIN"}
def missing(label): return HTTPException(404,f"{label} not found")
class HostelService:
 @staticmethod
 async def commit(db,msg):
  try: await db.commit()
  except IntegrityError as exc: await db.rollback(); raise HTTPException(409,msg) from exc
 @staticmethod
 async def access(db,user,manage=False):
  enabled=await db.scalar(select(TenantModule.is_enabled).where(TenantModule.tenant_id==user.tenant_id,TenantModule.module_key=="hostel"))
  if enabled is not True: raise HTTPException(403,"Hostel module is not enabled")
  roles=set((await db.execute(select(Role.name).join(RoleAssignment,RoleAssignment.role_id==Role.id).where(RoleAssignment.user_id==user.id,RoleAssignment.tenant_id==user.tenant_id,RoleAssignment.is_active.is_(True),or_(RoleAssignment.expires_at.is_(None),RoleAssignment.expires_at>datetime.now(timezone.utc))))).scalars().all())
  level="MANAGE" if roles&MANAGE else "OVERSEE" if roles&OVERSEE else "RESIDENT" if "STUDENT" in roles else "GUARDIAN" if "PARENT" in roles else "NONE"
  if level=="NONE" or manage and level!="MANAGE": raise HTTPException(403,"Hostel access is not permitted")
  return level
 @staticmethod
 async def allowed_students(db,user,level):
  if level in {"MANAGE","OVERSEE"}: return None
  if level=="RESIDENT": return [user.id]
  # Live links only: a suspended or expired grant must not keep a guardian in
  # the hostel view. Same rule the parent portal applies (see ParentService.link).
  today = date.today()
  return list((await db.execute(select(ParentStudentLink.student_id).where(ParentStudentLink.tenant_id==user.tenant_id,ParentStudentLink.parent_id==user.id,ParentStudentLink.status=="ACTIVE",or_(ParentStudentLink.access_upto.is_(None),ParentStudentLink.access_upto>=today)))).scalars().all())
 @staticmethod
 async def room_rows(db,user,level,query=None):
  occupied=select(func.count()).select_from(HostelAllotment).where(HostelAllotment.room_id==HostelRoom.id,HostelAllotment.status==AllotmentStatus.ACTIVE).correlate(HostelRoom).scalar_subquery()
  stmt=select(HostelRoom,HostelBlock.name,occupied).join(HostelBlock,HostelBlock.id==HostelRoom.block_id).where(HostelRoom.tenant_id==user.tenant_id)
  students=await HostelService.allowed_students(db,user,level)
  if students is not None: stmt=stmt.join(HostelAllotment,HostelAllotment.room_id==HostelRoom.id).where(HostelAllotment.student_id.in_(students),HostelAllotment.status==AllotmentStatus.ACTIVE)
  if query: stmt=stmt.where(or_(func.lower(HostelRoom.room_number).like(f"%{query.lower()}%"),func.lower(HostelBlock.name).like(f"%{query.lower()}%")))
  rows=(await db.execute(stmt.order_by(HostelBlock.name,HostelRoom.room_number))).all()
  return [RoomRow(id=r.id,block_id=r.block_id,block_name=b,room_number=r.room_number,floor=r.floor,capacity=r.capacity,occupied=o,room_type=r.room_type,monthly_fee=r.monthly_fee,amenities=r.amenities or [],is_active=r.is_active) for r,b,o in rows]
 @staticmethod
 async def dashboard(db,user):
  level=await HostelService.access(db,user); rooms=await HostelService.room_rows(db,user,level); students=await HostelService.allowed_students(db,user,level)
  block_ids={r.block_id for r in rooms}
  blocks=int(await db.scalar(select(func.count()).select_from(HostelBlock).where(HostelBlock.tenant_id==user.tenant_id,HostelBlock.is_active.is_(True))) or 0) if students is None else len(block_ids)
  attendance_filters=[HostelAttendance.tenant_id==user.tenant_id,HostelAttendance.date==date.today(),HostelAttendance.status==HostelAttendanceStatus.ABSENT]
  leave_filters=[HostelLeaveRequest.tenant_id==user.tenant_id,HostelLeaveRequest.status==LeaveStatus.PENDING]
  complaint_filters=[HostelComplaint.tenant_id==user.tenant_id,HostelComplaint.status!=ComplaintStatus.RESOLVED]
  if students is not None:
   attendance_filters.append(HostelAttendance.student_id.in_(students)); leave_filters.append(HostelLeaveRequest.student_id.in_(students)); complaint_filters.append(HostelComplaint.student_id.in_(students))
  absent=int(await db.scalar(select(func.count()).select_from(HostelAttendance).where(*attendance_filters)) or 0)
  leaves=int(await db.scalar(select(func.count()).select_from(HostelLeaveRequest).where(*leave_filters)) or 0)
  complaints=int(await db.scalar(select(func.count()).select_from(HostelComplaint).where(*complaint_filters)) or 0)
  capacity=sum(r.capacity for r in rooms); occupied=sum(r.occupied for r in rooms)
  return Dashboard(blocks=blocks,rooms=len(rooms),capacity=capacity,occupied=occupied,available=capacity-occupied,absent_today=absent,pending_leaves=leaves,open_complaints=complaints,can_manage=level=="MANAGE",own_room=rooms[0] if level in {"RESIDENT","GUARDIAN"} and rooms else None)
 @staticmethod
 async def rooms(db,user,query):
  level=await HostelService.access(db,user); rows=await HostelService.room_rows(db,user,level,query); return HostelPage(items=rows,total=len(rows),can_manage=level=="MANAGE")
 @staticmethod
 async def room_detail(db,user,room_id):
  level=await HostelService.access(db,user); rooms=await HostelService.room_rows(db,user,level); room=next((r for r in rooms if r.id==room_id),None)
  if not room: raise missing("Room")
  rows=(await db.execute(select(HostelAllotment,User).join(User,User.id==HostelAllotment.student_id).where(HostelAllotment.tenant_id==user.tenant_id,HostelAllotment.room_id==room_id,HostelAllotment.status==AllotmentStatus.ACTIVE).order_by(HostelAllotment.bed_number))).all()
  occupants=[]; allowed=await HostelService.allowed_students(db,user,level)
  for a,s in rows:
   if level=="GUARDIAN" and allowed is not None and s.id not in allowed: continue
   item={"studentId":str(s.id),"studentName":s.name,"bedNumber":a.bed_number,"isSelf":s.id==user.id}
   if level in {"MANAGE","OVERSEE"}: item.update({"rollNo":s.student_roll_no,"allottedFrom":a.allotted_from.isoformat(),"status":a.status.value})
   if level=="MANAGE": item["allotmentId"]=str(a.id)
   occupants.append(item)
  return {"room":room.model_dump(mode="json",by_alias=True),"occupants":occupants,"canManage":level=="MANAGE"}
 @staticmethod
 async def management_context(db,user):
  await HostelService.access(db,user,True)
  year=await db.execute(select(AcademicYear.id,AcademicYear.name).where(AcademicYear.tenant_id==user.tenant_id,AcademicYear.is_current.is_(True)))
  y=year.first(); students=(await db.execute(select(User.id,User.name,User.student_roll_no).where(User.tenant_id==user.tenant_id,User.student_roll_no.is_not(None),User.is_active.is_(True),User.deleted_at.is_(None)).order_by(User.name))).all()
  rooms=await HostelService.room_rows(db,user,"MANAGE")
  blocks=(await db.execute(select(HostelBlock.id,HostelBlock.name).where(HostelBlock.tenant_id==user.tenant_id,HostelBlock.is_active.is_(True)).order_by(HostelBlock.name))).all()
  return {"academicYear":{"id":str(y.id),"name":y.name} if y else None,"students":[{"id":str(i),"name":n,"ref":r} for i,n,r in students],"rooms":[r.model_dump(mode="json",by_alias=True) for r in rooms],"blocks":[{"id":str(i),"name":n} for i,n in blocks]}
 @staticmethod
 async def blocks(db,user):
  level=await HostelService.access(db,user)
  if level not in {"MANAGE","OVERSEE"}: raise HTTPException(403,"Block directory is restricted")
  occ=select(func.count()).select_from(HostelAllotment).join(HostelRoom,HostelRoom.id==HostelAllotment.room_id).where(HostelRoom.block_id==HostelBlock.id,HostelAllotment.status==AllotmentStatus.ACTIVE).correlate(HostelBlock).scalar_subquery()
  rows=(await db.execute(select(HostelBlock,User.name,occ).outerjoin(User,User.id==HostelBlock.warden_id).where(HostelBlock.tenant_id==user.tenant_id).order_by(HostelBlock.name))).all()
  return HostelPage(items=[BlockRow(id=b.id,name=b.name,gender=b.gender.value,warden_id=b.warden_id,warden_name=n,total_rooms=b.total_rooms,total_capacity=b.total_capacity,occupied=o,is_active=b.is_active) for b,n,o in rows],total=len(rows),can_manage=level=="MANAGE")
 @staticmethod
 async def create_block(db,user,p):
  await HostelService.access(db,user,True); b=HostelBlock(id=uuid.uuid4(),tenant_id=user.tenant_id,**p.model_dump()); db.add(b); await HostelService.commit(db,"Block name already exists"); return BlockRow(id=b.id,name=b.name,gender=b.gender.value,warden_id=b.warden_id,warden_name=None,total_rooms=0,total_capacity=0,occupied=0,is_active=True)
 @staticmethod
 async def create_room(db,user,p):
  await HostelService.access(db,user,True); block=await db.scalar(select(HostelBlock).where(HostelBlock.id==p.block_id,HostelBlock.tenant_id==user.tenant_id));
  if not block: raise missing("Block")
  r=HostelRoom(id=uuid.uuid4(),tenant_id=user.tenant_id,**p.model_dump()); db.add(r); await HostelService.commit(db,"Room number already exists in this block"); rows=await HostelService.room_rows(db,user,"MANAGE",r.room_number); return next(x for x in rows if x.id==r.id)
 @staticmethod
 async def allot(db,user,p):
  await HostelService.access(db,user,True); room=await db.scalar(select(HostelRoom).where(HostelRoom.id==p.room_id,HostelRoom.tenant_id==user.tenant_id).with_for_update()); student=await db.scalar(select(User).where(User.id==p.student_id,User.tenant_id==user.tenant_id,User.is_active.is_(True)))
  if not room: raise missing("Room")
  if not student: raise missing("Student")
  if not await db.scalar(select(AcademicYear.id).where(AcademicYear.id==p.academic_year_id,AcademicYear.tenant_id==user.tenant_id)): raise missing("Academic year")
  occupied=int(await db.scalar(select(func.count()).select_from(HostelAllotment).where(HostelAllotment.room_id==room.id,HostelAllotment.status==AllotmentStatus.ACTIVE)) or 0)
  if occupied>=room.capacity or p.bed_number>room.capacity: raise HTTPException(409,"Room has no available bed")
  a=HostelAllotment(id=uuid.uuid4(),tenant_id=user.tenant_id,allotted_by=user.id,status=AllotmentStatus.ACTIVE,**p.model_dump()); db.add(a); await HostelService.commit(db,"Student or bed already has an active allotment"); return AllotmentRow(id=a.id,student_id=student.id,student_name=student.name,student_ref=student.student_roll_no or str(student.id)[:8],room_id=room.id,room_number=room.room_number,block_name="",bed_number=a.bed_number,allotted_from=a.allotted_from,allotted_to=a.allotted_to,status=a.status.value)
 @staticmethod
 async def vacate(db,user,id,p):
  await HostelService.access(db,user,True); a=await db.scalar(select(HostelAllotment).where(HostelAllotment.id==id,HostelAllotment.tenant_id==user.tenant_id).with_for_update());
  if not a: raise missing("Allotment")
  if a.status!=AllotmentStatus.ACTIVE: raise HTTPException(409,"Allotment is already closed")
  a.status=AllotmentStatus(p.status); a.allotted_to=p.allotted_to or date.today(); await HostelService.commit(db,"Allotment could not be closed"); return {"id":a.id,"status":a.status.value}
 @staticmethod
 async def mark_attendance(db,user,p):
  await HostelService.access(db,user,True)
  if p.date>date.today(): raise HTTPException(422,"Attendance cannot be marked for a future date")
  ids=[e.student_id for e in p.entries]
  leave_ids={e.student_id for e in p.entries if e.status=="ON_LEAVE"}
  if leave_ids:
   approved=set((await db.execute(select(HostelLeaveRequest.student_id).where(HostelLeaveRequest.tenant_id==user.tenant_id,HostelLeaveRequest.student_id.in_(leave_ids),HostelLeaveRequest.status==LeaveStatus.APPROVED,HostelLeaveRequest.from_date<=p.date,HostelLeaveRequest.to_date>=p.date))).scalars().all())
   if approved!=leave_ids: raise HTTPException(422,"ON_LEAVE requires an approved hostel leave")
  allotments=list((await db.execute(select(HostelAllotment).where(HostelAllotment.tenant_id==user.tenant_id,HostelAllotment.student_id.in_(ids),HostelAllotment.status==AllotmentStatus.ACTIVE))).scalars().all())
  by_student={a.student_id:a for a in allotments}
  if len(by_student)!=len(set(ids)): raise HTTPException(422,"Every student must have an active hostel allotment")
  existing=list((await db.execute(select(HostelAttendance).where(HostelAttendance.tenant_id==user.tenant_id,HostelAttendance.student_id.in_(ids),HostelAttendance.date==p.date).with_for_update())).scalars().all()); by_existing={x.student_id:x for x in existing}
  for e in p.entries:
   row=by_existing.get(e.student_id)
   if row: row.status=HostelAttendanceStatus(e.status); row.marked_by=user.id; row.marked_at=datetime.now(timezone.utc)
   else: db.add(HostelAttendance(id=uuid.uuid4(),tenant_id=user.tenant_id,room_id=by_student[e.student_id].room_id,student_id=e.student_id,date=p.date,status=HostelAttendanceStatus(e.status),marked_by=user.id))
  await HostelService.commit(db,"Attendance could not be saved"); return []
 @staticmethod
 async def leaves(db,user,status_filter=None):
  level=await HostelService.access(db,user); students=await HostelService.allowed_students(db,user,level); reviewer=User.__table__.alias("reviewer")
  stmt=select(HostelLeaveRequest,User.name,reviewer.c.name).join(User,User.id==HostelLeaveRequest.student_id).outerjoin(reviewer,reviewer.c.id==HostelLeaveRequest.reviewed_by).where(HostelLeaveRequest.tenant_id==user.tenant_id)
  if students is not None: stmt=stmt.where(HostelLeaveRequest.student_id.in_(students))
  if status_filter: stmt=stmt.where(HostelLeaveRequest.status==status_filter)
  rows=(await db.execute(stmt.order_by(HostelLeaveRequest.created_at.desc()))).all(); return HostelPage(items=[LeaveRow(id=x.id,student_id=x.student_id,student_name=n,from_date=x.from_date,to_date=x.to_date,reason=x.reason,destination=x.destination,contact_during_leave=x.contact_during_leave,status=x.status.value,reviewed_by_name=rn,created_at=x.created_at) for x,n,rn in rows],total=len(rows),can_manage=level=="MANAGE",can_create=level=="RESIDENT")
 @staticmethod
 async def create_leave(db,user,p):
  level=await HostelService.access(db,user)
  if level!="RESIDENT": raise HTTPException(403,"Only a resident can request hostel leave")
  if p.from_date<date.today() or p.to_date<p.from_date: raise HTTPException(422,"Invalid leave dates")
  if not await db.scalar(select(HostelAllotment.id).where(HostelAllotment.student_id==user.id,HostelAllotment.tenant_id==user.tenant_id,HostelAllotment.status==AllotmentStatus.ACTIVE)): raise HTTPException(409,"An active room allotment is required")
  overlap=await db.scalar(select(HostelLeaveRequest.id).where(HostelLeaveRequest.tenant_id==user.tenant_id,HostelLeaveRequest.student_id==user.id,HostelLeaveRequest.status.in_([LeaveStatus.PENDING,LeaveStatus.APPROVED]),HostelLeaveRequest.from_date<=p.to_date,HostelLeaveRequest.to_date>=p.from_date).with_for_update())
  if overlap: raise HTTPException(409,"Leave dates overlap an existing request")
  x=HostelLeaveRequest(id=uuid.uuid4(),tenant_id=user.tenant_id,student_id=user.id,status=LeaveStatus.PENDING,**p.model_dump()); db.add(x); await HostelService.commit(db,"Leave request overlaps an existing request"); return await HostelService._leave_row(db,x)
 @staticmethod
 async def _leave_row(db,x):
  n=await db.scalar(select(User.name).where(User.id==x.student_id)); return LeaveRow(id=x.id,student_id=x.student_id,student_name=n,from_date=x.from_date,to_date=x.to_date,reason=x.reason,destination=x.destination,contact_during_leave=x.contact_during_leave,status=x.status.value,reviewed_by_name=None,created_at=x.created_at)
 @staticmethod
 async def review_leave(db,user,id,p):
  await HostelService.access(db,user,True); x=await db.scalar(select(HostelLeaveRequest).where(HostelLeaveRequest.id==id,HostelLeaveRequest.tenant_id==user.tenant_id).with_for_update());
  if not x: raise missing("Leave request")
  if x.status!=LeaveStatus.PENDING: raise HTTPException(409,"Leave request is already reviewed")
  x.status=LeaveStatus(p.status); x.reviewed_by=user.id; x.reviewed_at=datetime.now(timezone.utc); await HostelService.commit(db,"Leave review failed"); return await HostelService._leave_row(db,x)
 @staticmethod
 async def complaints(db,user):
  level=await HostelService.access(db,user); students=await HostelService.allowed_students(db,user,level); resolver=User.__table__.alias("resolver"); stmt=select(HostelComplaint,User.name,HostelRoom.room_number,resolver.c.name).join(User,User.id==HostelComplaint.student_id).outerjoin(HostelRoom,HostelRoom.id==HostelComplaint.room_id).outerjoin(resolver,resolver.c.id==HostelComplaint.resolved_by).where(HostelComplaint.tenant_id==user.tenant_id)
  if students is not None: stmt=stmt.where(HostelComplaint.student_id.in_(students))
  rows=(await db.execute(stmt.order_by(HostelComplaint.created_at.desc()))).all(); return HostelPage(items=[ComplaintRow(id=x.id,student_id=x.student_id,student_name=n,room_id=x.room_id,room_number=rn,category=x.category,description=x.description,status=x.status.value,resolved_by_name=resolver_name,resolved_at=x.resolved_at,created_at=x.created_at) for x,n,rn,resolver_name in rows],total=len(rows),can_manage=level=="MANAGE",can_create=level=="RESIDENT")
 @staticmethod
 async def create_complaint(db,user,p):
  level=await HostelService.access(db,user)
  if level!="RESIDENT": raise HTTPException(403,"Only a resident can raise a complaint")
  a=await db.scalar(select(HostelAllotment).where(HostelAllotment.student_id==user.id,HostelAllotment.tenant_id==user.tenant_id,HostelAllotment.status==AllotmentStatus.ACTIVE));
  if not a: raise HTTPException(409,"An active room allotment is required")
  x=HostelComplaint(id=uuid.uuid4(),tenant_id=user.tenant_id,student_id=user.id,room_id=a.room_id,status=ComplaintStatus.OPEN,**p.model_dump()); db.add(x); await HostelService.commit(db,"Complaint could not be created"); rows=(await HostelService.complaints(db,user)).items; return next(r for r in rows if r.id==x.id)
 @staticmethod
 async def update_complaint(db,user,id,p):
  await HostelService.access(db,user,True); x=await db.scalar(select(HostelComplaint).where(HostelComplaint.id==id,HostelComplaint.tenant_id==user.tenant_id).with_for_update());
  if not x: raise missing("Complaint")
  if x.status==ComplaintStatus.RESOLVED: raise HTTPException(409,"Complaint is already resolved")
  x.status=ComplaintStatus(p.status)
  if x.status==ComplaintStatus.RESOLVED: x.resolved_by=user.id; x.resolved_at=datetime.now(timezone.utc)
  await HostelService.commit(db,"Complaint update failed"); return {"id":x.id,"status":x.status.value}
