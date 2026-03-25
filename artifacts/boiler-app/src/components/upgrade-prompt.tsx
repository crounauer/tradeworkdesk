import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CreditCard, ArrowRight } from "lucide-react";
import { FEATURE_LABELS } from "@/hooks/use-plan-features";

interface UpgradePromptProps {
  feature: string;
  title?: string;
  description?: string;
}

export function UpgradePrompt({ feature, title, description }: UpgradePromptProps) {
  const featureLabel = FEATURE_LABELS[feature] || feature.replace(/_/g, " ");

  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold">
          {title || `${featureLabel} Not Available`}
        </h2>
        <p className="text-muted-foreground text-sm">
          {description || `Your current plan doesn't include ${featureLabel.toLowerCase()}. Upgrade your plan to unlock this feature and more.`}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/billing">
            <Button className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              View Plans & Upgrade
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="w-full text-muted-foreground">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
