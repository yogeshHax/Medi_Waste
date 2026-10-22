"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error("Sheet components must be used within Sheet");
  return ctx;
}

export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Sheet = React.forwardRef<HTMLDivElement, SheetProps>(
  ({ className, open: controlledOpen, onOpenChange, children, ...props }, ref) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = React.useCallback(
      (next: boolean) => {
        if (!isControlled) setUncontrolledOpen(next);
        onOpenChange?.(next);
      },
      [isControlled, onOpenChange]
    );

    return (
      <SheetContext.Provider value={{ open, setOpen }}>
        <div
          ref={ref}
          className={cn(
            "fixed inset-0 z-50 flex",
            open && "visible",
            !open && "invisible",
            className
          )}
          {...props}
        >
          {/* Backdrop */}
          {open && (
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={() => setOpen(false)}
              aria-hidden
            />
          )}
          {/* Panel */}
          <div
            className={cn(
              "relative z-50 w-full max-w-lg bg-white shadow-xl transition-transform",
              open ? "translate-x-0" : "translate-x-full",
              className
            )}
          >
            {children}
          </div>
        </div>
      </SheetContext.Provider>
    );
  }
);
Sheet.displayName = "Sheet";

export interface SheetTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { setOpen } = useSheet();
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-medical-500 focus:ring-offset-2",
          className
        )}
        onClick={() => setOpen(true)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
SheetTrigger.displayName = "SheetTrigger";

export interface SheetCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SheetClose = React.forwardRef<HTMLButtonElement, SheetCloseProps>(
  ({ className, children, ...props }, ref) => {
    const { setOpen } = useSheet();
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:ring-offset-2 disabled:pointer-events-none",
          className
        )}
        onClick={() => setOpen(false)}
        {...props}
      >
        {children ?? <X className="h-4 w-4" />}
      </button>
    );
  }
);
SheetClose.displayName = "SheetClose";

export interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const SheetHeader = React.forwardRef<HTMLDivElement, SheetHeaderProps>(
  ({ className, ...props }, ref) => {
    const { setOpen } = useSheet();
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col space-y-2 border-b border-slate-200 px-6 py-4",
          className
        )}
        {...props}
      />
    );
  }
);
SheetHeader.displayName = "SheetHeader";

export interface SheetTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

const SheetTitle = React.forwardRef<HTMLHeadingElement, SheetTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-semibold text-slate-900", className)}
      {...props}
    />
  )
);
SheetTitle.displayName = "SheetTitle";

export interface SheetDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

const SheetDescription = React.forwardRef<HTMLParagraphElement, SheetDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-slate-500", className)}
      {...props}
    />
  )
);
SheetDescription.displayName = "SheetDescription";

export interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col max-h-[calc(100%-2rem)] overflow-auto p-6", className)}
      {...props}
    >
      {children}
    </div>
  )
);
SheetContent.displayName = "SheetContent";

export interface SheetFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const SheetFooter = React.forwardRef<HTMLDivElement, SheetFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 border-t border-slate-200 px-6 py-4",
        className
      )}
      {...props}
    />
  )
);
SheetFooter.displayName = "SheetFooter";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetContent,
  SheetFooter,
};
