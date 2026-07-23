import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Link } from "wouter";
import {
  Plus,
  Send,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
  Share2,
  RefreshCw,
  ArrowRight,
  Pencil,
} from "lucide-react";

const PLATFORMS = [
  { value: "x", label: "X (Twitter)", color: "bg-black text-white" },
  { value: "facebook", label: "Facebook", color: "bg-blue-600 text-white" },
  { value: "instagram", label: "Instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500 text-white" },
  { value: "google_business", label: "Google Business", color: "bg-red-500 text-white" },
];

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  scheduled: { label: "Scheduled", variant: "default", icon: Calendar },
  posted: { label: "Posted", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  dismissed: { label: "Dismissed", variant: "outline", icon: XCircle },
};

const POST_TYPE_OPTIONS = [
  { value: "business", label: "Business Post" },
  { value: "website_promotion", label: "Website Promotion Post" },
] as const;

const SOCIAL_ACCOUNT_CREDENTIAL_FIELDS: Record<string, { key: string; label: string }[]> = {
  x: [
    { key: "appKey", label: "App Key" },
    { key: "appSecret", label: "App Secret" },
    { key: "accessToken", label: "Access Token" },
    { key: "accessSecret", label: "Access Secret" },
  ],
  facebook: [{ key: "accessToken", label: "Page Access Token" }],
  instagram: [{ key: "accessToken", label: "Page Access Token" }],
  google_business: [
    { key: "clientId", label: "OAuth Client ID" },
    { key: "clientSecret", label: "OAuth Client Secret" },
    { key: "refreshToken", label: "OAuth Refresh Token" },
  ],
};

