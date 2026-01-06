import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

interface BackToHomeProps {
  className?: string;
}

export default function BackToHome({ className = "" }: BackToHomeProps) {
  return (
    <Link href="/">
      <Button variant="ghost" size="sm" className={className} data-testid="button-back-home">
        <Home className="w-4 h-4 mr-2" />
        Home
      </Button>
    </Link>
  );
}
