import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Los estilos son los botones en píldora de la referencia North Scale.
export const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "btn-primary",
      outline: "btn-ghost",
      danger: "btn-danger",
    },
    size: {
      default: "",
      sm: "btn-sm",
      block: "btn-block",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
