import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications } from "@/hooks/use-notifications";
import { useCapacitorNotifications } from "@/hooks/use-capacitor-notifications";

interface NotificationPromptProps {
  userType: "user" | "driver";
  driverId?: number;
}

export function NotificationPrompt({ userType, driverId }: NotificationPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const webNotifications = useNotifications(userType, driverId);
  const nativeNotifications = useCapacitorNotifications();
  
  const isNative = nativeNotifications.isNative;
  const isSupported = isNative ? nativeNotifications.isSupported : webNotifications.isSupported;
  const permission = isNative ? nativeNotifications.permissionStatus : webNotifications.permission;
  const isSubscribed = isNative 
    ? nativeNotifications.permissionStatus === "granted" && !!nativeNotifications.token
    : webNotifications.isSubscribed;

  useEffect(() => {
    if (isNative && nativeNotifications.token && nativeNotifications.permissionStatus === "granted") {
      nativeNotifications.registerForPush(userType, driverId);
    }
  }, [isNative, nativeNotifications.token, nativeNotifications.permissionStatus, userType, driverId]);

  if (!isSupported || isSubscribed || permission === "denied" || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    if (isNative) {
      const success = await nativeNotifications.requestPermission();
      if (success) {
        setDismissed(true);
      }
    } else {
      const success = await webNotifications.subscribe();
      if (success) {
        setDismissed(true);
      }
    }
  };

  return (
    <Card className="mb-4 border-primary/20 bg-primary/5">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Enable Notifications</p>
            <p className="text-sm text-muted-foreground">
              {userType === "driver"
                ? "Get notified when new ride requests come in"
                : "Get updates about your ride status"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleEnable} size="sm" data-testid="button-enable-notifications">
            Enable
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            data-testid="button-dismiss-notifications"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
