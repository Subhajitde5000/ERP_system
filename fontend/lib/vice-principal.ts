/**
 * Delegated Vice Principal API client.
 *
 * It reuses the Principal's read-model types but always calls the separate
 * server surface, where the active department delegation is resolved before
 * data is queried. No scope is trusted from the browser.
 */

import { APIError } from "./api-client";
import {
  downloadLeadershipReport,
  leadershipCall,
  queryString,
  type PrincipalAttendanceOverview,
  type PrincipalDashboard,
  type PrincipalExamRow,
  type PrincipalNoticeDetail,
  type PrincipalNoticeRow,
  type PrincipalNoticeTargets,
  type PrincipalPage,
  type PrincipalResultsOverview,
  type PrincipalStaffDetail,
  type PrincipalStaffRow,
  type PrincipalTargetOption,
} from "./principal";

const API_PREFIX = "vice-principal";
const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  leadershipCall<T>(API_PREFIX, path, init, "VicePrincipalAPIError");

export { APIError as VicePrincipalAPIError };

export interface VicePrincipalDashboard extends PrincipalDashboard {
  delegated_departments: PrincipalTargetOption[];
}

/** Read receipts are intentionally absent from the Vice Principal payload. */
export type VicePrincipalNoticeRow = Omit<PrincipalNoticeRow, "read_count">;
export type VicePrincipalNoticeDetail = Omit<PrincipalNoticeDetail, "read_count" | "readers">;

export const fetchVicePrincipalDashboard = () => call<VicePrincipalDashboard>("/dashboard");

export const fetchVicePrincipalAttendance = (filters: { fromDate?: string; toDate?: string } = {}) =>
  call<PrincipalAttendanceOverview>(
    `/attendance${queryString({ from_date: filters.fromDate, to_date: filters.toDate })}`,
  );

export const fetchVicePrincipalExaminations = (
  filters: {
    status?: string;
    approvalStatus?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  } = {},
) =>
  call<PrincipalPage<PrincipalExamRow>>(
    `/examinations${queryString({
      status: filters.status,
      approval_status: filters.approvalStatus,
      from_date: filters.fromDate,
      to_date: filters.toDate,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchVicePrincipalResults = () => call<PrincipalResultsOverview>("/results");

export const fetchVicePrincipalStaff = (
  filters: { query?: string; departmentId?: string; limit?: number; offset?: number } = {},
) =>
  call<PrincipalPage<PrincipalStaffRow>>(
    `/staff${queryString({
      query: filters.query,
      department_id: filters.departmentId,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchVicePrincipalStaffDetail = (id: string) =>
  call<PrincipalStaffDetail>(`/staff/${id}`);

export const fetchVicePrincipalNotices = (
  filters: {
    query?: string;
    scope?: "INSTITUTION" | "DEPARTMENT" | "CLASS";
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) =>
  call<PrincipalPage<VicePrincipalNoticeRow>>(
    `/notices${queryString({
      query: filters.query,
      scope: filters.scope,
      include_expired: filters.includeExpired,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchVicePrincipalNotice = (id: string) =>
  call<VicePrincipalNoticeDetail>(`/notices/${id}`);
export const fetchVicePrincipalNoticeTargets = () => call<PrincipalNoticeTargets>("/notices/targets");

export const createVicePrincipalNotice = (payload: {
  title: string;
  body: string;
  // The composer exposes only DEPARTMENT/CLASS; the server also rejects an
  // institution-wide value if a caller tries to forge one.
  target_scope: "INSTITUTION" | "DEPARTMENT" | "CLASS";
  target_id?: string | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  is_pinned: boolean;
  expires_at?: string | null;
}) =>
  call<VicePrincipalNoticeDetail>("/notices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const downloadVicePrincipalReport = (
  kind: "attendance" | "results" | "examinations",
  filters: { fromDate?: string; toDate?: string } = {},
) => downloadLeadershipReport(API_PREFIX, kind, filters);
