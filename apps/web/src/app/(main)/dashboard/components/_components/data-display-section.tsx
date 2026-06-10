"use client";

import { ArrowUpRight, MoreHorizontal } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Section, SubBlock } from "./section";

const ORDERS = [
  { id: "ORD-1041", customer: "Ali Hasanli", amount: "$248.00", status: "Paid", date: "Mar 14" },
  { id: "ORD-1042", customer: "Sevinc Aliyeva", amount: "$1,420.00", status: "Pending", date: "Mar 14" },
  { id: "ORD-1043", customer: "Rauf Mammadov", amount: "$92.50", status: "Refunded", date: "Mar 13" },
  { id: "ORD-1044", customer: "Leyla Quliyeva", amount: "$615.00", status: "Paid", date: "Mar 13" },
  { id: "ORD-1045", customer: "Tural Babayev", amount: "$310.75", status: "Cancelled", date: "Mar 12" },
];

const STATUS_TINT: Record<string, string> = {
  Paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Refunded: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function DataDisplaySection() {
  return (
    <Section id="data" title="Data display" description="Cards, tables, accordion, tabs, alerts, avatars, skeletons.">
      <div className="space-y-8">
        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total revenue</CardDescription>
              <CardTitle className="text-2xl">$45,231.89</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">+20.1%</Badge>
              <span className="ml-2 text-muted-foreground text-xs">from last month</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Active users</CardDescription>
              <CardTitle className="text-2xl">2,350</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">+180</Badge>
              <span className="ml-2 text-muted-foreground text-xs">since yesterday</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Subscriptions</CardDescription>
              <CardTitle className="text-2xl">+12,234</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300">−4.3%</Badge>
              <span className="ml-2 text-muted-foreground text-xs">vs last week</span>
            </CardContent>
            <CardFooter>
              <Button variant="link" className="px-0">
                View details <ArrowUpRight />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Table */}
        <SubBlock label="Table">
          <div className="w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ORDERS.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {o.customer
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span>{o.customer}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{o.amount}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_TINT[o.status] ?? ""} variant="secondary">
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.date}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View</DropdownMenuItem>
                          <DropdownMenuItem>Refund</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive">Cancel</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SubBlock>

        {/* Tabs + Accordion + Alert */}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Tabs</p>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="rounded-md border p-4 text-muted-foreground text-sm">
                High-level metrics and a brief summary of the project state.
              </TabsContent>
              <TabsContent value="activity" className="rounded-md border p-4 text-muted-foreground text-sm">
                A timeline of recent events, deployments, and member changes.
              </TabsContent>
              <TabsContent value="settings" className="rounded-md border p-4 text-muted-foreground text-sm">
                Workspace settings, billing, members and integrations.
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Accordion</p>
            <Accordion type="single" collapsible defaultValue="a1" className="rounded-md border">
              <AccordionItem value="a1">
                <AccordionTrigger className="px-4">Is it accessible?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground text-sm">
                  Yes. It adheres to the WAI-ARIA design pattern.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="a2">
                <AccordionTrigger className="px-4">Can I theme it?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground text-sm">
                  Yes — use the Customize panel to switch palettes and density.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="a3">
                <AccordionTrigger className="px-4">Does it support RTL?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground text-sm">
                  Yes — toggle Direction in Customize.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <SubBlock label="Alerts">
          <div className="grid w-full gap-3 md:grid-cols-2">
            <Alert>
              <AlertTitle>Heads up!</AlertTitle>
              <AlertDescription>You can add components and dependencies via the Customize panel.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Connection lost</AlertTitle>
              <AlertDescription>We couldn't reach the server. Check your network and retry.</AlertDescription>
            </Alert>
          </div>
        </SubBlock>

        <SubBlock label="Skeleton (loading)">
          <div className="w-full space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </SubBlock>
      </div>
    </Section>
  );
}
