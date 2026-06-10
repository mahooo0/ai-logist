export type Priority = "High" | "Medium" | "Low";

export type ColumnId = "backlog" | "in-progress" | "in-review" | "done";

export type TagColor = "blue" | "amber" | "emerald" | "purple" | "cyan";

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  tags: { label: string; color: TagColor }[];
  priority: Priority;
  dueDate?: string;
  assignee?: { initials: string; name: string };
}

export interface KanbanColumn {
  id: ColumnId;
  title: string;
  taskIds: string[];
}

export const initialTasks: Record<string, KanbanTask> = {
  "task-1": {
    id: "task-1",
    title: "Design new onboarding flow",
    description:
      "Create wireframes and high-fidelity mockups for the updated user onboarding experience targeting a 20% improvement in activation rate.",
    tags: [
      { label: "design", color: "blue" },
      { label: "ux", color: "amber" },
    ],
    priority: "High",
    dueDate: "Mar 5",
    assignee: { initials: "SC", name: "Sarah Chen" },
  },
  "task-2": {
    id: "task-2",
    title: "Evaluate third-party analytics providers",
    description:
      "Compare Mixpanel, Amplitude, and PostHog for our product analytics needs. Prepare a recommendation document.",
    tags: [{ label: "research", color: "amber" }],
    priority: "Medium",
    assignee: { initials: "JW", name: "James Wilson" },
  },
  "task-3": {
    id: "task-3",
    title: "Add multi-language support to email templates",
    description: "Implement i18n for transactional emails — at minimum English, Spanish, and French.",
    tags: [{ label: "i18n", color: "emerald" }],
    priority: "Low",
    dueDate: "Apr 1",
  },
  "task-4": {
    id: "task-4",
    title: "Audit API rate-limiting configuration",
    description:
      "Review current rate limits across all public endpoints and adjust for the upcoming enterprise tier launch.",
    tags: [
      { label: "backend", color: "emerald" },
      { label: "security", color: "blue" },
    ],
    priority: "Medium",
    assignee: { initials: "PP", name: "Priya Patel" },
  },
  "task-5": {
    id: "task-5",
    title: "Implement Stripe subscription webhooks",
    description: "Handle subscription.created, updated, and deleted events to keep billing status in sync.",
    tags: [
      { label: "backend", color: "emerald" },
      { label: "billing", color: "purple" },
    ],
    priority: "High",
    dueDate: "Feb 25",
    assignee: { initials: "AR", name: "Alex Rivera" },
  },
  "task-6": {
    id: "task-6",
    title: "Build dashboard activity feed component",
    description: "Real-time feed showing team activity — deployments, comments, and status changes.",
    tags: [{ label: "frontend", color: "blue" }],
    priority: "Medium",
    assignee: { initials: "SC", name: "Sarah Chen" },
  },
  "task-7": {
    id: "task-7",
    title: "Migrate user avatars to CDN",
    description: "Move avatar storage from local disk to Cloudflare R2 with automatic resizing.",
    tags: [{ label: "infra", color: "blue" }],
    priority: "Low",
    dueDate: "Mar 10",
    assignee: { initials: "JW", name: "James Wilson" },
  },
  "task-8": {
    id: "task-8",
    title: "Add role-based access control to team settings",
    description:
      "Restrict settings pages based on user roles (owner, admin, member). Includes middleware and UI guards.",
    tags: [
      { label: "security", color: "blue" },
      { label: "frontend", color: "blue" },
    ],
    priority: "High",
    dueDate: "Feb 20",
    assignee: { initials: "PP", name: "Priya Patel" },
  },
  "task-9": {
    id: "task-9",
    title: "Optimize SQL queries for the reports page",
    description: "Several queries on the monthly report exceed 500ms. Add proper indexes and refactor N+1 patterns.",
    tags: [
      { label: "backend", color: "emerald" },
      { label: "performance", color: "blue" },
    ],
    priority: "Medium",
    assignee: { initials: "AR", name: "Alex Rivera" },
  },
  "task-10": {
    id: "task-10",
    title: "Set up CI/CD pipeline with GitHub Actions",
    description: "Automated lint, test, build, and deploy steps for staging and production environments.",
    tags: [{ label: "devops", color: "purple" }],
    priority: "Medium",
    assignee: { initials: "JW", name: "James Wilson" },
  },
  "task-11": {
    id: "task-11",
    title: "Implement dark mode theme toggle",
    description: "System/light/dark mode support using next-themes with smooth transitions.",
    tags: [
      { label: "frontend", color: "blue" },
      { label: "ux", color: "amber" },
    ],
    priority: "Low",
    assignee: { initials: "SC", name: "Sarah Chen" },
  },
  "task-12": {
    id: "task-12",
    title: "Create API documentation with OpenAPI spec",
    description: "Write Swagger/OpenAPI 3.1 spec for all public endpoints and publish to docs site.",
    tags: [{ label: "docs", color: "cyan" }],
    priority: "High",
    dueDate: "Feb 15",
    assignee: { initials: "PP", name: "Priya Patel" },
  },
};

export const initialColumns: KanbanColumn[] = [
  { id: "backlog", title: "Backlog", taskIds: ["task-1", "task-2", "task-3", "task-4"] },
  { id: "in-progress", title: "In Progress", taskIds: ["task-6", "task-7"] },
  { id: "in-review", title: "In Review", taskIds: ["task-8", "task-9", "task-5"] },
  { id: "done", title: "Done", taskIds: ["task-10", "task-11", "task-12"] },
];

export const tagColorClasses: Record<TagColor, string> = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
};
