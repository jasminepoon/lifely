import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
  {
    variants: {
      variant: {
        default:
          "bg-accent-cyan text-bg-base shadow-sm hover:bg-accent-cyan/90 active:scale-[0.98]",
        destructive:
          "bg-accent-warm text-text-primary shadow-sm hover:bg-accent-warm/90",
        outline:
          "border border-border-default bg-transparent shadow-sm hover:bg-bg-elevated hover:border-border-active",
        secondary:
          "bg-bg-elevated text-text-primary shadow-sm hover:bg-bg-elevated/80",
        ghost:
          "hover:bg-bg-elevated hover:text-text-primary",
        link:
          "text-accent-cyan underline-offset-4 hover:underline",
        glow:
          "bg-accent-cyan text-bg-base shadow-sm hover:bg-accent-cyan/90 active:scale-[0.98] glow-cyan pulse-glow",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-lg px-8 text-base has-[>svg]:px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
