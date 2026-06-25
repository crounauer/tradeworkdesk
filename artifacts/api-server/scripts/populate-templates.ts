// Quick script to populate template default_pages
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const defaultPages = [
  {
    slug: "home",
    title: "Home",
    page_type: "home",
    show_in_nav: true,
    nav_order: 0,
    blocks: [
      { type: "hero", sort_order: 0 },
      { type: "features", sort_order: 1 },
      { type: "services", sort_order: 2 },
      { type: "testimonials", sort_order: 3 },
      { type: "cta", sort_order: 4 },
    ],
  },
  {
    slug: "services",
    title: "Services",
    page_type: "custom",
    show_in_nav: true,
    nav_order: 1,
    blocks: [
      { type: "hero", sort_order: 0 },
      { type: "services", sort_order: 1 },
    ],
  },
  {
    slug: "how-it-works",
    title: "How It Works",
    page_type: "custom",
    show_in_nav: true,
    nav_order: 2,
    blocks: [
      { type: "hero", sort_order: 0 },
      { type: "process", sort_order: 1 },
    ],
  },
  {
    slug: "projects",
    title: "Projects",
    page_type: "custom",
    show_in_nav: true,
    nav_order: 3,
    blocks: [
      { type: "hero", sort_order: 0 },
      { type: "gallery", sort_order: 1 },
    ],
  },
  {
    slug: "reviews",
    title: "Reviews",
    page_type: "custom",
    show_in_nav: true,
    nav_order: 4,
    blocks: [
      { type: "hero", sort_order: 0 },
      { type: "testimonials", sort_order: 1 },
    ],
  },
  {
    slug: "areas-we-cover",
    title: "Areas We Cover",
    page_type: "custom",
    show_in_nav: true,
    nav_order: 5,
    blocks: [
      { type: "hero", sort_order: 0 },
      { type: "areas", sort_order: 1 },
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    page_type: "custom",
    show_in_nav: true,
    nav_order: 6,
    blocks: [
      { type: "hero", sort_order: 0 },
      { type: "contact_form", sort_order: 1 },
    ],
  },
];

async function updateTemplates() {
  console.log("Updating templates with default_pages...");

  const { error } = await supabase
    .from("website_templates")
    .update({ default_pages: defaultPages })
    .eq("is_active", true);

  if (error) {
    console.error("Error updating templates:", error);
    process.exit(1);
  }

  console.log("✅ Templates updated successfully!");

  // Verify
  const { data, error: verifyError } = await supabase
    .from("website_templates")
    .select("name, default_pages");

  if (verifyError) {
    console.error("Error verifying:", verifyError);
    process.exit(1);
  }

  console.log(
    "\nVerification:",
    data?.map((t) => ({
      name: t.name,
      pages: (t.default_pages as any[]).length,
    }))
  );
}

updateTemplates().catch(console.error);