const SOCIAL_ACCOUNT_EXPLAINERS: Record<string, {
  title: string;
  intro: string;
  checklist: string[];
  steps: string[];
  fieldMapping: { field: string; value: string }[];
  docsUrl: string;
  quickLinks: { label: string; url: string }[];
}> = {
  x: {
    title: "X (Twitter) setup",
    intro: "Follow these steps to connect one X account so TradeWorkDesk can publish posts for you.",
    checklist: [
      "You can sign in to the X account you want to post from.",
      "You can access developer.x.com with that same account.",
      "You have somewhere safe to temporarily paste keys during setup.",
    ],
    steps: [
      "Open X Developer Portal, then go to Projects & Apps and open your app.",
      "If you do not have an app yet, create one and complete its basic setup.",
      "Open Keys and tokens and copy API Key and API Key Secret.",
      "In User authentication settings, enable OAuth 1.0a and set permission to Read and write.",
      "Generate Access Token and Access Token Secret under Authentication Tokens.",
      "Copy each value exactly, then paste them into the matching fields in this form.",
    ],
    fieldMapping: [
      { field: "Profile Name", value: "Your X handle, for example @tradeworkdesk" },
      { field: "App Key", value: "X API Key / Consumer Key" },
      { field: "App Secret", value: "X API Key Secret / Consumer Secret" },
      { field: "Access Token", value: "OAuth Access Token" },
      { field: "Access Secret", value: "OAuth Access Token Secret" },
    ],
    docsUrl: "https://developer.x.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api",
    quickLinks: [
      { label: "X Developer Portal", url: "https://developer.x.com/en/portal/dashboard" },
      { label: "X API Access Guide", url: "https://developer.x.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api" },
    ],
  },
  facebook: {
    title: "Facebook setup",
    intro: "Use Meta Developer tools to get a Page Access Token and Page ID for the page you want to publish to.",
    checklist: [
      "You are an admin of the Facebook page you want to connect.",
      "You can log in to Meta for Developers with the same account.",
      "You are ready to create a Meta app and choose the correct use case during setup.",
    ],
    steps: [
      "Open Meta for Developers and click Create app if you do not already have one.",
      "On the Use cases step, choose Authenticate and request data from users with Facebook Login, then continue.",
      "Complete the remaining Create app steps until Meta opens your app dashboard like the screen you are on now.",
      "On this dashboard, click Customize the Authenticate and request data from users with Facebook Login use case.",
      "If Meta asks for basic setup details, complete only the minimum required fields and save. You do not need to finish business verification before testing your own page.",
      "You do not need to look for a separate Pages API product on this screen.",
      "If you land on the Permissions and features page showing items like email and public_profile, do not start adding those permissions for this setup.",
      "Those are Facebook user profile permissions, and they are not the main thing you need for posting to your own page from TradeWorkDesk.",
      "Leave this permissions list as it is, then use the top menu to open Tools -> Graph API Explorer instead.",
      "From the top menu, open Tools -> Graph API Explorer.",
      "On the Graph API Explorer screen, make sure your app is selected in the Meta App dropdown on the right.",
      "In the User or Page dropdown, choose User Token if it is not already selected.",
      "If the access token box is empty, first use Add a Permission to add pages_show_list, pages_read_engagement, and pages_manage_posts.",
      "Then click Generate Access Token and complete the Facebook permission popup using the same Facebook account that manages your page.",
      "After the popup closes, confirm a user token now appears in the Access Token box.",
      "If Generate Access Token does nothing, allow popups for developers.facebook.com and click it again.",
      "If Meta shows permission/role errors, make sure your Facebook user is added under App roles (at least Developer) and is an admin of the target page.",
      "If only public_profile appears, add pages_show_list, pages_read_engagement, and pages_manage_posts again, then regenerate the user token.",
      "Keep User Token selected for now, then check that pages_show_list, pages_read_engagement, and pages_manage_posts appear in the Permissions list.",
      "If one of those permissions is missing, use Add a Permission to add it before continuing.",
      "In the request path box at the top, replace the current value with me/accounts.",
      "Leave the method as GET, then click Submit.",
      "This response should list the Facebook pages you manage. Find the correct page in the response.",
      "Copy id (Page ID) and access_token (Page Access Token) for your target page.",
      "Copy the page name shown in the same response so you can paste that into Page Name.",
      "Optional: open Access Token Debugger and extend token lifetime once basic posting works.",
      "You can ignore App Review and Publish for now if you are only testing with a page you already manage yourself.",
      "Paste Page ID, Page Name, and Page Access Token into this form.",
    ],
    fieldMapping: [
      { field: "Profile Name", value: "Friendly label, for example TradeWorkDesk Facebook" },
      { field: "Page ID", value: "The id returned for your page in me/accounts" },
      { field: "Page Name", value: "Exact page title shown on Facebook" },
      { field: "Page Access Token", value: "The page access_token from me/accounts" },
    ],
    docsUrl: "https://developers.facebook.com/docs/pages-api",
    quickLinks: [
      { label: "Meta for Developers", url: "https://developers.facebook.com/" },
      { label: "Graph API Explorer", url: "https://developers.facebook.com/tools/explorer/" },
      { label: "Access Token Debugger", url: "https://developers.facebook.com/tools/debug/accesstoken/" },
      { label: "Pages API Docs", url: "https://developers.facebook.com/docs/pages-api" },
    ],
  },
  instagram: {
    title: "Instagram setup",
    intro: "Instagram posting works through Meta Graph API and requires an Instagram Business or Creator account.",
    checklist: [
      "Your Instagram account is Business or Creator (not Personal).",
      "That Instagram account is connected to a Facebook page you manage.",
      "You can generate page tokens in Graph API Explorer.",
    ],
    steps: [
      "In Instagram app, switch to Business or Creator account if needed.",
      "In Meta settings, connect Instagram to a Facebook page.",
      "In Graph API Explorer, run me/accounts and copy page id, page name, and page access_token.",
      "Run query /{page-id}?fields=instagram_business_account and copy instagram_business_account.id.",
      "Use the page access token from the linked page in this form.",
      "Paste all values below and save.",
    ],
    fieldMapping: [
      { field: "Profile Name", value: "Friendly label, for example TradeWorkDesk Instagram" },
      { field: "Page ID", value: "Facebook page id linked to Instagram" },
      { field: "Page Name", value: "Facebook page name linked to Instagram" },
      { field: "Instagram Business ID", value: "instagram_business_account.id from Graph API" },
      { field: "Page Access Token", value: "Page access_token from the linked Facebook page" },
    ],
    docsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    quickLinks: [
      { label: "Instagram API Getting Started", url: "https://developers.facebook.com/docs/instagram-api/getting-started" },
      { label: "Meta Graph API Explorer", url: "https://developers.facebook.com/tools/explorer/" },
    ],
  },
  google_business: {
    title: "Google Business setup",
    intro: "Google Business publishing needs OAuth credentials and a refresh token for long-term access.",
    checklist: [
      "You can access Google Cloud Console for the same Google account that manages your profile.",
      "Business Profile APIs are enabled in your Google Cloud project.",
      "You can complete OAuth consent and generate a refresh token.",
    ],
    steps: [
      "Create or open a Google Cloud project.",
      "Enable Business Profile APIs in API Library.",
      "Configure OAuth consent screen and add yourself as a test user if needed.",
      "Create OAuth Client credentials and copy client id and client secret.",
      "Complete OAuth flow to obtain a refresh token.",
      "Call accounts.list and copy the account resource name, for example accounts/123456.",
      "Call locations.list and copy one location resource name, for example locations/789012.",
      "Paste all values into this form and save.",
    ],
    fieldMapping: [
      { field: "Profile Name", value: "Friendly label, for example TradeWorkDesk Google Business" },
      { field: "Account Name", value: "accounts/123456 style resource name" },
      { field: "Business Name", value: "Display name for the selected business profile" },
      { field: "Location ID", value: "locations/789012 style resource name" },
      { field: "OAuth Client ID", value: "Client ID from Google Cloud Console" },
      { field: "OAuth Client Secret", value: "Client secret from Google Cloud Console" },
      { field: "OAuth Refresh Token", value: "Refresh token from OAuth flow" },
    ],
    docsUrl: "https://developers.google.com/my-business/content/get-started",
    quickLinks: [
      { label: "Google Business Profile API Docs", url: "https://developers.google.com/my-business/content/get-started" },
      { label: "Google Cloud Console", url: "https://console.cloud.google.com/" },
      { label: "Google OAuth Playground", url: "https://developers.google.com/oauthplayground/" },
    ],
  },
};

