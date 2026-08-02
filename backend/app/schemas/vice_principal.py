"""Wire contracts for the delegated Vice Principal console (C-VP-01 … C-VP-07).

The Vice Principal reuses the Principal's aggregate and row contracts wherever
the data is identical, but its responses carry the resolved delegation and
never include Principal-only approval or notice-read-receipt data.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.common import APIResponse
from app.schemas.principal import (
    LeadershipNoticeRow,
    PrincipalAttendanceOverview,
    PrincipalDashboard,
    PrincipalExamPage,
    PrincipalNoticeTargets,
    PrincipalPage,
    PrincipalResultsOverview,
    PrincipalStaffDetail,
    PrincipalStaffPage,
    PrincipalTargetOption,
)


class VicePrincipalDashboard(PrincipalDashboard):
    """Dashboard figures plus the department delegation that produced them."""

    delegated_departments: list[PrincipalTargetOption]


class VicePrincipalNoticePage(PrincipalPage):
    items: list[LeadershipNoticeRow]


class VicePrincipalNoticeDetail(LeadershipNoticeRow):
    """No readers/read count: receipts are Principal/Admin-only."""


APIResponseVicePrincipalDashboard = APIResponse[VicePrincipalDashboard]
APIResponseVicePrincipalAttendance = APIResponse[PrincipalAttendanceOverview]
APIResponseVicePrincipalExams = APIResponse[PrincipalExamPage]
APIResponseVicePrincipalResults = APIResponse[PrincipalResultsOverview]
APIResponseVicePrincipalStaff = APIResponse[PrincipalStaffPage]
APIResponseVicePrincipalStaffDetail = APIResponse[PrincipalStaffDetail]
APIResponseVicePrincipalNotices = APIResponse[VicePrincipalNoticePage]
APIResponseVicePrincipalNotice = APIResponse[VicePrincipalNoticeDetail]
APIResponseVicePrincipalNoticeTargets = APIResponse[PrincipalNoticeTargets]
