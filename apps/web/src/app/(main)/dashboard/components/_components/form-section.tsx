"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { Section } from "./section";

const schema = z.object({
  fullName: z.string().min(2, "Please enter your name"),
  email: z.email("Enter a valid email"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine((v) => isValidPhoneNumber(v), { message: "Enter a valid phone number" }),
  role: z.enum(["admin", "editor", "viewer"], { error: "Pick a role" }),
  message: z.string().min(10, "Tell us a little more (10+ chars)"),
  agree: z.literal(true, { error: "You must accept the terms" }),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_VALUES: FormValues = {
  fullName: "",
  email: "",
  phone: "",
  role: undefined as unknown as FormValues["role"],
  message: "",
  agree: false as unknown as true,
};

export function FormSection() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
    mode: "onTouched",
  });

  const onSubmit = (values: FormValues) => {
    toast.success("Form submitted", {
      description: `${values.fullName} (${values.role}) — ${values.email} · ${values.phone}`,
    });
    form.reset(EMPTY_VALUES);
  };

  const errors = form.formState.errors;

  return (
    <Section
      id="form"
      title="Form (react-hook-form + zod)"
      description="Validation, error states, controlled select and checkbox."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            placeholder="Ada Lovelace"
            aria-invalid={!!errors.fullName}
            {...form.register("fullName")}
          />
          {errors.fullName && <p className="text-destructive text-xs">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="formEmail">Email</Label>
          <Input
            id="formEmail"
            type="email"
            placeholder="ada@analytical.engine"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <PhoneInput
            id="phone"
            value={form.watch("phone") ?? ""}
            onChange={(v) => form.setValue("phone", v, { shouldValidate: true, shouldTouch: true })}
            aria-invalid={!!errors.phone}
            defaultCountry="AZ"
          />
          {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select onValueChange={(v) => form.setValue("role", v as FormValues["role"], { shouldValidate: true })}>
            <SelectTrigger aria-invalid={!!errors.role}>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && <p className="text-destructive text-xs">{errors.role.message}</p>}
        </div>

        <div className="space-y-2 md:row-span-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            rows={5}
            placeholder="Anything you'd like us to know…"
            aria-invalid={!!errors.message}
            {...form.register("message")}
          />
          {errors.message && <p className="text-destructive text-xs">{errors.message.message}</p>}
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="agree"
            checked={form.watch("agree") === true}
            onCheckedChange={(c) => form.setValue("agree", (c === true) as unknown as true, { shouldValidate: true })}
            aria-invalid={!!errors.agree}
          />
          <div className="space-y-1">
            <Label htmlFor="agree">I accept the terms and conditions</Label>
            {errors.agree && <p className={cn("text-destructive text-xs")}>{errors.agree.message}</p>}
          </div>
        </div>

        <div className="flex items-end justify-end gap-2 md:col-span-2">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Reset
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Submit
          </Button>
        </div>
      </form>
    </Section>
  );
}
