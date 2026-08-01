import {
  AlertTriangle,
  BadgeIndianRupee,
  BedDouble,
  BookOpen,
  BookPlus,
  Boxes,
  Bus,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Contact,
  DoorOpen,
  FileBadge,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Flag,
  GraduationCap,
  Handshake,
  IndianRupee,
  Layers,
  LibraryBig,
  MapPinned,
  Megaphone,
  MessagesSquare,
  MonitorPlay,
  Package,
  PackageMinus,
  PackagePlus,
  Puzzle,
  Receipt,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  ShoppingCart,
  Ticket,
  TrendingUp,
  Truck,
  UploadCloud,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import type { InstitutionRole } from "@/types/auth";
import type { DashboardConfig } from "@/types/dashboard";

/**
 * Every role dashboard from Institution_dashboard_design.md §5, expressed as
 * data. The shared renderer in `components/dashboard/` draws them, so adding a
 * role means adding one entry here — no new page, no duplicated layout.
 *
 * TODO(Dev-A/Dev-B): replace with GET /api/v1/dashboard/stats?role=… (§8).
 * The response shape maps 1:1 onto DashboardConfig.
 */

const DASHBOARDS: Record<InstitutionRole, DashboardConfig> = {
  /* ── 5.1 Institution Admin ─────────────────────────────────────────────── */
  INSTITUTION_ADMIN: {
    roleChip: "Institution Admin",
    summary: "Setup is 80% complete · 3 support tickets open",
    stats: [
      {
        label: "Total Users",
        value: "1,540",
        icon: Users,
        tone: "accent",
        delta: { text: "1,200 students · 340 staff", tone: "muted" },
      },
      {
        label: "Active Modules",
        value: "11/15",
        icon: Puzzle,
        tone: "cyan",
        delta: { text: "7 core · 4 optional", tone: "muted" },
        href: "/settings/modules",
      },
      {
        label: "Support Tickets",
        value: "3",
        icon: Ticket,
        tone: "warning",
        delta: { text: "2 awaiting your reply", tone: "warning" },
      },
      {
        label: "Fee Collection",
        value: "₹42L / ₹58L",
        icon: IndianRupee,
        tone: "accent",
        progress: { value: 42, max: 58 },
      },
    ],
    panels: [
      {
        kind: "checklist",
        title: "Setup Checklist",
        span: 7,
        items: [
          { label: "Departments", progress: 100 },
          { label: "Classes", progress: 100 },
          { label: "Subjects", progress: 100 },
          { label: "Users", progress: 80 },
          { label: "Academic Year", progress: 100 },
        ],
        cta: { label: "Continue Setup", icon: UserPlus, href: "/users" },
      },
      {
        kind: "list",
        title: "Recent Audit Logs",
        span: 5,
        link: { label: "View all", href: "/audit-logs" },
        items: [
          { title: "Priya added 30 students", subtitle: "2 minutes ago" },
          { title: "Module Hostel enabled", subtitle: "1 hour ago", tone: "success" },
          { title: "Rahul updated fee structure", subtitle: "3 hours ago" },
          { title: "Academic year 2024-25 locked", subtitle: "Yesterday" },
        ],
      },
      {
        kind: "bars",
        title: "Module Usage",
        span: 7,
        unit: "%",
        items: [
          { label: "Attendance", value: 96, tone: "success" },
          { label: "Examination", value: 88, tone: "success" },
          { label: "Assignments", value: 74, tone: "accent" },
          { label: "Library", value: 41, tone: "warning" },
          { label: "Hostel", value: 22, tone: "danger" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 5,
        items: [
          { label: "Invite User", icon: UserPlus, href: "/users", primary: true },
          { label: "Create Department", icon: Layers, href: "/settings" },
          { label: "Toggle Modules", icon: Puzzle, href: "/settings/modules" },
          { label: "View Audit Logs", icon: ScrollText, href: "/audit-logs" },
        ],
      },
    ],
  },

  /* ── 5.2 Principal ─────────────────────────────────────────────────────── */
  PRINCIPAL: {
    roleChip: "Principal",
    summary: "2 results awaiting your approval",
    stats: [
      {
        label: "Avg Attendance",
        value: "84%",
        icon: ClipboardCheck,
        tone: "success",
        delta: { text: "↑ 3% vs last month", tone: "success" },
      },
      {
        label: "Exams",
        value: "3 ongoing",
        icon: FileSpreadsheet,
        tone: "accent",
        delta: { text: "12 upcoming", tone: "muted" },
      },
      {
        label: "Results Awaiting",
        value: "2",
        icon: FileCheck2,
        tone: "warning",
        pulse: true,
      },
      { label: "Total Staff", value: "85", icon: Users, tone: "cyan" },
    ],
    panels: [
      {
        kind: "grid",
        title: "Attendance by Department",
        span: 7,
        items: [
          { label: "CSE", value: 88, tone: "success" },
          { label: "ECE", value: 81, tone: "warning" },
          { label: "Mechanical", value: 72, tone: "danger" },
          { label: "Civil", value: 86, tone: "success" },
          { label: "Commerce", value: 90, tone: "success" },
          { label: "Arts", value: 78, tone: "warning" },
        ],
      },
      {
        kind: "timeline",
        title: "Upcoming Exams",
        span: 5,
        items: [
          { time: "Mon 4", title: "Mid-term · CSE", subtitle: "Sem 3 · 180 students", current: true },
          { time: "Wed 6", title: "Mid-term · ECE", subtitle: "Sem 3 · 140 students" },
          { time: "Fri 8", title: "Practical · Mech", subtitle: "Sem 5 · 90 students" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Post Institution Notice", icon: Megaphone, href: "/notices/new", primary: true },
          { label: "Approve Results", icon: FileCheck2, href: "/results" },
          { label: "View Reports", icon: TrendingUp, href: "/reports" },
          // C-PR-05, not the merged `/users` — the Principal's own directory
          { label: "Staff Directory", icon: Contact, href: "/principal/staff" },
        ],
      },
    ],
  },

  /* ── 5.3 Vice Principal — delegated, read-only ─────────────────────────── */
  VICE_PRINCIPAL: {
    roleChip: "Vice Principal",
    summary: "Read-only view of your delegated departments",
    scope: "Delegated: CSE, ECE",
    stats: [
      {
        label: "Avg Attendance",
        value: "85%",
        icon: ClipboardCheck,
        tone: "success",
        delta: { text: "CSE 88% · ECE 81%", tone: "muted" },
      },
      {
        label: "Exams",
        value: "2 ongoing",
        icon: FileSpreadsheet,
        tone: "accent",
        delta: { text: "6 upcoming", tone: "muted" },
      },
      { label: "Teachers", value: "28", icon: Users, tone: "cyan" },
      { label: "Students", value: "320", icon: GraduationCap, tone: "accent" },
    ],
    panels: [
      {
        kind: "grid",
        title: "Attendance — Delegated Departments",
        span: 7,
        items: [
          { label: "CSE", value: 88, tone: "success" },
          { label: "ECE", value: 81, tone: "warning" },
        ],
      },
      {
        kind: "timeline",
        title: "Upcoming Exams",
        span: 5,
        items: [
          { time: "Mon 4", title: "Mid-term · CSE", subtitle: "Sem 3", current: true },
          { time: "Wed 6", title: "Mid-term · ECE", subtitle: "Sem 3" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Post Notice", icon: Megaphone, href: "/notices/new", primary: true },
          { label: "View Reports", icon: TrendingUp, href: "/reports" },
          // C-VP-07 — the VP's own staff directory
          { label: "Staff Directory", icon: Contact, href: "/vp/staff" },
        ],
      },
    ],
  },

  /* ── 5.4 HOD ───────────────────────────────────────────────────────────── */
  HOD: {
    roleChip: "HOD",
    summary: "18 assignments pending review in your department",
    scope: "Department: CSE",
    stats: [
      { label: "My Dept Students", value: "180", icon: GraduationCap, tone: "accent" },
      {
        label: "Dept Attendance",
        value: "81%",
        icon: ClipboardCheck,
        tone: "warning",
        delta: { text: "↓ 2% vs last month", tone: "danger" },
      },
      { label: "Teachers in Dept", value: "12", icon: Users, tone: "cyan" },
      {
        label: "Pending Review",
        value: "18",
        icon: FileText,
        tone: "danger",
        pulse: true,
      },
    ],
    panels: [
      {
        kind: "bars",
        title: "Class-wise Attendance",
        span: 7,
        items: [
          { label: "CSE Sem 1", value: 89, tone: "success" },
          { label: "CSE Sem 3", value: 84, tone: "success" },
          { label: "CSE Sem 5", value: 76, tone: "warning" },
          { label: "CSE Sem 7", value: 71, tone: "danger" },
        ],
      },
      {
        kind: "table",
        title: "Pending Assignments",
        span: 5,
        action: "Review",
        columns: [
          { key: "teacher", label: "Teacher" },
          { key: "subject", label: "Subject" },
          { key: "count", label: "Count", numeric: true },
        ],
        rows: [
          { teacher: "Priya S.", subject: "CS301", count: "8" },
          { teacher: "Arun K.", subject: "CS305", count: "6" },
          { teacher: "Neha R.", subject: "CS307", count: "4" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Post Dept Notice", icon: Megaphone, href: "/notices/new", primary: true },
          { label: "Assign Mentor", icon: UserCheck, href: "/users" },
          { label: "View Timetable", icon: CalendarDays, href: "/timetable" },
          { label: "Moderate Discussion", icon: ShieldAlert, href: "/discussion" },
        ],
      },
    ],
  },

  /* ── 5.5 Teacher — most-used role ──────────────────────────────────────── */
  TEACHER: {
    roleChip: "Teacher",
    summary: "Today's classes: 4 · Pending reviews: 12",
    stats: [
      {
        label: "Today's Classes",
        value: "4",
        icon: CalendarDays,
        tone: "accent",
        delta: { text: "Next: CS301 · 10:00 AM · Room 201", tone: "muted" },
      },
      {
        label: "Attendance To Mark",
        value: "2",
        icon: ClipboardCheck,
        tone: "danger",
        pulse: true,
      },
      { label: "Submissions to Review", value: "12", icon: FileText, tone: "warning" },
      {
        label: "Exams Created",
        value: "1",
        icon: FileSpreadsheet,
        tone: "cyan",
        delta: { text: "Draft", tone: "muted" },
      },
    ],
    panels: [
      {
        kind: "timeline",
        title: "My Today's Schedule",
        span: 7,
        empty: "No classes today — enjoy the breather.",
        items: [
          {
            time: "09:00 AM",
            title: "CS201 · Data Structures",
            subtitle: "Sem 2 · Room 105",
            tone: "success",
            done: "Marked",
          },
          {
            time: "10:00 AM",
            title: "CS301 · Algorithms",
            subtitle: "Sem 3 · Room 201",
            current: true,
            action: { label: "Mark Attendance", href: "/attendance" },
          },
          {
            time: "12:30 PM",
            title: "CS305 · Databases",
            subtitle: "Sem 3 · Lab 2",
            action: { label: "Mark Attendance", href: "/attendance" },
          },
          {
            time: "02:30 PM",
            title: "CS307 · Operating Systems",
            subtitle: "Sem 3 · Room 204",
          },
        ],
      },
      {
        kind: "list",
        title: "Pending Submissions",
        span: 5,
        link: { label: "View all", href: "/assignments" },
        empty: "No pending submissions — you're all caught up! 🎉",
        items: [
          {
            title: "Binary Trees — Worksheet 3",
            subtitle: "CS301 · Sem 3",
            meta: "8",
            tone: "warning",
            action: { label: "Review", href: "/assignments/as1" },
          },
          {
            title: "ER Diagram Lab",
            subtitle: "CS305 · Sem 3",
            meta: "3",
            tone: "muted",
            action: { label: "Review", href: "/assignments/as2" },
          },
          {
            title: "Process Scheduling",
            subtitle: "CS307 · Sem 3",
            meta: "1",
            tone: "muted",
            action: { label: "Review", href: "/assignments/as3" },
          },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Mark Attendance", icon: ClipboardCheck, href: "/attendance", primary: true },
          { label: "Create Exam", icon: FileSpreadsheet, href: "/examination" },
          { label: "Create Assignment", icon: FilePlus2, href: "/assignments" },
          { label: "Upload Content", icon: UploadCloud, href: "/content" },
        ],
      },
    ],
  },

  /* ── 5.6 Academic Coordinator ──────────────────────────────────────────── */
  ACADEMIC_COORDINATOR: {
    roleChip: "Academic Coordinator",
    summary: "2 timetable conflicts need fixing",
    stats: [
      {
        label: "Timetable Conflicts",
        value: "2",
        icon: AlertTriangle,
        tone: "danger",
        pulse: true,
      },
      { label: "Substitutions Today", value: "3", icon: RefreshCw, tone: "accent" },
      { label: "Pending Notices", value: "0", icon: Megaphone, tone: "success" },
      { label: "Classes Scheduled", value: "128", icon: CalendarDays, tone: "cyan" },
    ],
    panels: [
      {
        kind: "table",
        title: "Timetable Conflicts",
        span: 7,
        action: "Fix",
        link: { label: "Conflict centre", href: "/timetable" },
        empty: "No conflicts — the timetable is clean.",
        columns: [
          { key: "slot", label: "Slot" },
          { key: "clash", label: "Clash" },
          { key: "room", label: "Room" },
        ],
        rows: [
          { slot: "Mon 10:00", clash: "Priya S. · CS301 + CS410", room: "201" },
          { slot: "Thu 02:30", clash: "Lab 2 double-booked", room: "Lab 2" },
        ],
      },
      {
        kind: "list",
        title: "Today's Substitutions",
        span: 5,
        items: [
          { title: "CS201 → Arun K.", subtitle: "09:00 AM · Room 105", tone: "success", meta: "Confirmed" },
          { title: "EC202 → Meena T.", subtitle: "11:00 AM · Room 302", tone: "warning", meta: "Pending" },
          { title: "ME105 → Rajesh V.", subtitle: "02:30 PM · Workshop", tone: "success", meta: "Confirmed" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Timetable Builder", icon: CalendarDays, href: "/timetable", primary: true },
          { label: "Add Substitution", icon: RefreshCw, href: "/timetable" },
          { label: "Post Academic Notice", icon: Megaphone, href: "/notices/new" },
        ],
      },
    ],
  },

  /* ── 5.7 Exam Controller ───────────────────────────────────────────────── */
  EXAM_CONTROLLER: {
    roleChip: "Exam Controller",
    summary: "1 exam ongoing · 1 malpractice flag raised",
    stats: [
      {
        label: "Exams",
        value: "5 published",
        icon: FileSpreadsheet,
        tone: "accent",
        delta: { text: "2 draft · 18 completed", tone: "muted" },
      },
      {
        label: "Ongoing Now",
        value: "1",
        icon: MonitorPlay,
        tone: "success",
        pulse: true,
      },
      { label: "Malpractice Flags", value: "1", icon: Flag, tone: "danger" },
      { label: "Halls Allocated", value: "12", icon: DoorOpen, tone: "cyan" },
    ],
    panels: [
      {
        kind: "table",
        title: "Active Exams Monitor",
        span: 7,
        action: "Monitor",
        empty: "No exams in progress.",
        columns: [
          { key: "exam", label: "Exam" },
          { key: "attempts", label: "Attempts", numeric: true },
          { key: "flags", label: "Flags", numeric: true },
        ],
        rows: [
          { exam: "CS301 Mid-term", attempts: "178", flags: "1" },
          { exam: "EC202 Unit Test", attempts: "0", flags: "0" },
        ],
      },
      {
        kind: "list",
        title: "Result Pipeline",
        span: 5,
        items: [
          { title: "CS301 Mid-term", subtitle: "Awaiting compilation", meta: "Step 1/3", tone: "warning" },
          { title: "EC101 Unit Test", subtitle: "Compiled · ready to publish", meta: "Step 2/3", tone: "accent" },
          { title: "ME204 Practical", subtitle: "Published", meta: "Done", tone: "success" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Create Schedule", icon: CalendarPlus, href: "/examination", primary: true },
          { label: "Allocate Halls", icon: DoorOpen, href: "/examination" },
          { label: "Compile Results", icon: Layers, href: "/results" },
          { label: "Publish Results", icon: FileCheck2, href: "/results" },
        ],
      },
    ],
  },

  /* ── 5.8 Accountant ────────────────────────────────────────────────────── */
  ACCOUNTANT: {
    roleChip: "Accountant",
    module: "finance",
    summary: "₹1.2L collected today · 42 overdue installments",
    stats: [
      {
        label: "Today's Collection",
        value: "₹1.2L",
        icon: IndianRupee,
        tone: "success",
        delta: { text: "↑ 18% vs yesterday", tone: "success" },
      },
      { label: "Total Dues", value: "₹18.5L", icon: Wallet, tone: "warning" },
      { label: "Overdue Installments", value: "42", icon: AlertTriangle, tone: "danger" },
      { label: "Receipts Today", value: "28", icon: Receipt, tone: "cyan" },
    ],
    panels: [
      {
        kind: "table",
        title: "Top Fee Defaulters",
        span: 7,
        action: "Record payment",
        link: { label: "Full list", href: "/fees" },
        columns: [
          { key: "student", label: "Student" },
          { key: "class", label: "Class" },
          { key: "due", label: "Due", numeric: true },
        ],
        rows: [
          { student: "Aryan Mehta", class: "FY-BSc-A", due: "₹48,000" },
          { student: "Kiran Patel", class: "SY-BCom-B", due: "₹42,500" },
          { student: "Sneha Rao", class: "TY-BA-A", due: "₹38,000" },
          { student: "Imran Shaikh", class: "FY-BSc-C", due: "₹31,200" },
          { student: "Divya Nair", class: "SY-BSc-A", due: "₹27,800" },
        ],
      },
      {
        kind: "trend",
        title: "Daily Collection · Last 7 Days",
        span: 5,
        points: [82, 95, 74, 118, 102, 134, 120],
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        unit: "₹K",
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Record Payment", icon: Coins, href: "/fees", primary: true },
          { label: "Defaulter List", icon: ClipboardList, href: "/fees" },
          { label: "Fee Structure", icon: BadgeIndianRupee, href: "/fees" },
          { label: "Scholarship Grant", icon: FileBadge, href: "/fees" },
        ],
      },
    ],
  },

  /* ── 5.9 Student ───────────────────────────────────────────────────────── */
  STUDENT: {
    roleChip: "Student",
    scope: "FY-BSc-A",
    summary: "3 assignments pending · next exam in 2 days",
    notice: {
      tone: "danger",
      title: "Your attendance in CS301 is 68% — below the 75% required.",
      action: { label: "View details", href: "/attendance" },
    },
    stats: [
      {
        label: "Attendance",
        value: "Overall",
        icon: ClipboardCheck,
        tone: "warning",
        ring: { value: 82, max: 100 },
      },
      { label: "Pending Assignments", value: "3", icon: FileText, tone: "danger", pulse: true },
      {
        label: "Upcoming Exams",
        value: "2",
        icon: FileSpreadsheet,
        tone: "accent",
        delta: { text: "Next in 2 days", tone: "muted" },
      },
      {
        label: "Fee Due",
        value: "₹5,000",
        icon: IndianRupee,
        tone: "warning",
        delta: { text: "Due 15 Aug", tone: "warning" },
      },
    ],
    panels: [
      {
        kind: "timeline",
        title: "Today's Classes",
        span: 7,
        empty: "No classes today.",
        items: [
          { time: "09:00 AM", title: "Data Structures", subtitle: "Room 105 · Priya S.", tone: "success" },
          { time: "10:00 AM", title: "Algorithms", subtitle: "Room 201 · Priya S.", current: true },
          { time: "12:30 PM", title: "Databases Lab", subtitle: "Lab 2 · Arun K." },
          { time: "02:30 PM", title: "Operating Systems", subtitle: "Room 204 · Neha R." },
        ],
      },
      {
        kind: "list",
        title: "Recent Notices",
        span: 5,
        link: { label: "View all", href: "/notices" },
        items: [
          { title: "Mid-term timetable released", subtitle: "Exam Cell · 2h ago", pinned: true },
          { title: "Library closed on Saturday", subtitle: "Library · 1d ago" },
          { title: "Sports day registrations open", subtitle: "Sports · 2d ago" },
        ],
      },
      {
        kind: "list",
        title: "Assignments Due Soon",
        span: 7,
        link: { label: "View all", href: "/assignments" },
        empty: "Nothing due — you're all caught up! 🎉",
        items: [
          {
            title: "Binary Trees — Worksheet 3",
            subtitle: "CS301 · Priya S.",
            meta: "Due tomorrow",
            tone: "danger",
            action: { label: "Open", href: "/assignments/as1" },
          },
          {
            title: "ER Diagram Lab",
            subtitle: "CS305 · Arun K.",
            meta: "Due in 3 days",
            tone: "warning",
            action: { label: "Open", href: "/assignments/as2" },
          },
          {
            title: "Process Scheduling Report",
            subtitle: "CS307 · Neha R.",
            meta: "Due in 6 days",
            tone: "muted",
            action: { label: "Open", href: "/assignments/as3" },
          },
        ],
      },
      {
        kind: "list",
        title: "Recently Uploaded Content",
        span: 5,
        link: { label: "Browse", href: "/content" },
        items: [
          { title: "AVL Tree Rotations (PDF)", subtitle: "CS301 · 1h ago" },
          { title: "Normalization Notes", subtitle: "CS305 · Yesterday" },
          { title: "Deadlock Handling Slides", subtitle: "CS307 · 2d ago" },
        ],
      },
    ],
  },

  /* ── 5.10 Parent ───────────────────────────────────────────────────────── */
  PARENT: {
    roleChip: "Parent",
    scope: "Viewing: Ananya (Class 8-B)",
    summary: "All fees paid · next exam in 3 days",
    stats: [
      {
        label: "Child Attendance",
        value: "Overall",
        icon: ClipboardCheck,
        tone: "success",
        ring: { value: 88, max: 100 },
      },
      {
        label: "Fee Due",
        value: "₹0",
        icon: IndianRupee,
        tone: "success",
        delta: { text: "Paid ✓", tone: "success" },
      },
      {
        label: "Upcoming Exam",
        value: "Maths",
        icon: FileSpreadsheet,
        tone: "accent",
        delta: { text: "Mid-term in 3 days", tone: "muted" },
      },
      {
        label: "Latest Result",
        value: "87%",
        icon: GraduationCap,
        tone: "success",
        delta: { text: "Grade A", tone: "success" },
      },
    ],
    panels: [
      {
        kind: "timeline",
        title: "Ananya's Weekly Timetable",
        span: 7,
        items: [
          { time: "Mon", title: "Maths · English · Science", subtitle: "8:30 AM – 2:30 PM" },
          { time: "Tue", title: "Science · Maths · Hindi", subtitle: "8:30 AM – 2:30 PM", current: true },
          { time: "Wed", title: "English · Social · PT", subtitle: "8:30 AM – 2:30 PM" },
          { time: "Thu", title: "Maths · Science · Art", subtitle: "8:30 AM – 2:30 PM" },
          { time: "Fri", title: "Hindi · Social · Maths", subtitle: "8:30 AM – 2:30 PM" },
        ],
      },
      {
        kind: "list",
        title: "Notice Feed",
        span: 5,
        link: { label: "View all", href: "/notices" },
        items: [
          { title: "PTM on Saturday, 10 AM", subtitle: "Class teacher · 3h ago", pinned: true },
          { title: "Annual day rehearsals begin", subtitle: "Cultural · 1d ago" },
          { title: "Fee receipt for Q2 available", subtitle: "Accounts · 4d ago" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Attendance Calendar", icon: CalendarDays, href: "/attendance", primary: true },
          { label: "View Results", icon: GraduationCap, href: "/results" },
          { label: "Download Grade Card", icon: FileBadge, href: "/results" },
          { label: "Fee Receipts", icon: Receipt, href: "/fees" },
        ],
      },
    ],
  },

  /* ── 5.11 Librarian — optional module ──────────────────────────────────── */
  LIBRARIAN: {
    roleChip: "Librarian",
    module: "library",
    summary: "12 books overdue · 18 issued today",
    stats: [
      { label: "Total Books", value: "5,200", icon: LibraryBig, tone: "accent" },
      { label: "Issued Today", value: "18", icon: BookOpen, tone: "cyan" },
      { label: "Overdue", value: "12", icon: AlertTriangle, tone: "danger", pulse: true },
      { label: "Available Copies", value: "3,420", icon: BookPlus, tone: "success" },
    ],
    panels: [
      {
        kind: "table",
        title: "Overdue Books",
        span: 7,
        action: "Send reminder",
        link: { label: "Full list", href: "/library/dashboard" },
        columns: [
          { key: "student", label: "Student" },
          { key: "book", label: "Book" },
          { key: "days", label: "Days", numeric: true },
        ],
        rows: [
          { student: "Aryan Mehta", book: "Intro to Algorithms", days: "12" },
          { student: "Sneha Rao", book: "Clean Code", days: "8" },
          { student: "Imran Shaikh", book: "Operating Systems", days: "5" },
          { student: "Divya Nair", book: "Database Systems", days: "3" },
        ],
      },
      {
        kind: "list",
        title: "Recent Activity",
        span: 5,
        items: [
          { title: "Issued · Clean Architecture", subtitle: "ROLL142 · 10 min ago", tone: "accent", meta: "Out" },
          { title: "Returned · Deep Learning", subtitle: "ROLL088 · 1h ago", tone: "success", meta: "In" },
          { title: "Added · 12 new titles", subtitle: "Acquisitions · 2h ago", tone: "muted", meta: "New" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Issue Book", icon: BookOpen, href: "/library/dashboard", primary: true },
          { label: "Return Book", icon: RefreshCw, href: "/library/dashboard" },
          { label: "Add Book", icon: BookPlus, href: "/library/dashboard" },
          { label: "E-Resources", icon: MonitorPlay, href: "/library/dashboard" },
        ],
      },
    ],
  },

  /* ── 5.12 Hostel Warden ────────────────────────────────────────────────── */
  HOSTEL_WARDEN: {
    roleChip: "Hostel Warden",
    module: "hostel",
    summary: "5 absentees last night · 3 leave requests pending",
    stats: [
      {
        label: "Occupancy",
        value: "170/200",
        icon: BedDouble,
        tone: "accent",
        progress: { value: 170, max: 200 },
      },
      { label: "Today's Absentees", value: "5", icon: AlertTriangle, tone: "danger", pulse: true },
      { label: "Pending Leaves", value: "3", icon: CalendarClock, tone: "warning" },
      { label: "Open Complaints", value: "2", icon: ShieldAlert, tone: "warning" },
    ],
    panels: [
      {
        kind: "bars",
        title: "Block Occupancy",
        span: 7,
        items: [
          { label: "Block A · Boys", value: 92, tone: "warning" },
          { label: "Block B · Boys", value: 78, tone: "success" },
          { label: "Block C · Girls", value: 88, tone: "success" },
          { label: "Block D · Girls", value: 64, tone: "accent" },
        ],
      },
      {
        kind: "list",
        title: "Pending Leave Requests",
        span: 5,
        empty: "No pending requests.",
        items: [
          {
            title: "Aryan Mehta · Room A-104",
            subtitle: "2–4 Aug · Family function",
            action: { label: "Review", href: "/leaves" },
          },
          {
            title: "Kiran Patel · Room B-201",
            subtitle: "3 Aug · Medical",
            action: { label: "Review", href: "/leaves" },
          },
          {
            title: "Sneha Rao · Room C-012",
            subtitle: "5–7 Aug · Home visit",
            action: { label: "Review", href: "/leaves" },
          },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Mark Night Attendance", icon: ClipboardCheck, href: "/hostel/dashboard", primary: true },
          { label: "Allot Room", icon: BedDouble, href: "/hostel/dashboard" },
          { label: "Approve Leave", icon: CalendarClock, href: "/leaves" },
          { label: "Resolve Complaint", icon: ShieldAlert, href: "/hostel/dashboard" },
        ],
      },
    ],
  },

  /* ── 5.13 Transport Manager ────────────────────────────────────────────── */
  TRANSPORT_MANAGER: {
    roleChip: "Transport Manager",
    module: "transport",
    summary: "12 routes running · all drivers on duty",
    stats: [
      { label: "Active Routes", value: "12", icon: MapPinned, tone: "accent" },
      { label: "Students Assigned", value: "320", icon: Users, tone: "cyan" },
      { label: "Vehicles", value: "15", icon: Bus, tone: "accent" },
      {
        label: "Drivers On Duty",
        value: "12",
        icon: UserCheck,
        tone: "success",
        delta: { text: "3 off duty", tone: "muted" },
      },
    ],
    panels: [
      {
        kind: "bars",
        title: "Route Utilisation",
        span: 7,
        items: [
          { label: "R1 · Station – Campus", value: 94, tone: "warning" },
          { label: "R2 · Airport Road", value: 81, tone: "success" },
          { label: "R3 · Old Town", value: 67, tone: "accent" },
          { label: "R4 · Lakeside", value: 52, tone: "accent" },
          { label: "R5 · Industrial Area", value: 38, tone: "muted" },
        ],
      },
      {
        kind: "list",
        title: "Fleet Status",
        span: 5,
        items: [
          { title: "KA-01-4521", subtitle: "R1 · On route", meta: "Active", tone: "success" },
          { title: "KA-01-8890", subtitle: "R2 · On route", meta: "Active", tone: "success" },
          { title: "KA-01-3312", subtitle: "Servicing · due 5 Aug", meta: "Garage", tone: "warning" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Route Management", icon: MapPinned, href: "/transport/dashboard", primary: true },
          { label: "Assign Student", icon: UserPlus, href: "/transport/dashboard" },
          { label: "Fleet Management", icon: Truck, href: "/transport/dashboard" },
        ],
      },
    ],
  },

  /* ── 5.14 Placement Officer ────────────────────────────────────────────── */
  PLACEMENT_OFFICER: {
    roleChip: "Placement Officer",
    module: "placement",
    summary: "3 drives active · 8 offers issued this week",
    stats: [
      { label: "Active Drives", value: "3", icon: Handshake, tone: "accent" },
      { label: "Applications Today", value: "42", icon: FileText, tone: "cyan" },
      { label: "Offers Issued", value: "8", icon: FileBadge, tone: "success" },
      {
        label: "Placed",
        value: "68%",
        icon: TrendingUp,
        tone: "success",
        delta: { text: "↑ 6% vs last year", tone: "success" },
      },
    ],
    panels: [
      {
        kind: "kanban",
        title: "Drive Pipeline",
        span: 12,
        columns: [
          { label: "Applied", items: ["Infosys · 120", "TCS · 98", "Wipro · 64"] },
          { label: "Shortlisted", items: ["Infosys · 48", "TCS · 32"] },
          { label: "Interview", items: ["Infosys · 22", "TCS · 14"] },
          { label: "Offer", items: ["Infosys · 6", "TCS · 2"] },
        ],
      },
      {
        kind: "bars",
        title: "Department-wise Placement",
        span: 7,
        items: [
          { label: "CSE", value: 84, tone: "success" },
          { label: "ECE", value: 71, tone: "success" },
          { label: "Mechanical", value: 58, tone: "warning" },
          { label: "Civil", value: 46, tone: "warning" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 5,
        items: [
          { label: "Create Drive", icon: Handshake, href: "/placement/dashboard", primary: true },
          { label: "View Applicants", icon: Users, href: "/placement/dashboard" },
          { label: "Schedule Interview", icon: CalendarPlus, href: "/placement/dashboard" },
        ],
      },
    ],
  },

  /* ── 5.15 HR Manager ───────────────────────────────────────────────────── */
  HR_MANAGER: {
    roleChip: "HR Manager",
    module: "hr",
    summary: "Payroll due in 3 days · 10 appraisals pending",
    stats: [
      { label: "Total Staff", value: "100", icon: Users, tone: "accent" },
      { label: "On Leave Today", value: "6", icon: CalendarClock, tone: "warning" },
      {
        label: "Payroll",
        value: "Due in 3 days",
        icon: Wallet,
        tone: "danger",
        pulse: true,
      },
      { label: "Pending Appraisals", value: "10", icon: FileCheck2, tone: "warning" },
    ],
    panels: [
      {
        kind: "list",
        title: "Leave Requests Queue",
        span: 7,
        empty: "No pending leave requests.",
        items: [
          {
            title: "Priya S. · Teacher",
            subtitle: "2–4 Aug · Casual leave",
            action: { label: "Review", href: "/leaves" },
          },
          {
            title: "Arun K. · Lab Assistant",
            subtitle: "5 Aug · Sick leave",
            action: { label: "Review", href: "/leaves" },
          },
          {
            title: "Meena T. · Teacher",
            subtitle: "8–12 Aug · Earned leave",
            action: { label: "Review", href: "/leaves" },
          },
        ],
      },
      {
        kind: "bars",
        title: "Payroll Status",
        span: 5,
        items: [
          { label: "Salaries computed", value: 100, tone: "success" },
          { label: "Deductions verified", value: 72, tone: "warning" },
          { label: "Approvals received", value: 40, tone: "danger" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Run Payroll", icon: Wallet, href: "/hr/dashboard", primary: true },
          { label: "Add Staff", icon: UserPlus, href: "/users" },
          { label: "Leave Policies", icon: ScrollText, href: "/hr/dashboard" },
          { label: "Appraisal Cycle", icon: UserCog, href: "/hr/dashboard" },
        ],
      },
    ],
  },

  /* ── 5.16 Admission Officer ────────────────────────────────────────────── */
  ADMISSION_OFFICER: {
    roleChip: "Admission Officer",
    module: "admission",
    summary: "15 applications today · 2 merit lists published",
    stats: [
      { label: "Applications Today", value: "15", icon: FileText, tone: "accent" },
      { label: "Merit Lists Published", value: "2", icon: FileBadge, tone: "success" },
      { label: "Docs to Verify", value: "34", icon: FileCheck2, tone: "warning" },
      { label: "Seats Remaining", value: "160", icon: GraduationCap, tone: "cyan" },
    ],
    panels: [
      {
        kind: "funnel",
        title: "Admission Funnel",
        span: 7,
        stages: [
          { label: "Submitted", value: 200 },
          { label: "Under Review", value: 120 },
          { label: "Shortlisted", value: 60 },
          { label: "Admitted", value: 40 },
        ],
      },
      {
        kind: "list",
        title: "Recent Applications",
        span: 5,
        link: { label: "View all", href: "/admission/dashboard" },
        items: [
          { title: "Rhea Kapoor", subtitle: "FY-BSc · 92%", meta: "New", tone: "accent" },
          { title: "Kabir Singh", subtitle: "FY-BCom · 88%", meta: "New", tone: "accent" },
          { title: "Anaya Das", subtitle: "FY-BA · 85%", meta: "Review", tone: "warning" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "View Applications", icon: FileText, href: "/admission/dashboard", primary: true },
          { label: "Verify Documents", icon: FileCheck2, href: "/admission/dashboard" },
          { label: "Generate Merit List", icon: FileBadge, href: "/admission/dashboard" },
          { label: "Enroll Student", icon: UserPlus, href: "/admission/dashboard" },
        ],
      },
    ],
  },

  /* ── 5.17 Store Manager ────────────────────────────────────────────────── */
  STORE_MANAGER: {
    roleChip: "Store Manager",
    module: "inventory",
    summary: "12 low-stock alerts · 3 purchase orders pending",
    stats: [
      { label: "Total Items", value: "200", icon: Boxes, tone: "accent" },
      { label: "Low Stock Alerts", value: "12", icon: AlertTriangle, tone: "danger", pulse: true },
      {
        label: "Stock In / Out",
        value: "5 / 8",
        icon: Package,
        tone: "cyan",
        delta: { text: "Today", tone: "muted" },
      },
      { label: "PO Pending", value: "3", icon: ShoppingCart, tone: "warning" },
    ],
    panels: [
      {
        kind: "table",
        title: "Low Stock Items",
        span: 7,
        action: "Reorder",
        columns: [
          { key: "item", label: "Item" },
          { key: "stock", label: "In stock", numeric: true },
          { key: "reorder", label: "Reorder at", numeric: true },
        ],
        rows: [
          { item: "A4 Paper (ream)", stock: "8", reorder: "25" },
          { item: "Whiteboard Marker", stock: "14", reorder: "40" },
          { item: "Lab Gloves (box)", stock: "3", reorder: "15" },
          { item: "Printer Toner", stock: "2", reorder: "6" },
        ],
      },
      {
        kind: "list",
        title: "Recent Transactions",
        span: 5,
        items: [
          { title: "Stock in · A4 Paper ×50", subtitle: "Vendor: PaperCo · 1h ago", meta: "+50", tone: "success" },
          { title: "Stock out · Lab Gloves ×12", subtitle: "Chemistry Lab · 3h ago", meta: "−12", tone: "danger" },
          { title: "Stock out · Markers ×6", subtitle: "Room 201 · Yesterday", meta: "−6", tone: "danger" },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "Stock In", icon: PackagePlus, href: "/inventory/dashboard", primary: true },
          { label: "Stock Out", icon: PackageMinus, href: "/inventory/dashboard" },
          { label: "Create PO", icon: ShoppingCart, href: "/inventory/dashboard" },
          { label: "Vendor Management", icon: Truck, href: "/inventory/dashboard" },
        ],
      },
    ],
  },

  /* ── Mentor — teacher-level role scoped to assigned mentees ────────────── */
  MENTOR: {
    roleChip: "Mentor",
    scope: "12 mentees · CSE Sem 3",
    summary: "2 mentees below 75% attendance · 1 needs follow-up",
    notice: {
      tone: "warning",
      title: "2 mentees have dropped below the 75% attendance requirement.",
      action: { label: "View mentees", href: "/users" },
    },
    stats: [
      { label: "My Mentees", value: "12", icon: Users, tone: "accent" },
      {
        label: "Avg Attendance",
        value: "Group",
        icon: ClipboardCheck,
        tone: "warning",
        ring: { value: 79, max: 100 },
      },
      {
        label: "Low Attendance",
        value: "2",
        icon: AlertTriangle,
        tone: "danger",
        pulse: true,
      },
      {
        label: "Upcoming Exams",
        value: "2",
        icon: FileSpreadsheet,
        tone: "cyan",
        delta: { text: "Next in 2 days", tone: "muted" },
      },
    ],
    panels: [
      {
        kind: "table",
        title: "Mentee Attendance",
        span: 7,
        action: "Open profile",
        link: { label: "All mentees", href: "/users" },
        empty: "No mentees assigned yet.",
        columns: [
          { key: "student", label: "Mentee" },
          { key: "roll", label: "Roll" },
          { key: "attendance", label: "Attendance", numeric: true },
        ],
        rows: [
          { student: "Aryan Mehta", roll: "ROLL142", attendance: "68%" },
          { student: "Kiran Patel", roll: "ROLL118", attendance: "72%" },
          { student: "Sneha Rao", roll: "ROLL126", attendance: "84%" },
          { student: "Imran Shaikh", roll: "ROLL133", attendance: "91%" },
          { student: "Divya Nair", roll: "ROLL107", attendance: "88%" },
        ],
      },
      {
        kind: "list",
        title: "Mentee Alerts",
        span: 5,
        empty: "No alerts — your mentees are on track.",
        items: [
          {
            title: "Aryan Mehta · 68% attendance",
            subtitle: "Below 75% in CS301",
            meta: "Critical",
            tone: "danger",
            action: { label: "Note", href: "/students/s1" },
          },
          {
            title: "Kiran Patel · 72% attendance",
            subtitle: "Below 75% overall",
            meta: "Warning",
            tone: "warning",
            action: { label: "Note", href: "/students/s2" },
          },
          {
            title: "Sneha Rao · 2 assignments overdue",
            subtitle: "CS305 · CS307",
            meta: "Follow up",
            tone: "warning",
          },
        ],
      },
      {
        kind: "actions",
        title: "Quick Actions",
        span: 12,
        items: [
          { label: "View Mentee Profiles", icon: Users, href: "/users", primary: true },
          { label: "Add Mentor Note", icon: FileText, href: "/users" },
          { label: "Mentee Results", icon: GraduationCap, href: "/results" },
          { label: "Group Discussion", icon: MessagesSquare, href: "/discussion" },
        ],
      },
    ],
  },
};

export function getDashboard(role: InstitutionRole): DashboardConfig {
  return DASHBOARDS[role];
}
