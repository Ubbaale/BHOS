import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Share2, Copy, Check, MessageCircle, Mail, MessageSquare, Link2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

interface ShareMenuProps {
  title: string;
  text: string;
  url: string;
  variant?: "ghost" | "outline" | "default" | "secondary";
  size?: "sm" | "default" | "icon";
  className?: string;
  testId?: string;
}

function getBaseUrl() {
  if (typeof window !== "undefined") {
    const prodDomain = "app.carehubapp.com";
    if (window.location.hostname.includes("carehubapp.com")) {
      return `https://${prodDomain}`;
    }
    return window.location.origin;
  }
  return "";
}

export function buildShareUrl(path: string) {
  return `${getBaseUrl()}${path}`;
}

export function ShareMenu({ title, text, url, variant = "ghost", size = "icon", className = "", testId }: ShareMenuProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const fullUrl = url.startsWith("http") ? url : buildShareUrl(url);
  const shareText = `${text}\n\n${fullUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = fullUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleSMS = () => {
    window.open(`sms:?body=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleEmail = () => {
    window.open(
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareText)}`,
      "_blank"
    );
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: fullUrl });
      } catch {}
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} data-testid={testId || "button-share"}>
          <Share2 className="w-4 h-4" />
          {size !== "icon" && <span className="ml-1.5">Share</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Share via</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer gap-2" data-testid="share-whatsapp">
          <SiWhatsapp className="w-4 h-4 text-green-500" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSMS} className="cursor-pointer gap-2" data-testid="share-sms">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          Text Message (SMS)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="cursor-pointer gap-2" data-testid="share-email">
          <Mail className="w-4 h-4 text-orange-500" />
          Email
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer gap-2" data-testid="share-copy-link">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
          <DropdownMenuItem onClick={handleNativeShare} className="cursor-pointer gap-2" data-testid="share-native">
            <Share2 className="w-4 h-4" />
            More Options...
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface InviteShareProps {
  role: "driver" | "patient" | "it_tech" | "courier" | "general";
}

export function InviteShareButton({ role }: InviteShareProps) {
  const roleConfig: Record<string, { path: string; title: string; text: string }> = {
    driver: {
      path: "/driver/apply",
      title: "Drive with CareHub",
      text: "Join CareHub as a medical transport driver! Earn money providing safe rides to patients. Apply here:",
    },
    patient: {
      path: "/signup",
      title: "Book Medical Rides on CareHub",
      text: "Need reliable rides to your medical appointments? Sign up for CareHub — safe, affordable medical transportation:",
    },
    it_tech: {
      path: "/it-tech/apply",
      title: "IT Tech Jobs on CareHub",
      text: "Join CareHub as a healthcare IT technician! Get matched with IT service jobs at medical facilities. Apply here:",
    },
    courier: {
      path: "/courier/onboard",
      title: "Medical Courier on CareHub",
      text: "Start a medical courier company on CareHub! Dispatch deliveries for medications, lab samples, and more:",
    },
    general: {
      path: "/signup",
      title: "Join CareHub",
      text: "CareHub — healthcare staffing, medical transportation, IT services, and medical courier delivery. Sign up here:",
    },
  };

  const config = roleConfig[role] || roleConfig.general;

  return (
    <ShareMenu
      title={config.title}
      text={config.text}
      url={config.path}
      variant="outline"
      size="sm"
      testId={`button-invite-${role}`}
    />
  );
}
