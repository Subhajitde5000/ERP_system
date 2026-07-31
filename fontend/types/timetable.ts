/**
 * Timetable contracts — role_based_shared_pages.md PAGE 10 (C-RB-10).
 * Mirrors `timetable_slots` and `timetable_substitutions` in
 * database_design_complete.md §7.8.
 */

/** `slot_type` enum (DB §7.8). */
export type SlotType = "CLASS" | "BREAK" | "LAB" | "ACTIVITY";

/** 1 = Monday … 6 = Saturday (DB §7.8 `day_of_week`). */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6;

/** PAGE 10: build vs. view, and class schedule vs. personal schedule. */
export type TimetableViewKind =
  | "BUILDER" // Academic Coordinator — full grid, create/bulk/conflicts/subs
  | "PERSONAL" // Teacher — own weekly teaching schedule
  | "DEPARTMENT" // HOD — dept timetable, all classes
  | "INSTITUTION" // Principal / VP — all timetables
  | "CLASS" // Student — own class weekly timetable
  | "CHILD" // Parent — child's class timetable
  | "NONE";

export interface TimetablePermissions {
  view: TimetableViewKind;
  /** Create / edit / delete slots */
  canEdit: boolean;
  /** Bulk upload a term's grid */
  canBulkUpload: boolean;
  /** Arrange a one-off substitution */
  canSubstitute: boolean;
  canExport: boolean;
  /** Whether the class picker is shown (multi-class views) */
  canSwitchClass: boolean;
  note: string;
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  /** null for BREAK slots */
  subjectCode: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  classId: string;
  className: string;
  roomNo: string | null;
  slotType: SlotType;
  /** Active substitution for the current week, if any (DB §7.8) */
  substitution?: {
    substituteTeacherName: string;
    originalTeacherName: string;
    date: string;
    reason: string | null;
  };
}

/** A period row in the grid — periods are shared across all classes. */
export interface PeriodRow {
  periodNumber: number;
  startTime: string;
  endTime: string;
  /** Break periods render as a full-width band */
  isBreak: boolean;
}

/** A clash the coordinator must resolve (dashboard §5.6 surfaces the count). */
export interface TimetableConflict {
  id: string;
  kind: "TEACHER_DOUBLE_BOOKED" | "ROOM_DOUBLE_BOOKED";
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  /** Teacher name or room number, depending on `kind` */
  resource: string;
  /** The classes competing for that resource */
  classNames: string[];
}

export interface ClassOption {
  id: string;
  name: string;
  departmentName: string;
}
