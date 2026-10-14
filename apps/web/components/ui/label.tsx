import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("font-mono text-[.72rem] uppercase tracking-[.04em] text-mute", className)}
      {...props}
    />
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
