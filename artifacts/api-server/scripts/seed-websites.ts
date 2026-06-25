// Seed pages and blocks for existing websites
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const db = supabase as any;

const pageDefinitions = [
  { slug: "home", title: "Home", page_type: "home", nav_order: 1 },
  { slug: "services", title: "Services", page_type: "custom", nav_order: 2 },
  { slug: "how-it-works", title: "How It Works", page_type: "custom", nav_order: 3 },
  { slug: "projects", title: "Projects", page_type: "custom", nav_order: 4 },
  { slug: "reviews", title: "Reviews", page_type: "custom", nav_order: 5 },
  { slug: "areas-we-cover", title: "Areas We Cover", page_type: "custom", nav_order: 6 },
  { slug: "contact", title: "Contact", page_type: "custom", nav_order: 7 },
];

const blockDefinitions: Record<string, Array<{ type: string; sort_order: number; content: any }>> = {
  home: [
    { type: "hero", sort_order: 0, content: { heading: "Welcome to Our Business", subheading: "Professional services you can trust", cta_text: "Get Started", cta_url: "/contact" } },
    { type: "features", sort_order: 1, content: { heading: "Why Choose Us", items: [{ title: "Expert Team", description: "Experienced professionals" }, { title: "Fast Service", description: "Quick turnaround" }, { title: "Guaranteed Quality", description: "Premium results" }] } },
    { type: "services", sort_order: 2, content: { heading: "Our Services", items: [{ title: "Service 1", description: "Professional service" }, { title: "Service 2", description: "Reliable support" }, { title: "Service 3", description: "Quality results" }] } },
    { type: "testimonials", sort_order: 3, content: { heading: "What Our Clients Say", items: [{ author: "Client Name", review: "Excellent service and professionalism", rating: 5 }] } },
    { type: "cta", sort_order: 4, content: { heading: "Ready to get started?", button_text: "Contact Us", button_url: "/contact" } },
  ],
  services: [
    { type: "services", sort_order: 0, content: { heading: "Our Services", items: [{ title: "Service 1", description: "Professional service" }, { title: "Service 2", description: "Reliable support" }, { title: "Service 3", description: "Quality results" }] } },
  ],
  "how-it-works": [
    { type: "process", sort_order: 0, content: { heading: "How It Works", subheading: "Simple steps to get started", cta_text: "Get Started", cta_url: "/contact", steps: [{ title: "Step 1", description: "Get in touch" }, { title: "Step 2", description: "We assess your needs" }, { title: "Step 3", description: "We complete the work" }] } },
  ],
  projects: [
    { type: "gallery", sort_order: 0, content: { heading: "Our Work", columns: 3 } },
  ],
  reviews: [
    { type: "testimonials", sort_order: 0, content: { heading: "Customer Reviews", show_rating: true } },
  ],
  "areas-we-cover": [
    { type: "areas", sort_order: 0, content: { heading: "Areas We Cover", subheading: "We serve customers across the local area", cta_text: "Check Availability", cta_url: "/contact", areas: [] } },
  ],
  contact: [
    { type: "contact_form", sort_order: 0, content: { heading: "Get in Touch", subheading: "Fill in the form below and we'll get back to you shortly", form_type: "contact", allow_photos: true } },
  ],
};

async function seedWebsite(websiteId: string, tenantId: string) {
  console.log(`\nSeeding website ${websiteId}...`);

  // Create pages
  const pagesToCreate = pageDefinitions.map((page) => ({
    website_id: websiteId,
    tenant_id: tenantId,
    slug: page.slug,
    title: page.title,
    page_type: page.page_type,
    status: "published",
    show_in_nav: true,
    nav_label: page.title,
    nav_order: page.nav_order,
  }));

  const { data: createdPages, error: pageError } = await db
    .from("website_pages")
    .insert(pagesToCreate)
    .select("id, slug");

  if (pageError) {
    console.error("Error creating pages:", pageError);
    return;
  }

  console.log(`✓ Created ${createdPages?.length || 0} pages`);

  // Create blocks for each page
  if (createdPages && createdPages.length > 0) {
    const pageBySlug = new Map<string, string>();
    createdPages.forEach((p: { id: string; slug: string }) => {
      pageBySlug.set(p.slug, p.id);
    });

    const blocksToCreate: Array<any> = [];
    for (const [slug, blocks] of Object.entries(blockDefinitions)) {
      const pageId = pageBySlug.get(slug);
      if (pageId) {
        blocks.forEach((block) => {
          blocksToCreate.push({
            page_id: pageId,
            tenant_id: tenantId,
            block_type: block.type,
            sort_order: block.sort_order,
            is_visible: true,
            content: block.content,
          });
        });
      }
    }

    const { error: blockError } = await db
      .from("website_blocks")
      .insert(blocksToCreate);

    if (blockError) {
      console.error("Error creating blocks:", blockError);
    } else {
      console.log(`✓ Created ${blocksToCreate.length} blocks`);
    }
  }
}

async function main() {
  console.log("Seeding websites...");

  // Find all websites without pages
  const { data: websites, error: websiteError } = await db
    .from("websites")
    .select("id, tenant_id, site_name");

  if (websiteError) {
    console.error("Error fetching websites:", websiteError);
    process.exit(1);
  }

  if (!websites || websites.length === 0) {
    console.log("No websites found");
    return;
  }

  for (const website of websites) {
    const { data: pages } = await db
      .from("website_pages")
      .select("id", { count: "exact", head: true })
      .eq("website_id", website.id);

    if (!pages || pages.length === 0) {
      await seedWebsite(website.id, website.tenant_id);
    } else {
      console.log(`Skipping ${website.site_name} (${pages.length} pages already exist)`);
    }
  }

  console.log("\n✅ Seeding complete");
}

main().catch(console.error);
