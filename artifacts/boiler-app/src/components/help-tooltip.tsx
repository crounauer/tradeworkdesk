import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string | ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function HelpTooltip({ content, className, side = "top" }: HelpTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-slate-100 transition-colors shrink-0",
            className
          )}
          aria-label="Help"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm leading-relaxed" side={side}>
        {typeof content === "string" ? <p>{content}</p> : content}
      </PopoverContent>
    </Popover>
  );
}
