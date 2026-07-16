/**
 * Website Templates Storage
 * 
 * Provides database access layer for website templates using Supabase.
 * Adapted from website-templates-system for TWD's Supabase architecture.
 */

import { supabaseAdmin } from "./supabase";

export interface WebsiteTemplate {
  id: string;
  name: string;
  display_name: string;
  slug?: string;
  description?: string;
  version: string;
  template_path: string;
  preview_image_url?: string;
  is_active: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface Website {
  id: string;
  tenant_id: string;
  template_id: string;
  title: string;
  description?: string;
  slug: string;
  is_published: boolean;
  published_at?: string;
  customizations?: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface WebsitePage {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  content?: string; // JSON string
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsertWebsiteTemplate {
  name: string;
  display_name: string;
  description?: string | null;
  version?: string;
  template_path: string;
  preview_image_url?: string | null;
  is_active?: boolean;
}

export interface InsertWebsite {
  tenant_id: string;
  template_id: string;
  title: string;
  description?: string | null;
  slug: string;
  is_published?: boolean;
  published_at?: string | null;
  customizations?: string | null;
}

export interface InsertWebsitePage {
  tenant_id: string;
  title: string;
  slug: string;
  content?: string | null;
  display_order?: number;
  is_visible?: boolean;
}

/**
 * Website Template Storage Service
 * Provides methods to manage website templates, websites, and pages
 */
export class WebsiteTemplateStorage {
  private db: any;

  constructor() {
    this.db = supabaseAdmin;
  }

  private isMissingTemplateColumnError(error: { code?: string } | null | undefined): boolean {
    return error?.code === "42703" || error?.code === "PGRST204";
  }

  private normalizeTemplate(row: Record<string, any>): WebsiteTemplate {
    const slug = typeof row.slug === "string" ? row.slug : undefined;
    const displayName =
      typeof row.display_name === "string"
        ? row.display_name
        : typeof row.name === "string"
          ? row.name
          : slug || "";

    return {
      id: String(row.id),
      name: slug || String(row.name || ""),
      display_name: displayName,
      slug,
      description: row.description ?? undefined,
      version: typeof row.version === "string" ? row.version : "1.0.0",
      template_path:
        typeof row.template_path === "string"
          ? row.template_path
          : slug
            ? `templates/${slug}`
            : `templates/${String(row.name || "")}`,
      preview_image_url:
        typeof row.preview_image_url === "string"
          ? row.preview_image_url
          : typeof row.thumbnail_url === "string"
            ? row.thumbnail_url
            : typeof row.preview_url === "string"
              ? row.preview_url
              : undefined,
      is_active: row.is_active !== false,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : undefined,
      created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
      updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
    };
  }

  // ─── WEBSITE TEMPLATES ───────────────────────────────────────────────────────

  async getAllTemplates(): Promise<WebsiteTemplate[]> {
    const result = await this.db
      .from("website_templates")
      .select("*")
      .eq("is_active", true);

    if (result.error) throw result.error;

    return (result.data || [])
      .map((row: Record<string, any>) => this.normalizeTemplate(row))
      .sort((left: WebsiteTemplate, right: WebsiteTemplate) => {
        const leftOrder = typeof left.sort_order === "number" ? left.sort_order : Number.MAX_SAFE_INTEGER;
        const rightOrder = typeof right.sort_order === "number" ? right.sort_order : Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.display_name.localeCompare(right.display_name);
      });
  }

  async getTemplate(id: string): Promise<WebsiteTemplate | undefined> {
    const { data, error } = await this.db
      .from("website_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
    return data ? this.normalizeTemplate(data) : undefined;
  }

  async getTemplateByName(name: string): Promise<WebsiteTemplate | undefined> {
    let result = await this.db
      .from("website_templates")
      .select("*")
      .eq("name", name)
      .single();

    if (result.error?.code === "PGRST116") {
      const fallback = await this.db
        .from("website_templates")
        .select("*")
        .eq("slug", name)
        .single();

      if (!this.isMissingTemplateColumnError(fallback.error)) {
        result = fallback;
      }
    }

    if (result.error && result.error.code !== "PGRST116") throw result.error;
    return result.data ? this.normalizeTemplate(result.data) : undefined;
  }

  async createTemplate(data: InsertWebsiteTemplate): Promise<WebsiteTemplate> {
    let result = await this.db
      .from("website_templates")
      .insert([
        {
          name: data.name,
          display_name: data.display_name,
          description: data.description || null,
          version: data.version || "1.0.0",
          template_path: data.template_path,
          preview_image_url: data.preview_image_url || null,
          is_active: data.is_active !== false,
        },
      ])
      .select()
      .single();

    if (this.isMissingTemplateColumnError(result.error)) {
      result = await this.db
        .from("website_templates")
        .insert([
          {
            name: data.display_name,
            slug: data.name,
            description: data.description || null,
            preview_url: data.preview_image_url || null,
            is_active: data.is_active !== false,
          },
        ])
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return this.normalizeTemplate(result.data);
  }

  async updateTemplate(
    id: string,
    data: Partial<InsertWebsiteTemplate>
  ): Promise<WebsiteTemplate | undefined> {
    const updateData: any = {};
    if (data.display_name !== undefined) updateData.display_name = data.display_name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.template_path !== undefined) updateData.template_path = data.template_path;
    if (data.preview_image_url !== undefined) updateData.preview_image_url = data.preview_image_url;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    let result = await this.db
      .from("website_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (this.isMissingTemplateColumnError(result.error)) {
      const legacyUpdateData: any = {};
      if (data.display_name !== undefined) legacyUpdateData.name = data.display_name;
      if (data.description !== undefined) legacyUpdateData.description = data.description;
      if (data.preview_image_url !== undefined) legacyUpdateData.preview_url = data.preview_image_url;
      if (data.is_active !== undefined) legacyUpdateData.is_active = data.is_active;

      result = await this.db
        .from("website_templates")
        .update(legacyUpdateData)
        .eq("id", id)
        .select()
        .single();
    }

    if (result.error && result.error.code !== "PGRST116") throw result.error;
    return result.data ? this.normalizeTemplate(result.data) : undefined;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await this.db.from("website_templates").delete().eq("id", id);

    if (error) throw error;
    return true;
  }

  // ─── WEBSITES ───────────────────────────────────────────────────────────────

  async getWebsite(tenantId: string): Promise<Website | undefined> {
    const { data, error } = await this.db
      .from("websites")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async getWebsiteBySlug(slug: string): Promise<Website | undefined> {
    const { data, error } = await this.db
      .from("websites")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async createWebsite(data: InsertWebsite): Promise<Website> {
    const { data: result, error } = await this.db
      .from("websites")
      .insert([
        {
          tenant_id: data.tenant_id,
          template_id: data.template_id,
          title: data.title,
          description: data.description || null,
          slug: data.slug,
          is_published: data.is_published !== true ? false : true,
          published_at: data.published_at || null,
          customizations: data.customizations || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async updateWebsite(
    tenantId: string,
    data: Partial<InsertWebsite>
  ): Promise<Website | undefined> {
    const updateData: any = {};
    if (data.template_id !== undefined) updateData.template_id = data.template_id;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.customizations !== undefined) updateData.customizations = data.customizations;

    const { data: result, error } = await this.db
      .from("websites")
      .update(updateData)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return result || undefined;
  }

  async switchTemplate(tenantId: string, templateId: string): Promise<Website | undefined> {
    const { data: result, error } = await this.db
      .from("websites")
      .update({ template_id: templateId })
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return result || undefined;
  }

  async publishWebsite(tenantId: string): Promise<Website | undefined> {
    const { data: result, error } = await this.db
      .from("websites")
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return result || undefined;
  }

  async unpublishWebsite(tenantId: string): Promise<Website | undefined> {
    const { data: result, error } = await this.db
      .from("websites")
      .update({ is_published: false })
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return result || undefined;
  }

  // ─── WEBSITE PAGES ──────────────────────────────────────────────────────────

  async getWebsitePages(tenantId: string): Promise<WebsitePage[]> {
    const { data, error } = await this.db
      .from("website_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getWebsitePage(
    tenantId: string,
    slug: string
  ): Promise<WebsitePage | undefined> {
    const { data, error } = await this.db
      .from("website_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("slug", slug)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async getWebsitePageById(pageId: string): Promise<WebsitePage | undefined> {
    const { data, error } = await this.db
      .from("website_pages")
      .select("*")
      .eq("id", pageId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async createWebsitePage(data: InsertWebsitePage): Promise<WebsitePage> {
    const { data: result, error } = await this.db
      .from("website_pages")
      .insert([
        {
          tenant_id: data.tenant_id,
          title: data.title,
          slug: data.slug,
          content: data.content || null,
          display_order: data.display_order || 0,
          is_visible: data.is_visible !== false,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async updateWebsitePage(
    pageId: string,
    data: Partial<InsertWebsitePage>
  ): Promise<WebsitePage | undefined> {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.display_order !== undefined) updateData.display_order = data.display_order;
    if (data.is_visible !== undefined) updateData.is_visible = data.is_visible;

    const { data: result, error } = await this.db
      .from("website_pages")
      .update(updateData)
      .eq("id", pageId)
      .select()
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return result || undefined;
  }

  async deleteWebsitePage(pageId: string): Promise<boolean> {
    const { error } = await this.db.from("website_pages").delete().eq("id", pageId);

    if (error) throw error;
    return true;
  }

  async reorderWebsitePages(
    tenantId: string,
    pages: Array<{ id: string; displayOrder: number }>
  ): Promise<WebsitePage[]> {
    const updates = pages.map((page) => ({
      id: page.id,
      display_order: page.displayOrder,
    }));

    // Use a transaction-like approach: update each page
    for (const update of updates) {
      const { error } = await this.db
        .from("website_pages")
        .update({ display_order: update.display_order })
        .eq("id", update.id);

      if (error) throw error;
    }

    // Return updated pages
    return this.getWebsitePages(tenantId);
  }
}

// Export singleton instance
export const websiteTemplateStorage = new WebsiteTemplateStorage();
