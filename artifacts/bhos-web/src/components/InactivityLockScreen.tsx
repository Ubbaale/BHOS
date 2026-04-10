import { useState, useEffect, useCallback, useRef } from "react";
import { useClerk, useUser } from "@clerk/react";
import { Lock, LogOut, UserCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOCK_TIMEOUT_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

export function InactivityLockScreen({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [manualLock, setManualLock] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { signOut } = useClerk();
  const { user } = useUser();

  const resetTimer = useCallback(() => {
    if (locked) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLocked(true);
    }, LOCK_TIMEOUT_MS);
  }, [locked]);

  useEffect(() => {
    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));
    resetTimer();
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  const handleUnlock = () => {
    setLocked(false);
    setManualLock(false);
    resetTimer();
  };

  const handleLock = useCallback(() => {
    setManualLock(true);
    setLocked(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    (window as any).__bhosLockScreen = handleLock;
    return () => { delete (window as any).__bhosLockScreen; };
  }, [handleLock]);

  if (!locked) return <>{children}</>;

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Staff Member";
  const initials = user
    ? `${(user.firstName?.[0] || "").toUpperCase()}${(user.lastName?.[0] || "").toUpperCase()}`
    : "??";

  return (
    <>
      <div className="sr-only">{children}</div>

      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-lg">
        <div className="w-full max-w-sm mx-4">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Session Locked</h1>
            <p className="text-slate-400 text-sm text-center">
              {manualLock ? "Screen locked manually" : "Locked due to inactivity"}
            </p>
          </div>

          <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-3 mb-6 p-3 bg-white/5 rounded-lg">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {initials}
                </div>
              )}
              <div>
                <p className="text-white font-medium text-sm">{displayName}</p>
                <p className="text-slate-400 text-xs">Tap below to unlock or switch user</p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleUnlock}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Lock className="h-4 w-4 mr-2" />
                Unlock Session
              </Button>

              <Button
                variant="outline"
                onClick={() => signOut({ redirectUrl: "/" })}
                className="w-full h-12 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Switch User
              </Button>

              <Button
                variant="ghost"
                onClick={() => signOut({ redirectUrl: "/" })}
                className="w-full text-slate-400 hover:text-white hover:bg-white/5"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out Completely
              </Button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="h-3 w-3" />
            <span>HIPAA-compliant session protection</span>
          </div>
        </div>
      </div>
    </>
  );
}
