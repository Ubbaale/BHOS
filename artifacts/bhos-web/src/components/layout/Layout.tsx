import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";
import { useHealthCheck } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { InactivityLockScreen } from "@/components/InactivityLockScreen";

export function Layout({ children }: { children: ReactNode }) {
  const { data: health } = useHealthCheck();

  return (
    <InactivityLockScreen>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-foreground">
                Behavioral Home Operating System
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {health?.status === "ok" ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  System Online
                </Badge>
              ) : (
                <Badge variant="destructive">System Offline</Badge>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </InactivityLockScreen>
  );
}
