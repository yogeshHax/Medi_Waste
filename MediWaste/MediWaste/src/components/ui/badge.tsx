import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "medical";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
          {
            "bg-slate-100 text-slate-700": variant === "default",
            "bg-slate-800 text-slate-100": variant === "secondary",
            "bg-green-100 text-green-700": variant === "success",
            "bg-amber-100 text-amber-700": variant === "warning",
            "bg-red-100 text-red-700": variant === "destructive",
            "bg-medical-100 text-medical-700": variant === "medical",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
