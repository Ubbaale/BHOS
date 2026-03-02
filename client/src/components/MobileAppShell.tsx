import { type ReactNode } from "react";
import { usePlatform } from "@/hooks/use-platform";
import BottomTabBar from "./BottomTabBar";
import { cn } from "@/lib/utils";

interface MobileAppShellProps {
  children: ReactNode;
}

export default function MobileAppShell({ children }: MobileAppShellProps) {
  const { showMobileUI, isIOS, isAndroid, platform } = usePlatform();

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        showMobileUI && "pb-16",
        isIOS && "pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
      )}
      data-platform={platform}
      data-testid="app-shell"
    >
      {children}
      {showMobileUI && <BottomTabBar />}
    </div>
  );
}
