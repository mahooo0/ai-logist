// apps/web/src/navigation/sidebar/sidebar-items.ts
// Plan 04-02 — Phase 4 sidebar trim (D-49). Visible items:
//   Default, Analytics, Chat, Calls, Orders.
// All other Zenith items remain in the build (D-48) but are commented out
// here so they do not appear in the sidebar. To re-enable in a future
// version, uncomment the relevant blocks below.

import {
  // Banknote,
  // Calendar,
  // ChartBar,
  // Component,
  // Fingerprint,
  // Forklift,
  Gauge,
  Columns3,
  // GraduationCap,
  // Kanban,
  LayoutDashboard,
  // LayoutGrid,
  // ListTodo,
  // Lock,
  type LucideIcon,
  // Mail,
  MapPinned,
  MessageSquare,
  Package,
  Phone,
  // ReceiptText,
  // ShoppingBag,
  // SquareArrowUpRight,
  // Users,
} from 'lucide-react';

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: 'Dashboards',
    items: [
      {
        title: 'Default',
        url: '/dashboard/default',
        icon: LayoutDashboard,
      },
      // { title: "CRM", url: "/dashboard/crm", icon: ChartBar },
      // { title: "Finance", url: "/dashboard/finance", icon: Banknote },
      {
        title: 'Analytics',
        url: '/dashboard/analytics',
        icon: Gauge,
      },
      // { title: "Productivity", url: "/dashboard/productivity", icon: ListTodo },
      // { title: "Draggable", url: "/dashboard/draggable", icon: LayoutGrid, isNew: true },
      // { title: "E-commerce", url: "/dashboard/coming-soon", icon: ShoppingBag, comingSoon: true },
      // { title: "Academy", url: "/dashboard/coming-soon", icon: GraduationCap, comingSoon: true },
      // { title: "Logistics", url: "/dashboard/coming-soon", icon: Forklift, comingSoon: true },
    ],
  },
  {
    id: 2,
    label: 'Pages',
    items: [
      {
        title: 'Chat',
        url: '/dashboard/chat',
        icon: MessageSquare,
      },
      {
        title: 'Calls',
        url: '/dashboard/calls',
        icon: Phone,
      },
      {
        title: 'Orders',
        url: '/dashboard/orders',
        icon: Package,
      },
      {
        title: 'Воронка заказов',
        url: '/dashboard/orders/kanban',
        icon: Columns3,
        isNew: true,
      },
      {
        title: 'Live tracking',
        url: '/dashboard/tracking',
        icon: MapPinned,
        isNew: true,
      },
      // { title: "Email", url: "/dashboard/mail", icon: Mail, isNew: true },
      // { title: "Calendar", url: "/dashboard/calendar", icon: Calendar, isNew: true },
      // { title: "Kanban", url: "/dashboard/kanban", icon: Kanban },
      // { title: "Invoice", url: "/dashboard/coming-soon", icon: ReceiptText, comingSoon: true },
      // { title: "Users", url: "/dashboard/coming-soon", icon: Users, comingSoon: true },
      // { title: "Roles", url: "/dashboard/coming-soon", icon: Lock, comingSoon: true },
      // {
      //   title: "Authentication",
      //   url: "/auth",
      //   icon: Fingerprint,
      //   subItems: [
      //     { title: "Login v1", url: "/auth/v1/login", newTab: true },
      //     { title: "Login v2", url: "/auth/v2/login", newTab: true },
      //     { title: "Register v1", url: "/auth/v1/register", newTab: true },
      //     { title: "Register v2", url: "/auth/v2/register", newTab: true },
      //   ],
      // },
    ],
  },
  // {
  //   id: 3,
  //   label: "Legacy",
  //   items: [
  //     {
  //       title: "Dashboards",
  //       url: "/dashboard/default-v1",
  //       subItems: [
  //         { title: "Default V1", url: "/dashboard/default-v1" },
  //         { title: "CRM V1", url: "/dashboard/crm-v1" },
  //         { title: "Finance V1", url: "/dashboard/finance-v1" },
  //         { title: "Analytics V1", url: "/dashboard/analytics-v1" },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: 4,
  //   label: "Misc",
  //   items: [
  //     { title: "Components", url: "/dashboard/components", icon: Component, isNew: true },
  //     { title: "Others", url: "/dashboard/coming-soon", icon: SquareArrowUpRight, comingSoon: true },
  //   ],
  // },
];
