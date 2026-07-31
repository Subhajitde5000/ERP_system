import type { ContentItem } from "@/types/content";

/**
 * Content data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 8, C-RB-08; dev doc §11).
 *
 *   GET    /api/v1/content/items?scope=&subjectId=&chapter=   list, auto-scoped
 *   POST   /api/v1/storage/presign  { module: 'content' }     5-min PUT URL
 *   POST   /api/v1/content/items    { ..., fileKey }          save after upload
 *   PATCH  /api/v1/content/items/:id                          edit metadata
 *   PATCH  /api/v1/content/items/:id/visibility               hide / unhide
 *   DELETE /api/v1/content/items/:id                          soft delete
 *   GET    /api/v1/content/items/:id/url                      signed GET, 15 min
 *   POST   /api/v1/content/items/:id/flag                     HOD flags content
 *
 * S3 objects are private; the client never receives a raw S3 URL (§11.3).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAYS = 24 * 60 * 60 * 1000;
/** Fixed base time so server and client render identically. */
const T0 = Date.UTC(2026, 6, 29, 4, 30, 0);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAYS).toISOString();

/** The signed-in teacher, for the MANAGE view. */
const OWN_TEACHER = "Priya Sharma";
/** The signed-in HOD's department. */
const OWN_DEPT = "CSE";

