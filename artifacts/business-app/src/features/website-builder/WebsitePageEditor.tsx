import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import WebsiteBlockEditor from "./WebsiteBlockEditor";
import type { TenantWebsiteContent, WebsiteTemplatePage } from "./websiteBuilderTypes";

interface Props {
  page: WebsiteTemplatePage;
  content: TenantWebsiteContent;
  onChange: (next: TenantWebsiteContent) => void;
}

export default function WebsitePageEditor({ page, content, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(page.blocks[0]?.id || null);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{page.name}</h2>
      {page.blocks.map((block) => {
        const open = openId === block.id;
        return (
          <Card key={block.id}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{block.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{block.description}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setOpenId(open ? null : block.id)}>
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            {open ? (
              <CardContent>
                <WebsiteBlockEditor blockType={block.type} content={content} onChange={onChange} />
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
