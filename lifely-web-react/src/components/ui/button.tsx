import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
  {
    variants: {
      variant: {
        default:
          "bg-cyan-400 text-slate-900 shadow-sm hover:bg-cyan-400/90 active:scale-[0.98]",
        destructive:
          "bg-red-400 text-white shadow-sm hover:bg-red-400/90",
        outline:
          "border border-white/10 bg-transparent shadow-sm hover:bg-gray-800 hover:border-cyan-400/40",
        secondary:
          "bg-gray-800 text-white shadow-sm hover:bg-gray-800/80",
        ghost:
          "hover:bg-gray-800 hover:text-white",
        link:
          "text-cyan-400 underline-offset-4 hover:underline",
        glow:
          "bg-cyan-400 text-slate-900 shadow-sm hover:bg-cyan-400/90 active:scale-[0.98] shadow-[0_0_20px_rgba(0,212,255,0.4)]",
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

export { Button }
