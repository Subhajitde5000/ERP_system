import type { DiscussionPermissions, DiscussionThread } from "@/types/discussion";

/**
 * Discussion feed data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 3, C-RB-03).
 *
 *   GET    /api/v1/discussion/threads?scope=&scopeId=&q=&page=&perPage=20
 *   POST   /api/v1/discussion/threads
 *   GET    /api/v1/discussion/threads/:id
 *   POST   /api/v1/discussion/threads/:id/replies
 *   PATCH  /api/v1/discussion/threads/:id/pin | /lock | /resolve
 *   POST   /api/v1/discussion/threads/:id/vote      (target_type THREAD)
 *   POST   /api/v1/discussion/replies/:id/vote      (target_type REPLY)
 *   PATCH  /api/v1/discussion/replies/:id/accept    (teacher, own subject)
 *   DELETE /api/v1/discussion/threads/:id           (soft — deleted_at)
 *
 * The backend scopes the list by tenant_id + role scope; the client filters
 * only for UI. Shapes below match the API response exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MIN = 60 * 1000;
const HOURS = 60 * MIN;
const DAYS = 24 * HOURS;

/** Fixed base time so server and client render identical timestamps. */
const T0 = Date.UTC(2026, 6, 29, 4, 30, 0);
const iso = (msAgo: number) => new Date(T0 - msAgo).toISOString();