function getPostTypeBadge(postType?: string) {
  if (postType === "website_promotion") {
    return <Badge variant="outline">Website Promotion</Badge>;
  }
  return <Badge variant="secondary">Business</Badge>;
}

type SocialContextResponse = {
  scope: "platform_marketing" | "tenant_business";
  socialChannels: string[];
  postTypes: string[];
  permissions: string[];
  aiHelper?: {
    enabled: boolean;
    reason: string | null;
    creditsRemaining?: number | null;
    bundleSize?: number | null;
  };
  websitePromotion: {
    enabled: boolean;
    disabledMessage: string | null;
  };
};

type WebsitePageOption = {
  id: string;
  title: string | null;
  slug: string;
  status: string;
  pageUrl: string | null;
};

type WebsitePagesResponse = {
  enabled: boolean;
  disabledMessage: string | null;
  pages: WebsitePageOption[];
};

function getPlatformBadge(platform: string) {
  const p = PLATFORMS.find((pl) => pl.value === platform);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p?.color || "bg-gray-200"}`}>
      {p?.label || platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <Badge variant="outline">{status}</Badge>;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

interface CreatePostDialogProps {
  onCreated: () => void;
  initialContent?: string;
  initialPlatform?: string;
  initialScheduled?: boolean;
  triggerButton?: React.ReactNode;
}

function CreatePostDialog({ onCreated, initialContent, initialPlatform, initialScheduled, triggerButton }: CreatePostDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(initialPlatform ? [initialPlatform] : ["facebook"]),
  );
  const [postType, setPostType] = useState<"business" | "website_promotion">("business");
  const [content, setContent] = useState(initialContent || "");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [websitePageId, setWebsitePageId] = useState("");
  const [utmSource, setUtmSource] = useState("facebook");
  const [utmMedium, setUtmMedium] = useState("social");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [isScheduled, setIsScheduled] = useState(initialScheduled || false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [aiHelperPrompt, setAiHelperPrompt] = useState("");
  const [generatingAiHelper, setGeneratingAiHelper] = useState(false);
  const [aiHelperProgress, setAiHelperProgress] = useState(0);
  const [imageProgress, setImageProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!generatingAiHelper) {
      setAiHelperProgress(0);
      return;
    }

    setAiHelperProgress(12);
    const id = window.setInterval(() => {
      setAiHelperProgress((current) => {
        if (current >= 90) return current;
        return Math.min(90, current + Math.max(3, Math.round((100 - current) / 8)));
      });
    }, 350);

    return () => window.clearInterval(id);
  }, [generatingAiHelper]);

  useEffect(() => {
    if (!generatingImage) {
      setImageProgress(0);
      return;
    }

    setImageProgress(15);
    const id = window.setInterval(() => {
      setImageProgress((current) => {
        if (current >= 90) return current;
        return Math.min(90, current + Math.max(4, Math.round((100 - current) / 7)));
      });
    }, 300);

    return () => window.clearInterval(id);
  }, [generatingImage]);

  const { data: socialContext } = useQuery<SocialContextResponse>({
    queryKey: ["social-context"],
    queryFn: () => apiFetch("/admin/social/context"),
  });

  const { data: websitePagesData } = useQuery<WebsitePagesResponse>({
    queryKey: ["social-website-pages"],
    queryFn: () => apiFetch("/admin/social/website-pages"),
  });

  const websitePages = websitePagesData?.pages || [];
  const selectedPage = websitePages.find((p) => p.id === websitePageId) || null;
  const effectiveLinkPreview = selectedPage?.pageUrl || "";

  const canUseWebsitePromotion = !!websitePagesData?.enabled;
  const websitePromotionMessage = websitePagesData?.disabledMessage || socialContext?.websitePromotion?.disabledMessage;
  const isWebsitePromotion = postType === "website_promotion";

  const selectedPlatformsArray = Array.from(selectedPlatforms);
  const websitePromotionHasExtraLinks =
    isWebsitePromotion && !!selectedPage?.pageUrl && !content.includes(selectedPage.pageUrl);

  const createMutation = useMutation({
    mutationFn: async () => {
      const scheduledFor = isScheduled && scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : undefined;

      const platforms = Array.from(selectedPlatforms);
      const results = [];
      for (const platform of platforms) {
        const result = await apiFetch("/admin/social/post", {
          method: "POST",
          body: JSON.stringify({
            platform,
            content,
            imageUrl: imageUrl || undefined,
            linkUrl: postType === "business" ? (linkUrl || undefined) : undefined,
            scheduledFor,
            postType,
            websitePageId: postType === "website_promotion" ? websitePageId : undefined,
            utmSource: postType === "website_promotion" ? utmSource : undefined,
            utmMedium: postType === "website_promotion" ? utmMedium : undefined,
            utmCampaign: postType === "website_promotion" ? utmCampaign || undefined : undefined,
            utmContent: postType === "website_promotion" ? utmContent || undefined : undefined,
          }),
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      const count = selectedPlatforms.size;
      toast({ title: isScheduled ? `${count} post(s) scheduled` : `${count} post(s) published` });
      setOpen(false);
      resetForm();
      onCreated();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedPlatforms(new Set(initialPlatform ? [initialPlatform] : ["facebook"]));
    setPostType("business");
    setContent(initialContent || "");
    setImageUrl("");
    setLinkUrl("");
    setWebsitePageId("");
    setUtmSource("facebook");
    setUtmMedium("social");
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const scopeTag = socialContext?.scope === "platform_marketing" ? "platform" : "tenant";
    setUtmCampaign(`website_promotion-${scopeTag}-${date}`);
    setUtmContent("");
    setIsScheduled(initialScheduled || false);
    setScheduledDate("");
    setScheduledTime("");
    setImagePrompt("");
  };

  const togglePlatform = (value: string) => {
    if (isWebsitePromotion && value !== "facebook") return;

    const next = new Set(selectedPlatforms);
    if (next.has(value)) {
      if (next.size > 1) next.delete(value);
    } else {
      next.add(value);
    }
    setSelectedPlatforms(next);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt) return;
    setGeneratingImage(true);
    try {
      const result = await apiFetch("/admin/social/generate-image", {
        method: "POST",
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      setImageProgress(100);
      setImageUrl(result.url);
      toast({ title: "Image generated" });
    } catch (err) {
      toast({ title: "Image generation failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateWithAiHelper = async () => {
    const prompt = aiHelperPrompt.trim() || content.trim();
    if (!prompt) {
      toast({ title: "Add a prompt", description: "Describe the post you want AI Helper to create.", variant: "destructive" });
      return;
    }

    setGeneratingAiHelper(true);
    try {
      const result = await apiFetch("/admin/social/ai-helper", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          includeImage: true,
        }),
      });

      setAiHelperProgress(100);
      if (result.content) setContent(result.content);
      if (result.imageUrl) setImageUrl(result.imageUrl);
      if (Array.isArray(result.platforms) && result.platforms.length > 0) {
        setSelectedPlatforms(new Set(result.platforms));
      }

      toast({ title: "AI Helper ready", description: "Content and image generated for your connected channels." });
    } catch (err) {
      toast({ title: "AI Helper failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGeneratingAiHelper(false);
    }
  };

  const handlePostTypeChange = (value: "business" | "website_promotion") => {
    if (value === "website_promotion" && !canUseWebsitePromotion) return;
    setPostType(value);
    if (value === "website_promotion") {
      setSelectedPlatforms(new Set(["facebook"]));
      if (!utmCampaign) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const scopeTag = socialContext?.scope === "platform_marketing" ? "platform" : "tenant";
        setUtmCampaign(`website_promotion-${scopeTag}-${date}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-lg lg:max-w-4xl xl:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Social Media Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          <div>
            <Label className="mb-2 block">Post Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {POST_TYPE_OPTIONS.map((option) => {
                const disabled = option.value === "website_promotion" && !canUseWebsitePromotion;
                const isActive = postType === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    disabled={disabled}
                    onClick={() => handlePostTypeChange(option.value)}
                    className="justify-start"
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            {!canUseWebsitePromotion && websitePromotionMessage && (
              <p className="text-xs text-muted-foreground mt-2">{websitePromotionMessage}</p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  disabled={isWebsitePromotion && p.value !== "facebook"}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    selectedPlatforms.has(p.value)
                      ? `${p.color} border-transparent`
                      : "bg-muted text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {isWebsitePromotion && (
              <p className="text-xs text-muted-foreground mt-2">Website Promotion Post currently publishes to Facebook only.</p>
            )}
          </div>

          <div>
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post content..."
              rows={4}
            />
            {selectedPlatforms.has("x") && (
              <p className={`text-xs mt-1 ${content.length > 280 ? "text-red-500" : "text-muted-foreground"}`}>
                {content.length}/280 characters (X limit)
              </p>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">AI Helper</Label>
              <div className="flex items-center gap-2">
                {socialContext?.aiHelper?.enabled && typeof socialContext?.aiHelper?.creditsRemaining === "number" && (
                  <span className={`text-xs ${socialContext.aiHelper.creditsRemaining <= 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                    AI credits: {socialContext.aiHelper.creditsRemaining.toLocaleString()}
                  </span>
                )}
                {!socialContext?.aiHelper?.enabled && (
                  <span className="text-xs text-muted-foreground">Unavailable</span>
                )}
              </div>
            </div>
            <Input
              value={aiHelperPrompt}
              onChange={(e) => setAiHelperPrompt(e.target.value)}
              placeholder="Describe the post campaign, offer, or message to promote..."
              disabled={!socialContext?.aiHelper?.enabled || generatingAiHelper}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Generates post copy for connected channels and creates an image.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateWithAiHelper}
                disabled={!socialContext?.aiHelper?.enabled || generatingAiHelper}
              >
                {generatingAiHelper ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                Generate
              </Button>
            </div>
            {!socialContext?.aiHelper?.enabled && socialContext?.aiHelper?.reason && (
              <p className="text-xs text-muted-foreground">{socialContext.aiHelper.reason}</p>
            )}
            {generatingAiHelper && (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI Helper is generating content and image...
                </div>
                <Progress value={aiHelperProgress} className="h-1.5" />
              </div>
            )}
          </div>

          <div>
            <Label>Image URL (optional)</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image to generate..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateImage}
                disabled={generatingImage || !imagePrompt}
              >
                {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              </Button>
            </div>
            {generatingImage && (
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating image...
                </div>
                <Progress value={imageProgress} className="h-1.5" />
              </div>
            )}
          </div>

          {postType === "business" ? (
            <div>
              <Label>Link URL (optional)</Label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          ) : (
            <>
              <div>
                <Label>Website Page</Label>
                <Select value={websitePageId} onValueChange={setWebsitePageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a published website page" />
                  </SelectTrigger>
                  <SelectContent>
                    {websitePages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.title || page.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPage?.pageUrl && (
                  <p className="text-xs text-muted-foreground mt-2">Selected URL: {selectedPage.pageUrl}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <Label>UTM Settings (editable)</Label>
                  <p className="text-[11px] leading-4 text-muted-foreground text-right max-w-[260px]">
                    UTM tags track where clicks came from: source (platform), medium (channel), campaign (promotion), content (variation).
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="utm_source" />
                  <Input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="utm_medium" />
                  <Input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="utm_campaign" />
                  <Input value={utmContent} onChange={(e) => setUtmContent(e.target.value)} placeholder="utm_content (optional)" />
                </div>
                {effectiveLinkPreview && (
                  <p className="text-xs text-muted-foreground">Facebook link target will be built from selected page + UTM values.</p>
                )}
                {websitePromotionHasExtraLinks && (
                  <p className="text-xs text-amber-600">Selected page URL is not present in the message body. This is allowed, but review before publishing.</p>
                )}
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
            <Label>Schedule for later</Label>
          </div>

          {isScheduled && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-32"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending
              || !content
              || selectedPlatforms.size === 0
              || (postType === "website_promotion" && !websitePageId)
            }
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isScheduled ? (
              <><Calendar className="w-4 h-4 mr-2" /> Schedule ({selectedPlatformsArray.length})</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Publish ({selectedPlatformsArray.length})</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectAccountDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("facebook");
  const [profileName, setProfileName] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [instagramBusinessId, setInstagramBusinessId] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiFetch("/admin/social/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform,
          profileName,
          credentials,
          pageId: pageId || undefined,
          pageName: pageName || undefined,
          instagramBusinessId: instagramBusinessId || undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Account connected" });
      setOpen(false);
      resetForm();
      onCreated();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setPlatform("facebook");
    setProfileName("");
    setPageId("");
    setPageName("");
    setInstagramBusinessId("");
    setCredentials({});
  };

  const activeExplainer = SOCIAL_ACCOUNT_EXPLAINERS[platform];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Connect Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Social Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); setCredentials({}); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeExplainer && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-sm font-medium">{activeExplainer.title}</p>
              <p className="text-xs text-muted-foreground">{activeExplainer.intro}</p>
              <div>
                <p className="text-xs font-semibold">Before you start</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground mt-1">
                  {activeExplainer.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold">Step-by-step</p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground mt-1">
                  {activeExplainer.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold">What to paste in this form</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground mt-1">
                  {activeExplainer.fieldMapping.map((item) => (
                    <li key={item.field}>
                      <span className="font-medium text-foreground">{item.field}:</span> {item.value}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={activeExplainer.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Official setup docs
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="pt-1 space-y-1">
                {activeExplainer.quickLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-primary hover:underline break-all"
                  >
                    {link.label}: {link.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Profile Name</Label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="@username or page name"
            />
          </div>

          {(platform === "facebook" || platform === "instagram" || platform === "google_business") && (
            <>
              <div>
                <Label>
                  {platform === "google_business" ? "Account Name (e.g. accounts/123456)" : "Page ID"}
                </Label>
                <Input
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder={platform === "google_business" ? "accounts/123456" : "Facebook Page ID"}
                />
                {platform !== "google_business" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: in Meta Graph API Explorer, query /{"{page-name}"}?fields=id to confirm Page ID.
                  </p>
                )}
              </div>
              <div>
                <Label>
                  {platform === "google_business" ? "Business Name" : "Page Name"}
                </Label>
                <Input
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder="Page display name"
                />
              </div>
            </>
          )}

          {(platform === "instagram" || platform === "google_business") && (
            <div>
              <Label>
                {platform === "google_business" ? "Location ID (e.g. locations/789012)" : "Instagram Business ID"}
              </Label>
              <Input
                value={instagramBusinessId}
                onChange={(e) => setInstagramBusinessId(e.target.value)}
                placeholder={platform === "google_business" ? "locations/789012" : "Instagram Business Account ID"}
              />
              {platform === "instagram" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tip: query /{"{page-id}"}?fields=instagram_business_account in Graph API Explorer.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Credentials</Label>
            {(SOCIAL_ACCOUNT_CREDENTIAL_FIELDS[platform] || []).map((field) => (
              <div key={field.key}>
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <Input
                  type="password"
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.label}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !profileName || Object.values(credentials).some((v) => !v)}
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAccountDialog({
  account,
  onUpdated,
}: {
  account: Record<string, string | boolean>;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [instagramBusinessId, setInstagramBusinessId] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const platform = String(account.platform || "");
  const activeExplainer = SOCIAL_ACCOUNT_EXPLAINERS[platform];
  const credentialFields = SOCIAL_ACCOUNT_CREDENTIAL_FIELDS[platform] || [];

  const hydrateForm = () => {
    setProfileName(String(account.profile_name || ""));
    setPageId(String(account.page_id || ""));
    setPageName(String(account.page_name || ""));
    setInstagramBusinessId(String(account.instagram_business_id || ""));
    setCredentials({});
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const hasAnyCredentialValue = credentialFields.some((field) => (credentials[field.key] || "").trim().length > 0);
      const hasAllCredentialValues = credentialFields.every((field) => (credentials[field.key] || "").trim().length > 0);

      if (hasAnyCredentialValue && !hasAllCredentialValues) {
        throw new Error("To update credentials, fill in every credential field for this platform.");
      }

      return apiFetch(`/admin/social/accounts/${String(account.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          profileName,
          pageId: pageId || null,
          pageName: pageName || null,
          instagramBusinessId: instagramBusinessId || null,
          credentials: hasAllCredentialValues ? credentials : undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Account updated" });
      setOpen(false);
      onUpdated();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) hydrateForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit account">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Social Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Platform</Label>
            <Input value={PLATFORMS.find((p) => p.value === platform)?.label || platform} disabled />
          </div>

          {activeExplainer && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-sm font-medium">{activeExplainer.title}</p>
              <p className="text-xs text-muted-foreground">{activeExplainer.intro}</p>
              <div>
                <p className="text-xs font-semibold">Before you start</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground mt-1">
                  {activeExplainer.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold">Step-by-step</p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground mt-1">
                  {activeExplainer.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold">What to paste in this form</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground mt-1">
                  {activeExplainer.fieldMapping.map((item) => (
                    <li key={item.field}>
                      <span className="font-medium text-foreground">{item.field}:</span> {item.value}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={activeExplainer.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Official setup docs
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="pt-1 space-y-1">
                {activeExplainer.quickLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-primary hover:underline break-all"
                  >
                    {link.label}: {link.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Profile Name</Label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="@username or page name"
            />
          </div>

          {(platform === "facebook" || platform === "instagram" || platform === "google_business") && (
            <>
              <div>
                <Label>
                  {platform === "google_business" ? "Account Name (e.g. accounts/123456)" : "Page ID"}
                </Label>
                <Input
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder={platform === "google_business" ? "accounts/123456" : "Facebook Page ID"}
                />
              </div>
              <div>
                <Label>
                  {platform === "google_business" ? "Business Name" : "Page Name"}
                </Label>
                <Input
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder="Page display name"
                />
              </div>
            </>
          )}

          {(platform === "instagram" || platform === "google_business") && (
            <div>
              <Label>
                {platform === "google_business" ? "Location ID (e.g. locations/789012)" : "Instagram Business ID"}
              </Label>
              <Input
                value={instagramBusinessId}
                onChange={(e) => setInstagramBusinessId(e.target.value)}
                placeholder={platform === "google_business" ? "locations/789012" : "Instagram Business Account ID"}
              />
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Replace Credentials (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Leave all credential fields blank to keep existing credentials unchanged.
            </p>
            {credentialFields.map((field) => (
              <div key={field.key}>
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <Input
                  type="password"
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.label}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !profileName.trim()}
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [postTypeFilter, setPostTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["social-posts", statusFilter, platformFilter, postTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (postTypeFilter !== "all") params.set("postType", postTypeFilter);
      return apiFetch(`/admin/social/posts?${params.toString()}`);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/social/posts/${id}/dismiss`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-posts"] }),
  });

  const posts = data?.posts || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={postTypeFilter} onValueChange={setPostTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Post type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="business">Business Post</SelectItem>
              <SelectItem value="website_promotion">Website Promotion</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CreatePostDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["social-posts"] })} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No posts yet</p>
            <p className="text-sm mt-1">Create your first social media post to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post: Record<string, string>) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getPlatformBadge(post.platform)}
                      {getPostTypeBadge(post.post_type)}
                      <StatusBadge status={post.status} />
                      {post.scheduled_for && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(post.scheduled_for).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">{post.content}</p>
                    {post.website_page_url && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">Website page: {post.website_page_url}</p>
                    )}
                    {post.final_link_url && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">Final URL: {post.final_link_url}</p>
                    )}
                    {post.error && (
                      <p className="text-xs text-red-500 mt-1">Error: {post.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.post_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={post.post_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    {(post.status === "failed" || post.status === "scheduled") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dismissMutation.mutate(post.id)}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionsTab() {
  const queryClient = useQueryClient();
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [bulkInterval, setBulkInterval] = useState("60");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const { toast } = useToast();

  const { data: suggestions, isLoading, refetch } = useQuery({
    queryKey: ["social-suggestions"],
    queryFn: () => apiFetch("/admin/social/suggestions"),
    enabled: false,
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const selected = (suggestions || []).filter((_: unknown, i: number) => selectedSuggestions.has(i));
      return apiFetch("/admin/social/bulk-schedule", {
        method: "POST",
        body: JSON.stringify({
          posts: selected.map((s: Record<string, string>) => ({
            platform: s.platform,
            content: s.content,
            entityType: s.entityType,
            entityId: s.entityId,
          })),
          intervalMinutes: parseInt(bulkInterval, 10),
        }),
      });
    },
    onSuccess: (data: { scheduled: number }) => {
      toast({ title: `${data.scheduled} posts scheduled` });
      setSelectedSuggestions(new Set());
      setShowBulkDialog(false);
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createFromSuggestion = useMutation({
    mutationFn: async (suggestion: Record<string, string>) => {
      return apiFetch("/admin/social/post", {
        method: "POST",
        body: JSON.stringify({
          platform: suggestion.platform,
          content: suggestion.content,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Post created" });
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Suggestions
          </Button>
          {suggestions && suggestions.length > 0 && (
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>

        {selectedSuggestions.size > 0 && (
          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Bulk Schedule ({selectedSuggestions.size})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Schedule Posts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Schedule {selectedSuggestions.size} posts with a fixed interval between them.
                </p>
                <div>
                  <Label>Interval (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bulkInterval}
                    onChange={(e) => setBulkInterval(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending}
                >
                  {bulkMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Schedule All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !suggestions ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Generate AI suggestions</p>
            <p className="text-sm mt-1">Click the button above to generate post ideas for your social media channels.</p>
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="font-medium">No suggestions generated</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.map((suggestion: Record<string, string>, index: number) => (
            <Card key={index} className={selectedSuggestions.has(index) ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getPlatformBadge(suggestion.platform)}
                    <Badge variant="outline" className="text-xs">{suggestion.entityType}</Badge>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(index)}
                    onChange={(e) => {
                      const next = new Set(selectedSuggestions);
                      e.target.checked ? next.add(index) : next.delete(index);
                      setSelectedSuggestions(next);
                    }}
                    className="w-4 h-4"
                  />
                </div>
                <p className="text-sm mb-3 whitespace-pre-line">{suggestion.content}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createFromSuggestion.mutate(suggestion)}
                    disabled={createFromSuggestion.isPending}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Post Now
                  </Button>
                  <CreatePostDialog
                    onCreated={() => queryClient.invalidateQueries({ queryKey: ["social-posts"] })}
                    initialContent={suggestion.content}
                    initialPlatform={suggestion.platform}
                    initialScheduled={true}
                    triggerButton={
                      <Button size="sm" variant="outline">
                        <Calendar className="w-3 h-3 mr-1" />
                        Schedule
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["social-accounts"],
    queryFn: () => apiFetch("/admin/social/accounts"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      apiFetch(`/admin/social/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-accounts"] }),
  });

  const startFacebookOAuthMutation = useMutation({
    mutationFn: () =>
      apiFetch("/admin/social/facebook/oauth/start", {
        method: "POST",
        body: JSON.stringify({ returnPath: "/admin/social?tab=accounts" }),
      }) as Promise<{ authUrl: string }>,
    onSuccess: (result) => {
      if (!result?.authUrl) {
        toast({ title: "Error", description: "Missing Facebook authorization URL", variant: "destructive" });
        return;
      }
      window.location.assign(result.authUrl);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startInstagramOAuthMutation = useMutation({
    mutationFn: () =>
      apiFetch("/admin/social/instagram/oauth/start", {
        method: "POST",
        body: JSON.stringify({ returnPath: "/admin/social?tab=accounts" }),
      }) as Promise<{ authUrl: string }>,
    onSuccess: (result) => {
      if (!result?.authUrl) {
        toast({ title: "Error", description: "Missing Instagram authorization URL", variant: "destructive" });
        return;
      }
      window.location.assign(result.authUrl);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startXOAuthMutation = useMutation({
    mutationFn: () =>
      apiFetch("/admin/social/x/oauth/start", {
        method: "POST",
        body: JSON.stringify({ returnPath: "/admin/social?tab=accounts" }),
      }) as Promise<{ authUrl: string }>,
    onSuccess: (result) => {
      if (!result?.authUrl) {
        toast({ title: "Error", description: "Missing X authorization URL", variant: "destructive" });
        return;
      }
      window.location.assign(result.authUrl);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startGoogleBusinessOAuthMutation = useMutation({
    mutationFn: () =>
      apiFetch("/admin/social/google-business/oauth/start", {
        method: "POST",
        body: JSON.stringify({ returnPath: "/admin/social?tab=accounts" }),
      }) as Promise<{ authUrl: string }>,
    onSuccess: (result) => {
      if (!result?.authUrl) {
        toast({ title: "Error", description: "Missing Google Business authorization URL", variant: "destructive" });
        return;
      }
      window.location.assign(result.authUrl);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (account: Record<string, string | boolean>) => {
      const accountId = String(account.id || "");
      const platform = String(account.platform || "");
      if (platform === "facebook") {
        return apiFetch(`/admin/social/facebook/oauth/accounts/${accountId}`, { method: "DELETE" });
      }
      if (platform === "x") {
        return apiFetch(`/admin/social/x/oauth/accounts/${accountId}`, { method: "DELETE" });
      }
      if (platform === "google_business") {
        return apiFetch(`/admin/social/google-business/oauth/accounts/${accountId}`, { method: "DELETE" });
      }
      if (platform === "instagram") {
        return apiFetch(`/admin/social/instagram/oauth/accounts/${accountId}`, { method: "DELETE" });
      }
      return apiFetch(`/admin/social/accounts/${accountId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Account removed" });
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="default"
          onClick={() => startXOAuthMutation.mutate()}
          disabled={startXOAuthMutation.isPending}
        >
          {startXOAuthMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Log in with X
        </Button>
        <Button
          variant="default"
          onClick={() => startFacebookOAuthMutation.mutate()}
          disabled={startFacebookOAuthMutation.isPending}
        >
          {startFacebookOAuthMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Log in with Facebook
        </Button>
        <Button
          variant="default"
          onClick={() => startInstagramOAuthMutation.mutate()}
          disabled={startInstagramOAuthMutation.isPending}
        >
          {startInstagramOAuthMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Log in with Instagram
        </Button>
        <Button
          variant="default"
          onClick={() => startGoogleBusinessOAuthMutation.mutate()}
          disabled={startGoogleBusinessOAuthMutation.isPending}
        >
          {startGoogleBusinessOAuthMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Log in with Google Business
        </Button>
        <ConnectAccountDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["social-accounts"] })} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No accounts connected</p>
            <p className="text-sm mt-1">Connect your social media accounts to start posting.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account: Record<string, string | boolean>) => (
            <Card key={account.id as string}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getPlatformBadge(account.platform as string)}
                    <div>
                      <p className="font-medium text-sm">{account.profile_name as string}</p>
                      {account.page_name && (
                        <p className="text-xs text-muted-foreground">{account.page_name as string}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Active</Label>
                      <Switch
                        checked={account.is_active as boolean}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: account.id as string, field: "isActive", value: v })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Auto-post</Label>
                      <Switch
                        checked={account.auto_post as boolean}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: account.id as string, field: "autoPost", value: v })
                        }
                      />
                    </div>
                    <EditAccountDialog
                      account={account}
                      onUpdated={() => queryClient.invalidateQueries({ queryKey: ["social-accounts"] })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(account)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSocial() {
  const { hasFeature } = usePlanFeatures();
  const { toast } = useToast();
  const {
    data: socialContext,
    error: socialContextError,
    isLoading: socialContextLoading,
  } = useQuery<SocialContextResponse>({
    queryKey: ["social-context"],
    queryFn: () => apiFetch("/admin/social/context"),
  });

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "posts";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatuses = [
      { key: "facebook_oauth", label: "Facebook" },
      { key: "instagram_oauth", label: "Instagram" },
      { key: "x_oauth", label: "X" },
      { key: "google_business_oauth", label: "Google Business" },
    ] as const;

    const handled = oauthStatuses.find((item) => params.get(item.key));
    if (!handled) return;

    const status = params.get(handled.key);
    const message = params.get("message");
    const connectedCount = params.get("connected");
    if (status === "success") {
      toast({
        title: `${handled.label} connected`,
        description: connectedCount ? `Connected ${connectedCount} account(s).` : `${handled.label} connected successfully.`,
      });
      setActiveTab("accounts");
    } else {
      toast({
        title: `${handled.label} connection failed`,
        description: message || "Please try again.",
        variant: "destructive",
      });
      setActiveTab("accounts");
    }

    for (const item of oauthStatuses) {
      params.delete(item.key);
    }
    params.delete("message");
    params.delete("connected");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [toast]);

  if (!hasFeature("social_media")) {
    return <UpgradePrompt feature="social_media" />;
  }

  const socialContextErrorMessage = getErrorMessage(socialContextError);
  const isMissingPlatformSocialScope = socialContextErrorMessage.includes("social_marketing_tenant_id");

  if (!socialContextLoading && isMissingPlatformSocialScope) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground mt-1">Manage and schedule your social media posts</p>
        </div>

        <Card>
          <CardContent className="py-8 space-y-3">
            <p className="text-sm font-medium">Superadmin social marketing tenant is not configured.</p>
            <p className="text-sm text-muted-foreground">
              Set social_marketing_tenant_id in Platform Settings to enable TWD marketing posting.
            </p>
            <div>
              <Button asChild>
                <Link href="/platform/settings">Open Platform Settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground mt-1">Manage and schedule your social media posts</p>
          {socialContext?.scope === "platform_marketing" && (
            <p className="text-xs font-medium text-blue-700 mt-2">Platform Marketing Mode (TWD)</p>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <PostsTab />
        </TabsContent>

        <TabsContent value="suggestions">
          <SuggestionsTab />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
