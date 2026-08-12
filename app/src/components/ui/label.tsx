import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: The primitive receives its control through htmlFor or nested children.
    <label ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
  ),
);
Label.displayName = "Label";

export { Label };
