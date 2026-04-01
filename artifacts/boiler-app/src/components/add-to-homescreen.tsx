import { useState, useEffect, useRef } from "react";
import { Download, X, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DISMISSED_KEY = "twd-a2hs-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
}

function isMobileOrTablet(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

export default function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (!isMobileOrTablet()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIos()) {
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      promptRef.current = promptEvent;
      setDeferredPrompt(promptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const timeout = setTimeout(() => {
      if (!promptRef.current) {
        setVisible(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        dismiss();
      }
      setDeferredPrompt(null);
      promptRef.current = null;
    } else {
      setShowGuide(true);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
    setShowGuide(false);
  };

  if (!visible) return null;

  if (showGuide) {
    return (
      <Card className="p-5 border-blue-200 bg-blue-50/60 shadow-sm relative">
        <button onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Add TradeWorkDesk to your Home Screen</h3>
          {isIos() ? (
            <ol className="text-sm text-muted-foreground space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground shrink-0">1.</span>
                <span>Tap the <Share className="w-4 h-4 inline-block text-blue-600 -mt-0.5" /> <strong>Share</strong> button at the bottom of Safari</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground shrink-0">2.</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground shrink-0">3.</span>
                <span>Tap <strong>"Add"</strong> in the top right corner</span>
              </li>
            </ol>
          ) : (
            <ol className="text-sm text-muted-foreground space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground shrink-0">1.</span>
                <span>Tap the <MoreVertical className="w-4 h-4 inline-block text-blue-600 -mt-0.5" /> <strong>menu</strong> button in Chrome (top right)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground shrink-0">2.</span>
                <span>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground shrink-0">3.</span>
                <span>Tap <strong>"Add"</strong> to confirm</span>
              </li>
            </ol>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-blue-200 bg-blue-50/60 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Add TradeWorkDesk to your home screen for quick access</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="default" onClick={handleInstall} className="text-xs px-3">
            {deferredPrompt ? "Install" : "How"}
          </Button>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
