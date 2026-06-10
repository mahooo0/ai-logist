"use client";

import * as React from "react";

import { format } from "date-fns";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { type CalendarEvent, type EventColor, eventColorDotClasses, eventColorLabels } from "./event-types";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  editing?: CalendarEvent | null;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

const colorOptions: EventColor[] = ["green", "amber", "rose", "slate"];

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

export function EventDialog({ open, onOpenChange, initialDate, editing, onSave, onDelete }: EventDialogProps) {
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [color, setColor] = React.useState<EventColor>("green");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDate(editing.date);
      setColor(editing.color);
    } else {
      setTitle("");
      setDate(initialDate ?? format(new Date(), "yyyy-MM-dd"));
      setColor("green");
    }
  }, [open, editing, initialDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onSave({
      id: editing?.id ?? newId(),
      title: title.trim(),
      date,
      color,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit event" : "Add event"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update event details below." : "Schedule a new event on the calendar."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team standup"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-date">Date</Label>
            <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                    color === c && "border-primary ring-1 ring-primary",
                  )}
                >
                  <span className={cn("size-2.5 rounded-full", eventColorDotClasses[c])} />
                  <span className="truncate">{eventColorLabels[c]}</span>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {editing && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDelete(editing.id);
                  onOpenChange(false);
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Create event"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