const ITEMS: ContentItem[] = [
  // ── CS301 Algorithms · Priya Sharma ──────────────────────────────────
  {
    id: "c1",
    title: "AVL Tree Rotations — annotated notes",
    description:
      "Step-by-step walkthrough of LL, RR, LR and RL rotations with worked examples.",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "FY-A",
    departmentName: "CSE",
    uploadedBy: OWN_TEACHER,
    contentType: "PDF",
    externalUrl: null,
    fileSizeBytes: 2_412_000,
    durationSeconds: null,
    chapter: "Unit 3 — Balanced Trees",
    sortOrder: 1,
    isVisible: true,
    downloadCount: 128,
    viewCount: 214,
    tags: ["trees", "rotations"],
    createdAt: at(1),
    isFlagged: false,
  },
  {
    id: "c2",
    title: "Lecture 12 — Red-Black Trees",
    description: "Full lecture recording covering insertion and recolouring.",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "FY-A",
    departmentName: "CSE",
    uploadedBy: OWN_TEACHER,
    contentType: "VIDEO",
    externalUrl: null,
    fileSizeBytes: 184_320_000,
    durationSeconds: 2_745,
    chapter: "Unit 3 — Balanced Trees",
    sortOrder: 2,
    isVisible: true,
    downloadCount: 41,
    viewCount: 187,
    tags: ["trees", "lecture"],
    createdAt: at(2),
    isFlagged: false,
  },
  {
    id: "c3",
    title: "Sorting Algorithms — comparison slides",
    description: "Deck comparing quicksort, mergesort, heapsort and introsort.",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "FY-A",
    departmentName: "CSE",
    uploadedBy: OWN_TEACHER,
    contentType: "SLIDE",
    externalUrl: null,
    fileSizeBytes: 8_640_000,
    durationSeconds: null,
    chapter: "Unit 2 — Sorting",
    sortOrder: 1,
    isVisible: true,
    downloadCount: 203,
    viewCount: 342,
    tags: ["sorting", "slides"],
    createdAt: at(9),
    isFlagged: false,
  },
  {
    id: "c4",
    title: "Visualgo — sorting visualiser",
    description: "Interactive visualiser for tracing sort behaviour.",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "FY-A",
    departmentName: "CSE",
    uploadedBy: OWN_TEACHER,
    contentType: "LINK",
    externalUrl: "https://visualgo.net/en/sorting",
    fileSizeBytes: null,
    durationSeconds: null,
    chapter: "Unit 2 — Sorting",
    sortOrder: 2,
    isVisible: true,
    downloadCount: 0,
    viewCount: 96,
    tags: ["sorting", "interactive"],
    createdAt: at(10),
    isFlagged: false,
  },
  {
    id: "c5",
    title: "Draft — Unit 4 complexity notes",
    description: "Work in progress, not yet released to students.",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "FY-A",
    departmentName: "CSE",
    uploadedBy: OWN_TEACHER,
    contentType: "PDF",
    externalUrl: null,
    fileSizeBytes: 640_000,
    durationSeconds: null,
    chapter: "Unit 4 — Complexity",
    sortOrder: 1,
    isVisible: false,
    downloadCount: 0,
    viewCount: 0,
    tags: ["draft"],
    createdAt: at(0),
    isFlagged: false,
  },

  // ── CS305 Databases · Priya Sharma ───────────────────────────────────
  {
    id: "c6",
    title: "Normalisation up to BCNF",
    description: "1NF through BCNF with a worked library-schema example.",
    subjectCode: "CS305",
    subjectName: "Databases",
    className: "FY-A",
    departmentName: "CSE",
    uploadedBy: OWN_TEACHER,
    contentType: "PDF",
    externalUrl: null,
    fileSizeBytes: 1_840_000,
    durationSeconds: null,
    chapter: "Unit 2 — Schema Design",
    sortOrder: 1,
    isVisible: true,
    downloadCount: 156,
    viewCount: 231,
    tags: ["normalisation"],
    createdAt: at(4),
    isFlagged: false,
  },
  {
    id: "c7",
    title: "ER modelling walkthrough",
    description: "Screen recording building an ER diagram from requirements.",
    subjectCode: "CS305",
    subjectName: "Databases",
    className: "FY-A",
    departmentName: "CSE",
    uploadedBy: OWN_TEACHER,
    contentType: "VIDEO",
    externalUrl: null,
    fileSizeBytes: 96_400_000,
    durationSeconds: 1_512,
    chapter: "Unit 1 — ER Modelling",
    sortOrder: 1,
    isVisible: true,
    downloadCount: 22,
    viewCount: 143,
    tags: ["er", "lecture"],
    createdAt: at(12),
    isFlagged: false,
  },

  // ── Other teachers — visible to HOD and above ────────────────────────
  {
    id: "c8",
    title: "Deadlock Handling — slides",
    description: "Coffman conditions, prevention, avoidance and detection.",
    subjectCode: "CS307",
    subjectName: "Operating Systems",
    className: "SY-B",
    departmentName: "CSE",
    uploadedBy: "Neha Rathi",
    contentType: "SLIDE",
    externalUrl: null,
    fileSizeBytes: 5_120_000,
    durationSeconds: null,
    chapter: "Unit 3 — Concurrency",
    sortOrder: 1,
    isVisible: true,
    downloadCount: 88,
    viewCount: 164,
    tags: ["deadlock"],
    createdAt: at(3),
    isFlagged: false,
  },
  {
    id: "c9",
    title: "Scanned textbook chapter (Ch. 7)",
    description: "Full chapter scan uploaded for reference.",
    subjectCode: "CS307",
    subjectName: "Operating Systems",
    className: "SY-B",
    departmentName: "CSE",
    uploadedBy: "Neha Rathi",
    contentType: "PDF",
    externalUrl: null,
    fileSizeBytes: 42_600_000,
    durationSeconds: null,
    chapter: "Unit 3 — Concurrency",
    sortOrder: 2,
    isVisible: true,
    downloadCount: 310,
    viewCount: 402,
    tags: ["textbook"],
    createdAt: at(6),
    // Flagged by the HOD — copyright concern (PAGE 8)
    isFlagged: true,
  },
  {
    id: "c10",
    title: "Convolution problem set — audio walkthrough",
    description: "Narrated solutions to the tutorial sheet.",
    subjectCode: "EC202",
    subjectName: "Signals & Systems",
    className: "SY-A",
    departmentName: "ECE",
    uploadedBy: "Meena Thomas",
    contentType: "AUDIO",
    externalUrl: null,
    fileSizeBytes: 22_400_000,
    durationSeconds: 1_140,
    chapter: "Unit 2 — Convolution",
    sortOrder: 1,
    isVisible: true,
    downloadCount: 34,
    viewCount: 79,
    tags: ["audio", "tutorial"],
    createdAt: at(5),
    isFlagged: false,
  },
  {
    id: "c11",
    title: "Thermodynamics lab manual",
    description: "Complete lab manual with apparatus diagrams.",
    subjectCode: "ME105",
    subjectName: "Thermodynamics",
    className: "SY-A",
    departmentName: "Mechanical",
    uploadedBy: "Rajesh Verma",
    contentType: "ZIP",
    externalUrl: null,
    fileSizeBytes: 61_800_000,
    durationSeconds: null,
    chapter: "Lab Manuals",
    sortOrder: 1,
    isVisible: true,
    downloadCount: 142,
    viewCount: 168,
    tags: ["lab"],
    createdAt: at(15),
    isFlagged: false,
  },
];

function byNewest(a: ContentItem, b: ContentItem) {
  return +new Date(b.createdAt) - +new Date(a.createdAt);
}

/** Teacher — only their own uploads, including hidden ones. */
export function getOwnContent(): ContentItem[] {
  return ITEMS.filter((i) => i.uploadedBy === OWN_TEACHER).sort(byNewest);
}

/** HOD — everything in the department, across teachers. */
export function getDepartmentContent(): ContentItem[] {
  return ITEMS.filter((i) => i.departmentName === OWN_DEPT).sort(byNewest);
}

/** Principal / VP / Admin — everything. */
export function getAllContent(): ContentItem[] {
  return [...ITEMS].sort(byNewest);
}

/**
 * Student / Parent — own subjects only, and hidden items are excluded
 * (DB §7.6 `is_visible`).
 */
export function getBrowsableContent(): ContentItem[] {
  const ownSubjects = ["CS301", "CS305", "CS307"];
  return ITEMS.filter(
    (i) => i.isVisible && ownSubjects.includes(i.subjectCode),
  ).sort(byNewest);
}
