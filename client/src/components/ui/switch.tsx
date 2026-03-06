import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group peer inline-flex h-[32px] w-[52px] shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-400 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-700",
      className
    )}
    style={{ WebkitAppearance: 'none', appearance: 'none' }}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none flex items-center justify-center h-[28px] w-[28px] rounded-full bg-white shadow-lg ring-0 transition-all duration-300 ease-in-out data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-0 data-[state=checked]:scale-100 data-[state=unchecked]:scale-[0.92]"
      )}
    >
      <span className="block h-[10px] w-[10px] rounded-full transition-all duration-300 ease-in-out group-data-[state=checked]:bg-emerald-500 dark:group-data-[state=checked]:bg-emerald-400 group-data-[state=checked]:scale-100 group-data-[state=unchecked]:bg-transparent group-data-[state=unchecked]:scale-0" />
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
