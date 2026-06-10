"use client";

import { useId } from "react";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Flame,
  type LucideIcon,
  Package,
  ShoppingCart,
  Star,
  TrendingUp,
  UserPlus,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------- */
/* Shared shell                                                           */
/* ---------------------------------------------------------------------- */

interface WidgetShellProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  headerClassName?: string;
}

function WidgetShell({ title, subtitle, action, children, bodyClassName, headerClassName }: WidgetShellProps) {
  return (
    <div className="flex h-full w-full flex-col rounded-xl border bg-card text-card-foreground shadow-xs">
      {(title ?? action) && (
        <div
          className={cn("flex shrink-0 items-start justify-between gap-2 border-b @md/widget:p-4 p-3", headerClassName)}
        >
          <div className="min-w-0">
            {title && <h3 className="truncate font-semibold @md/widget:text-base text-foreground text-sm">{title}</h3>}
            {subtitle && <p className="@md/widget:block hidden truncate text-muted-foreground text-xs">{subtitle}</p>}
          </div>
          {action && <div className="@md/widget:block hidden shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("flex min-h-0 flex-1 flex-col @md/widget:p-4 p-3", bodyClassName)}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Metric card                                                            */
/* ---------------------------------------------------------------------- */

const metricSparkData = [
  { v: 14 },
  { v: 18 },
  { v: 16 },
  { v: 22 },
  { v: 19 },
  { v: 25 },
  { v: 24 },
  { v: 28 },
  { v: 26 },
  { v: 32 },
  { v: 30 },
  { v: 36 },
];

interface MetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  hint: string;
  accent?: string;
}

function MetricCard({ icon: Icon, label, value, change, trend, hint, accent = "var(--chart-1)" }: MetricProps) {
  const TrendIcon = trend === "up" ? ArrowUpRight : ArrowDownRight;
  const id = useId().replace(/:/g, "");

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card @md/widget:p-4 p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklch, ${accent} 12%, transparent)`, color: accent }}
        >
          <Icon className="size-4" />
        </div>
        <Badge variant={trend === "down" ? "destructive" : "default"} className="h-5 gap-1 px-1.5 text-[10px]">
          <TrendIcon className="size-3" />
          {change}
        </Badge>
      </div>

      <div className="@md/widget:mt-3 mt-2 min-w-0">
        <p className="truncate @md/widget:text-sm text-muted-foreground text-xs">{label}</p>
        <p className="mt-0.5 font-semibold @md/widget:text-3xl text-2xl tabular-nums leading-none tracking-tight">
          {value}
        </p>
        <p className="mt-1 @md/widget:block hidden truncate text-muted-foreground text-xs">{hint}</p>
      </div>

      <div className="mt-auto @md/widget:block hidden @md/widget:h-14 h-12 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metricSparkData} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
            <defs>
              <linearGradient id={`metric-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={accent}
              strokeWidth={1.5}
              fill={`url(#metric-${id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Revenue chart (area)                                                   */
/* ---------------------------------------------------------------------- */

const revenueData = Array.from({ length: 30 }, (_, i) => ({
  d: `D${i + 1}`,
  current: 4200 + Math.round(Math.sin(i / 2.5) * 1200 + Math.random() * 600),
  prev: 3600 + Math.round(Math.cos(i / 3) * 900 + Math.random() * 400),
}));

function RevenueChartWidget() {
  return (
    <WidgetShell
      title="Revenue"
      subtitle="Last 30 days vs previous period"
      action={
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="size-3" />
          +18.2%
        </Badge>
      }
    >
      <div className="grid grid-cols-2 @md/widget:gap-4 gap-3 pb-3">
        <div>
          <p className="text-muted-foreground text-xs">This period</p>
          <p className="font-semibold @md/widget:text-2xl text-lg tabular-nums">$128,430</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Previous</p>
          <p className="font-semibold @md/widget:text-2xl text-lg text-muted-foreground tabular-nums">$108,612</p>
        </div>
      </div>

      <div className="min-h-[120px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueData} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="rev-current" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.36} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.4} />
            <XAxis dataKey="d" hide />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="prev"
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="3 3"
              fill="transparent"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              fill="url(#rev-current)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Sales by category (bar)                                                */
/* ---------------------------------------------------------------------- */

const categoryData = [
  { c: "Apparel", value: 4820 },
  { c: "Electronics", value: 6240 },
  { c: "Home", value: 3420 },
  { c: "Books", value: 2180 },
  { c: "Toys", value: 1620 },
  { c: "Beauty", value: 3940 },
];

function SalesByCategoryWidget() {
  return (
    <WidgetShell title="Sales by category" subtitle="Units sold this month">
      <div className="min-h-[140px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.4} />
            <XAxis
              dataKey="c"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={0}
              tickFormatter={(v: string) => v.slice(0, 4)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Traffic sources (donut)                                                */
/* ---------------------------------------------------------------------- */

const trafficData = [
  { name: "Direct", value: 38, fill: "var(--chart-1)" },
  { name: "Search", value: 27, fill: "var(--chart-2)" },
  { name: "Social", value: 19, fill: "var(--chart-3)" },
  { name: "Referral", value: 11, fill: "var(--chart-4)" },
  { name: "Email", value: 5, fill: "var(--chart-5)" },
];

function TrafficSourcesWidget() {
  return (
    <WidgetShell title="Traffic sources" subtitle="Sessions split by channel">
      <div className="grid h-full min-h-0 @lg/widget:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-cols-1 @lg/widget:gap-4 gap-3">
        <div className="relative min-h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={trafficData}
                dataKey="value"
                innerRadius="60%"
                outerRadius="90%"
                paddingAngle={2}
                stroke="var(--background)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {trafficData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [`${v}%`, "share"]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-semibold text-xl tabular-nums">100%</p>
            <p className="text-[10px] text-muted-foreground">total</p>
          </div>
        </div>
        <ul className="flex min-h-0 flex-col justify-center gap-1.5 overflow-y-auto text-sm">
          {trafficData.map((row) => (
            <li key={row.name} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: row.fill }} />
              <span className="flex-1 truncate text-foreground">{row.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">{row.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Goal progress (radial)                                                 */
/* ---------------------------------------------------------------------- */

const goalData = [{ name: "goal", value: 72, fill: "var(--chart-1)" }];

function GoalWidget() {
  return (
    <WidgetShell title="Monthly goal" subtitle="Revenue target for May">
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="relative min-h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart data={goalData} innerRadius="70%" outerRadius="100%" startAngle={210} endAngle={-30}>
              <RadialBar
                dataKey="value"
                cornerRadius={8}
                background={{ fill: "var(--muted)" }}
                isAnimationActive={false}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-semibold text-2xl tabular-nums">72%</p>
            <p className="text-[10px] text-muted-foreground">of $200k</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-3">
          <div>
            <p className="text-muted-foreground text-xs">Achieved</p>
            <p className="truncate font-semibold text-lg tabular-nums">$144,200</p>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground text-xs">Remaining</p>
            <p className="truncate font-semibold text-lg tabular-nums">$55,800</p>
          </div>
          <p className="@md/widget:block hidden text-[11px] text-muted-foreground">12 days left</p>
        </div>
      </div>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Top products list                                                      */
/* ---------------------------------------------------------------------- */

const topProducts = [
  { name: "Aurora Hoodie", sku: "APR-1182", sold: 1284, total: 1500, revenue: "$24,180" },
  { name: "Nimbus Sneakers", sku: "APR-2204", sold: 982, total: 1500, revenue: "$31,420" },
  { name: "Echo Headphones", sku: "ELX-3091", sold: 740, total: 1500, revenue: "$48,200" },
  { name: "Zen Diffuser", sku: "HOM-0421", sold: 612, total: 1500, revenue: "$8,930" },
  { name: "Pulse Tracker", sku: "ELX-4410", sold: 489, total: 1500, revenue: "$22,190" },
  { name: "Verde Tote", sku: "APR-5520", sold: 412, total: 1500, revenue: "$6,120" },
];

function TopProductsWidget() {
  return (
    <WidgetShell title="Top products" subtitle="Best performers this week" bodyClassName="!p-0">
      <ul className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
        {topProducts.map((p, i) => {
          const pct = (p.sold / p.total) * 100;
          return (
            <li key={p.sku} className="flex items-center gap-3 @md/widget:p-4 p-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-[11px] text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate font-medium text-sm">{p.name}</p>
                  <span className="@sm/widget:inline hidden shrink-0 text-[10px] text-muted-foreground">{p.sku}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={pct} className="h-1 flex-1" />
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {p.sold.toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="@md/widget:block hidden shrink-0 font-medium text-sm tabular-nums">{p.revenue}</p>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Recent activity feed                                                   */
/* ---------------------------------------------------------------------- */

interface ActivityItem {
  who: string;
  initials: string;
  action: string;
  detail: string;
  when: string;
  icon: LucideIcon;
  tone: string;
}

const activity: ActivityItem[] = [
  {
    who: "Maya Chen",
    initials: "MC",
    action: "completed an order",
    detail: "#A-31022 · $342.10",
    when: "2m",
    icon: ShoppingCart,
    tone: "var(--chart-1)",
  },
  {
    who: "Liam Foster",
    initials: "LF",
    action: "subscribed to Pro",
    detail: "Yearly · $480/yr",
    when: "12m",
    icon: Star,
    tone: "var(--chart-2)",
  },
  {
    who: "Aiko Tanaka",
    initials: "AT",
    action: "left a 5-star review",
    detail: "“Best service ever”",
    when: "34m",
    icon: CheckCircle2,
    tone: "var(--chart-3)",
  },
  {
    who: "Noah Patel",
    initials: "NP",
    action: "refunded an order",
    detail: "#A-30910 · -$89.00",
    when: "1h",
    icon: CreditCard,
    tone: "var(--destructive)",
  },
  {
    who: "Elena Ruiz",
    initials: "ER",
    action: "added 3 items to cart",
    detail: "Cart total $128.40",
    when: "2h",
    icon: Package,
    tone: "var(--chart-4)",
  },
  {
    who: "Owen Hart",
    initials: "OH",
    action: "created an account",
    detail: "via Google",
    when: "3h",
    icon: UserPlus,
    tone: "var(--chart-5)",
  },
];

function ActivityWidget() {
  return (
    <WidgetShell title="Recent activity" subtitle="Live feed across the workspace" bodyClassName="!p-0">
      <ul className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
        {activity.map((item) => {
          const Icon = item.icon;
          return (
            <li key={`${item.who}-${item.when}`} className="flex items-start gap-3 @md/widget:p-4 p-3">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-[11px]">{item.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium">{item.who}</span>{" "}
                  <span className="text-muted-foreground">{item.action}</span>
                </p>
                <p className="truncate text-muted-foreground text-xs">{item.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
                <Icon className="size-3.5 shrink-0" style={{ color: item.tone }} />
                <span className="tabular-nums">{item.when}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Order status grid                                                      */
/* ---------------------------------------------------------------------- */

const orderStatuses = [
  { label: "Pending", value: 128, icon: Clock, tone: "var(--chart-2)" },
  { label: "Processing", value: 86, icon: Activity, tone: "var(--chart-1)" },
  { label: "Shipped", value: 412, icon: Package, tone: "var(--chart-3)" },
  { label: "Delivered", value: 1284, icon: CheckCircle2, tone: "var(--chart-4)" },
];

function OrderStatusWidget() {
  return (
    <WidgetShell title="Orders" subtitle="Live pipeline">
      <div className="grid h-full min-h-0 grid-cols-2 @md/widget:gap-3 gap-2">
        {orderStatuses.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex min-w-0 flex-col justify-between gap-2 rounded-lg border bg-muted/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground text-xs">{s.label}</span>
                <Icon className="size-3.5 shrink-0" style={{ color: s.tone }} />
              </div>
              <p className="font-semibold @md/widget:text-2xl text-xl tabular-nums leading-none">
                {s.value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Sessions sparkline (compact stat)                                      */
/* ---------------------------------------------------------------------- */

const sessionsSpark = Array.from({ length: 24 }, (_, i) => ({
  h: i,
  v: Math.round(120 + Math.sin(i / 2) * 60 + Math.random() * 40),
}));

function SessionsWidget() {
  return (
    <WidgetShell title="Sessions today">
      <div className="flex shrink-0 items-baseline gap-2">
        <p className="font-semibold @md/widget:text-3xl text-2xl tabular-nums leading-none">12,481</p>
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="size-3" />
          +9.4%
        </Badge>
      </div>
      <p className="mt-1 @md/widget:block hidden text-muted-foreground text-xs">vs yesterday at this time</p>

      <div className="mt-2 min-h-[60px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sessionsSpark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--chart-3)"
              strokeWidth={1.5}
              fill="url(#sess)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Quick actions                                                          */
/* ---------------------------------------------------------------------- */

const quickActions = [
  { label: "New order", icon: ShoppingCart, hint: "⌘N" },
  { label: "Add product", icon: Package, hint: "⌘P" },
  { label: "Invite user", icon: UserPlus, hint: "⌘I" },
  { label: "Schedule", icon: Calendar, hint: "⌘K" },
  { label: "Run report", icon: Zap, hint: "⌘R" },
  { label: "View hot", icon: Flame, hint: "⌘H" },
];

function QuickActionsWidget() {
  return (
    <WidgetShell title="Quick actions">
      <div className="grid h-full min-h-0 auto-rows-fr @sm/widget:grid-cols-3 grid-cols-2 gap-2">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              className="group flex flex-col items-start justify-between gap-2 rounded-lg border bg-card @md/widget:p-3 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <Icon className="size-3.5" />
              </div>
              <div className="flex w-full items-baseline justify-between gap-1">
                <span className="truncate @md/widget:text-sm text-xs">{a.label}</span>
                <kbd className="@md/widget:inline hidden shrink-0 rounded border bg-muted px-1 font-mono text-[9px] text-muted-foreground">
                  {a.hint}
                </kbd>
              </div>
            </button>
          );
        })}
      </div>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Registry                                                               */
/* ---------------------------------------------------------------------- */

export type WidgetId =
  | "metric-revenue"
  | "metric-customers"
  | "metric-accounts"
  | "metric-growth"
  | "sessions"
  | "revenue-chart"
  | "sales-by-category"
  | "traffic-sources"
  | "goal"
  | "order-status"
  | "top-products"
  | "activity"
  | "quick-actions";

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  defaultColSpan: number;
  defaultRowSpan: number;
  render: () => React.ReactNode;
}

export const widgetRegistry: Record<WidgetId, WidgetDefinition> = {
  "metric-revenue": {
    id: "metric-revenue",
    title: "Revenue",
    defaultColSpan: 3,
    defaultRowSpan: 2,
    render: () => (
      <MetricCard
        icon={DollarSign}
        label="Total Revenue"
        value="$128,430"
        change="+12.5%"
        trend="up"
        hint="Last 6 months"
        accent="var(--chart-1)"
      />
    ),
  },
  "metric-customers": {
    id: "metric-customers",
    title: "Customers",
    defaultColSpan: 3,
    defaultRowSpan: 2,
    render: () => (
      <MetricCard
        icon={UserPlus}
        label="New Customers"
        value="1,234"
        change="-20%"
        trend="down"
        hint="Acquisition needs attention"
        accent="var(--chart-2)"
      />
    ),
  },
  "metric-accounts": {
    id: "metric-accounts",
    title: "Accounts",
    defaultColSpan: 3,
    defaultRowSpan: 2,
    render: () => (
      <MetricCard
        icon={Users}
        label="Active Accounts"
        value="45,678"
        change="+12.5%"
        trend="up"
        hint="Engagement exceeds targets"
        accent="var(--chart-3)"
      />
    ),
  },
  "metric-growth": {
    id: "metric-growth",
    title: "Growth",
    defaultColSpan: 3,
    defaultRowSpan: 2,
    render: () => (
      <MetricCard
        icon={Waves}
        label="Growth Rate"
        value="4.5%"
        change="+4.5%"
        trend="up"
        hint="Meets growth projections"
        accent="var(--chart-4)"
      />
    ),
  },
  sessions: {
    id: "sessions",
    title: "Sessions today",
    defaultColSpan: 4,
    defaultRowSpan: 2,
    render: () => <SessionsWidget />,
  },
  "revenue-chart": {
    id: "revenue-chart",
    title: "Revenue",
    defaultColSpan: 8,
    defaultRowSpan: 3,
    render: () => <RevenueChartWidget />,
  },
  "sales-by-category": {
    id: "sales-by-category",
    title: "Sales by category",
    defaultColSpan: 6,
    defaultRowSpan: 3,
    render: () => <SalesByCategoryWidget />,
  },
  "traffic-sources": {
    id: "traffic-sources",
    title: "Traffic sources",
    defaultColSpan: 6,
    defaultRowSpan: 3,
    render: () => <TrafficSourcesWidget />,
  },
  goal: {
    id: "goal",
    title: "Monthly goal",
    defaultColSpan: 4,
    defaultRowSpan: 2,
    render: () => <GoalWidget />,
  },
  "order-status": {
    id: "order-status",
    title: "Orders",
    defaultColSpan: 4,
    defaultRowSpan: 2,
    render: () => <OrderStatusWidget />,
  },
  "top-products": {
    id: "top-products",
    title: "Top products",
    defaultColSpan: 6,
    defaultRowSpan: 4,
    render: () => <TopProductsWidget />,
  },
  activity: {
    id: "activity",
    title: "Recent activity",
    defaultColSpan: 6,
    defaultRowSpan: 4,
    render: () => <ActivityWidget />,
  },
  "quick-actions": {
    id: "quick-actions",
    title: "Quick actions",
    defaultColSpan: 4,
    defaultRowSpan: 2,
    render: () => <QuickActionsWidget />,
  },
};

export interface LayoutItem {
  id: WidgetId;
  colSpan: number;
  rowSpan: number;
}

const orderedIds: WidgetId[] = [
  "metric-revenue",
  "metric-customers",
  "metric-accounts",
  "metric-growth",
  "revenue-chart",
  "goal",
  "sales-by-category",
  "traffic-sources",
  "order-status",
  "sessions",
  "top-products",
  "activity",
  "quick-actions",
];

export const defaultLayout: LayoutItem[] = orderedIds.map((id) => ({
  id,
  colSpan: widgetRegistry[id].defaultColSpan,
  rowSpan: widgetRegistry[id].defaultRowSpan,
}));
