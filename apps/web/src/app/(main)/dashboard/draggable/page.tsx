import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { DraggableDashboard } from "./_components/draggable-dashboard";

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard/default">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Draggable</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-bold text-2xl text-foreground tracking-tight">Draggable Dashboard</h1>
        <p className="text-muted-foreground text-sm">Reorder and resize widgets — your layout is saved locally.</p>
      </div>

      <DraggableDashboard />
    </div>
  );
}
