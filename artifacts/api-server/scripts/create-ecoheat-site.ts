import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase config");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  try {
    // Create a new tenant for ecoheat
    const { data: newTenant, error: createTenantError } = await db
      .from("tenants")
      .insert([{ company_name: `North East Ecoheat LTD` }])
      .select()
      .single();

    if (createTenantError) {
      console.error("Error creating tenant:", createTenantError);
      return;
    }

    const tenantId = newTenant.id;
    console.log("Created tenant:", tenantId);

    // Get or create a website template
    const { data: templates, error: templateError } = await db
      .from("website_templates")
      .select("id")
      .limit(1);

    if (templateError) {
      console.error("Error fetching templates:", templateError);
      return;
    }

    let templateId = templates?.[0]?.id;
    if (!templateId) {
      console.log("No templates found, creating one...");
      const { data: newTemplate, error: createError } = await db
        .from("website_templates")
        .insert([{ slug: "default", name: "Default" }])
        .select()
        .single();
      if (createError) {
        console.error("Error creating template:", createError);
        return;
      }
      templateId = newTemplate.id;
    }

    console.log("Using template:", templateId);

    // Create the website
    const { data: website, error: websiteError } = await db
      .from("websites")
      .insert([
        {
          tenant_id: tenantId,
          template_id: templateId,
          site_name: "North East Ecoheat LTD",
          status: "published",
          default_meta_description: "Heating solutions in North East England",
        },
      ])
      .select()
      .single();

    if (websiteError) {
      console.error("Error creating website:", websiteError);
      return;
    }

    console.log("✓ Created website:", website.id);

    // Delete old domain if it exists
    await db
      .from("website_domains")
      .delete()
      .eq("domain", "north-east-ecoheat-ltd.tradeworkdesk.co.uk");

    // Create the domain
    const { data: domain, error: domainError } = await db
      .from("website_domains")
      .insert([
        {
          website_id: website.id,
          tenant_id: tenantId,
          domain: "north-east-ecoheat-ltd.tradeworkdesk.co.uk",
          is_active: true,
        },
      ])
      .select()
      .single();

    if (domainError) {
      console.error("Error creating domain:", domainError);
      return;
    }

    console.log("✓ Created domain:", domain.domain);

    // Create the 7 pages
    const pages = ["home", "services", "how-it-works", "projects", "reviews", "areas-we-cover", "contact"];
    const pageIds: Record<string, string> = {};

    for (const slug of pages) {
      const { data: page, error: pageError } = await db
        .from("website_pages")
        .insert([
          {
            website_id: website.id,
            tenant_id: tenantId,
            slug,
            page_type: "custom",
            title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
            status: "published",
            show_in_nav: true,
            nav_order: pages.indexOf(slug),
          },
        ])
        .select()
        .single();

      if (pageError) {
        console.error(`Error creating page ${slug}:`, pageError);
        return;
      }

      pageIds[slug] = page.id;
      console.log(`✓ Created page: ${slug}`);
    }

    console.log("\n✅ All pages created successfully!");
    console.log("\nNext: Run the seed-figma-content.ts script to add blocks.");
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

main();