const THREADS: DiscussionThread[] = [
  {
    id: "t1",
    title: "Why does quicksort degrade to O(n²) on sorted input?",
    body: "I understand the average case is O(n log n), but I can't follow why an already-sorted array is the worst case when we pick the first element as pivot. Does median-of-three actually fix this, or just make it less likely?",
    author: { id: "s1", name: "Aryan Mehta", role: "STUDENT" },
    scopeType: "SUBJECT",
    scopeId: "cs301",
    scopeName: "CS301 · Algorithms",
    tags: ["sorting", "complexity"],
    isPinned: false,
    isLocked: false,
    isResolved: true,
    replyCount: 3,
    upvoteCount: 12,
    viewCount: 84,
    hasUpvoted: false,
    createdAt: iso(4 * HOURS),
    replies: [
      {
        id: "r1",
        body: "With a first-element pivot on sorted input every partition splits into 0 and n-1, so you get n levels of recursion instead of log n. Median-of-three doesn't change the worst case asymptotically — an adversary can still construct input — but it makes it vanishingly unlikely in practice. Randomised pivots give you the same benefit with a cleaner proof.",
        author: { id: "u3", name: "Priya Sharma", role: "TEACHER" },
        isAcceptedAnswer: true,
        upvoteCount: 18,
        hasUpvoted: false,
        createdAt: iso(3 * HOURS),
      },
      {
        id: "r2",
        body: "Adding to that — this is exactly why introsort switches to heapsort once recursion depth passes 2·log n. It's what most standard libraries actually ship.",
        author: { id: "s2", name: "Sneha Rao", role: "STUDENT" },
        isAcceptedAnswer: false,
        upvoteCount: 6,
        hasUpvoted: true,
        createdAt: iso(2 * HOURS),
      },
      {
        id: "r3",
        body: "The visualisation in the slides from week 3 helped me a lot with this.",
        author: { id: "s3", name: "Imran Shaikh", role: "STUDENT" },
        isAcceptedAnswer: false,
        upvoteCount: 1,
        hasUpvoted: false,
        createdAt: iso(90 * MIN),
      },
    ],
  },
  {
    id: "t2",
    title: "Mid-term syllabus — which units are included?",
    body: "Conflicting information going around about whether Unit 4 is in the mid-term. Could a faculty member confirm the exact scope?",
    author: { id: "s2", name: "Sneha Rao", role: "STUDENT" },
    scopeType: "DEPARTMENT",
    scopeId: "cse",
    scopeName: "CSE",
    tags: ["exam", "syllabus"],
    isPinned: true,
    isLocked: false,
    isResolved: true,
    replyCount: 1,
    upvoteCount: 34,
    viewCount: 212,
    hasUpvoted: true,
    createdAt: iso(1 * DAYS),
    replies: [
      {
        id: "r4",
        body: "Units 1 to 3 only. Unit 4 moves to the end-semester paper. The revised syllabus PDF is on the notice board.",
        author: { id: "u1", name: "Deepak Iyer", role: "EXAM_CONTROLLER" },
        isAcceptedAnswer: true,
        upvoteCount: 41,
        hasUpvoted: false,
        createdAt: iso(22 * HOURS),
      },
    ],
  },
  {
    id: "t3",
    title: "Normalization: when is 3NF not worth it?",
    body: "We covered BCNF this week. In real systems, when do people deliberately stop at 2NF or denormalise on purpose? Looking for practical examples rather than textbook ones.",
    author: { id: "s4", name: "Divya Nair", role: "STUDENT" },
    scopeType: "SUBJECT",
    scopeId: "cs305",
    scopeName: "CS305 · Databases",
    tags: ["databases", "design"],
    isPinned: false,
    isLocked: false,
    isResolved: false,
    replyCount: 0,
    upvoteCount: 5,
    viewCount: 31,
    hasUpvoted: false,
    createdAt: iso(6 * HOURS),
    replies: [],
  },
  {
    id: "t4",
    title: "Lab 3 submission — group size confirmation",
    body: "Is Lab 3 an individual submission or can we work in pairs? The handout says both in different places.",
    author: { id: "s5", name: "Kiran Patel", role: "STUDENT" },
    scopeType: "CLASS",
    scopeId: "fy-a",
    scopeName: "FY-A",
    tags: ["lab", "submission"],
    isPinned: false,
    isLocked: false,
    isResolved: false,
    replyCount: 2,
    upvoteCount: 3,
    viewCount: 47,
    hasUpvoted: false,
    createdAt: iso(2 * DAYS),
    replies: [
      {
        id: "r5",
        body: "Pairs are fine for Lab 3. Put both roll numbers on the cover sheet.",
        author: { id: "u3", name: "Priya Sharma", role: "TEACHER" },
        isAcceptedAnswer: false,
        upvoteCount: 9,
        hasUpvoted: false,
        createdAt: iso(1 * DAYS + 8 * HOURS),
      },
      {
        id: "r6",
        body: "Thanks, that clears it up.",
        author: { id: "s5", name: "Kiran Patel", role: "STUDENT" },
        isAcceptedAnswer: false,
        upvoteCount: 0,
        hasUpvoted: false,
        createdAt: iso(1 * DAYS + 6 * HOURS),
      },
    ],
  },
  {
    id: "t5",
    title: "Department guidelines for project report formatting",
    body: "Posting the standard formatting rules so everyone works from the same template. Margins, citation style and the cover page format are all specified in the attached guidance on the notice board. Questions here rather than over email, please.",
    author: { id: "u4", name: "Kavita Menon", role: "HOD" },
    scopeType: "DEPARTMENT",
    scopeId: "cse",
    scopeName: "CSE",
    tags: ["project", "guidelines"],
    isPinned: true,
    isLocked: true,
    isResolved: false,
    replyCount: 0,
    upvoteCount: 27,
    viewCount: 168,
    hasUpvoted: false,
    createdAt: iso(3 * DAYS),
    replies: [],
  },
  {
    id: "t6",
    title: "Deadlock detection vs prevention — exam focus?",
    body: "For the OS mid-term, should we prioritise Banker's algorithm or the detection graph approach? Both are in the syllabus but time is short.",
    author: { id: "s3", name: "Imran Shaikh", role: "STUDENT" },
    scopeType: "SUBJECT",
    scopeId: "cs307",
    scopeName: "CS307 · Operating Systems",
    tags: ["exam", "os"],
    isPinned: false,
    isLocked: false,
    isResolved: false,
    replyCount: 1,
    upvoteCount: 8,
    viewCount: 62,
    hasUpvoted: false,
    createdAt: iso(8 * HOURS),
    replies: [
      {
        id: "r7",
        body: "Know both, but be able to actually run Banker's on a small matrix — that's the part people lose marks on.",
        author: { id: "u9", name: "Neha Rathi", role: "TEACHER" },
        isAcceptedAnswer: false,
        upvoteCount: 11,
        hasUpvoted: false,
        createdAt: iso(7 * HOURS),
      },
    ],
  },
];

/** Mirrors `GET /api/v1/discussion/threads` — scoped, pinned first. */
export function getThreads(perms: DiscussionPermissions): DiscussionThread[] {
  return THREADS.filter((t) => {
    if (!perms.visibleScopes.includes(t.scopeType)) return false;
    // Exam Controller only sees exam-tagged threads
    if (perms.tagFilter && !t.tags.includes(perms.tagFilter)) return false;
    return true;
  }).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}

/** Mirrors `GET /api/v1/discussion/threads/:id`. */
export function getThread(id: string): DiscussionThread | undefined {
  return THREADS.find((t) => t.id === id);
}
