import Link from "next/link";

import { Plus } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

import { KanbanBoard } from "./_components/kanban-board";

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                <BreadcrumbPage>Kanban Board</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="font-bold text-2xl text-foreground tracking-tight">Kanban Board</h1>
          <p className="text-muted-foreground text-sm">Organize and track project tasks</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button>
            <Plus />
            New Task
          </Button>
        </div>
      </div>

      <KanbanBoard />
    </div>
  );
}
