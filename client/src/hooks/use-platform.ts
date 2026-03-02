import { useState, useEffect } from "react";

export type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function checkStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://") ||
    (window as any).Capacitor !== undefined
  );
}

function checkMobile(): boolean {
  return window.innerWidth < 768;
}

export function usePlatform() {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const [isStandalone, setIsStandalone] = useState(checkStandalone);
  const [isMobile, setIsMobile] = useState(checkMobile);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(checkMobile());
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches || (window.navigator as any).standalone === true);
    };

    window.addEventListener("resize", handleResize);
    mediaQuery.addEventListener("change", handleDisplayChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      mediaQuery.removeEventListener("change", handleDisplayChange);
    };
  }, []);

  const isNativeApp = isStandalone || (window as any).Capacitor !== undefined;
  const showMobileUI = isMobile || isNativeApp;

  return {
    platform,
    isStandalone,
    isMobile,
    isNativeApp,
    showMobileUI,
    isIOS: platform === "ios",
    isAndroid: platform === "android",
  };
}
