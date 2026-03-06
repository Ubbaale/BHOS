import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => {
  const [ripple, setRipple] = React.useState(false);

  const handleClick = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 400);
  };

  return (
    <SwitchPrimitives.Root
      className={cn(
        "group peer relative inline-flex h-[20px] w-[56px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:bg-violet-200 dark:data-[state=checked]:bg-violet-800 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600",
        className
      )}
      style={{ WebkitAppearance: 'none', appearance: 'none' }}
      onClick={handleClick}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none relative flex items-center justify-center rounded-full shadow-md transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] data-[state=checked]:h-[28px] data-[state=checked]:w-[28px] data-[state=checked]:translate-x-[28px] data-[state=checked]:bg-violet-600 dark:data-[state=checked]:bg-violet-400 data-[state=unchecked]:h-[22px] data-[state=unchecked]:w-[22px] data-[state=unchecked]:translate-x-[2px] data-[state=unchecked]:bg-white dark:data-[state=unchecked]:bg-gray-300"
        )}
      >
        {ripple && (
          <span className="absolute inset-[-12px] rounded-full bg-violet-500/15 dark:bg-violet-400/20 animate-ripple-out" />
        )}
        <svg
          className="transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[state=checked]:h-[16px] group-data-[state=checked]:w-[16px] group-data-[state=checked]:opacity-100 group-data-[state=unchecked]:h-0 group-data-[state=unchecked]:w-0 group-data-[state=unchecked]:opacity-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  );
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
