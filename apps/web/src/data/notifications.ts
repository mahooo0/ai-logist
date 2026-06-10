export type NotificationType = "info" | "success" | "warning" | "error" | "mention";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  actor?: {
    name: string;
    avatar?: string;
  };
};

export const notifications: Notification[] = [
  {
    id: "n1",
    type: "mention",
    title: "Eddie Lake mentioned you",
    description: "“Can you review the Q3 forecast assumptions before the sync at 2pm?”",
    time: "2m ago",
    unread: true,
    actor: { name: "Eddie Lake" },
  },
  {
    id: "n2",
    type: "success",
    title: "Deployment succeeded",
    description: "main → production · build #482 · 1m 24s",
    time: "12m ago",
    unread: true,
  },
  {
    id: "n3",
    type: "warning",
    title: "Storage usage at 82%",
    description: "Cleanup recommended for the analytics-archive bucket.",
    time: "1h ago",
    unread: true,
  },
  {
    id: "n4",
    type: "info",
    title: "New comment on Order #4421",
    description: "Jamik Tashpulatov: “Customer requested expedited shipping.”",
    time: "3h ago",
    unread: false,
    actor: { name: "Jamik Tashpulatov" },
  },
  {
    id: "n5",
    type: "info",
    title: "Weekly report is ready",
    description: "Your dashboard digest for last week is available to download.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "n6",
    type: "error",
    title: "Failed to sync calendar",
    description: "Re-authentication required for the Google Calendar integration.",
    time: "2d ago",
    unread: false,
  },
];
