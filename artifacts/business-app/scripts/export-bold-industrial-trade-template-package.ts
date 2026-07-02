import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { boldIndustrialTradeContentModesManifest, boldIndustrialTradeContentSeeds } from '../src/twd/content/boldIndustrialTradeContentModes';
import { twdBlockRegistry } from '../src/twd/registry/blockRegistry';
import { boldIndustrialTradePages } from '../src/twd/templates/boldIndustrialTrade.pages';

const root = process.cwd();

const templateSlug = 'bold-industrial-trade';
const templateName = 'Bold Industrial Trade';
const packageName = 'bold-industrial-trade-template-package';

const outputBase = path.join(root, 'dist', 'twd-template-packages');
const packageDir = path.join(outputBase, packageName);
const zipPath = `${packageDir}.zip`;

const pageOrder = [
  'home',
  'about',
  'services',
  'service-detail',
  'areas-covered',
  'area-detail',
  'reviews',
  'gallery',
  'faq',
  'contact',
  'blog-index',
  'blog-post',
  'privacy-policy',
  'cookie-policy',
  'terms-conditions',
  '404',
] as const;

const pagePaths: Record<string, string> = {
  home: '/',
  about: '/about',
  services: '/services',
  'service-detail': '/services/boiler-servicing',
  'areas-covered': '/areas-covered',
  'area-detail': '/areas/ellon',
  reviews: '/reviews',
  gallery: '/gallery',
  faq: '/faq',
  contact: '/contact',
  'blog-index': '/blog',
  'blog-post': '/blog/planning-annual-plantroom-boiler-maintenance',
  'privacy-policy': '/privacy-policy',
  'cookie-policy': '/cookie-policy',
  'terms-conditions': '/terms-conditions',
  '404': '/404',
};

const seoDescriptions: Record<string, string> = {
  home: 'Bold industrial trade services for installations, repairs and maintenance across local areas.',
  about: 'Learn more about this practical, contractor-focused trade team and how they deliver demanding work.',
  services: 'Browse robust heating, plumbing, electrical, renewables and industrial maintenance services.',
  'service-detail': 'Industrial heating and plantroom maintenance information, scope and booking guidance.',
  'areas-covered': 'See the towns and local areas covered by this bold industrial trade website template.',
  'area-detail': 'Industrial-focused local trade services in Ellon and surrounding areas.',
  reviews: 'Read sample customer feedback for this high-impact local trade business.',
  gallery: 'View installations, repairs and maintenance examples from this industrial trade template.',
  faq: 'Answers to common questions about reactive callouts, planned maintenance and project work.',
  contact: 'Contact this industrial trade business to request a practical quote and site support.',
  'blog-index': 'Useful industrial and trade maintenance advice for homes, landlords and commercial sites.',
  'blog-post': 'Sample advice article about industrial plantroom maintenance planning.',
  'privacy-policy': 'Privacy policy for this website.',
  'cookie-policy': 'Cookie policy for this website.',
  'terms-conditions': 'Terms and conditions for using this website.',
  '404': 'Page not found.',
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`wrote ${path.relative(root, filePath)}`);
}

function writeText(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content.trimStart(), 'utf8');
  console.log(`wrote ${path.relative(root, filePath)}`);
}

function resetOutput() {
  fs.rmSync(packageDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
  ensureDir(packageDir);
}

function blockId(pageSlug: string, index: number, type: string) {
  return `${pageSlug}-${String(index + 1).padStart(2, '0')}-${type.replaceAll('.', '-')}`;
}

function exportPages() {
  const pagesManifest = pageOrder.map((slug) => {
    const page = boldIndustrialTradePages[slug];

    if (!page) {
      throw new Error(`Missing page recipe for "${slug}"`);
    }

    const pageJson = {
      slug,
      title: page.title,
      path: pagePaths[slug],
      template: templateSlug,
      seo: {
        title: `${page.title} | ${templateName}`,
        description: seoDescriptions[slug],
      },
      blocks: page.blocks.map((block, index) => ({
        id: blockId(slug, index, block.type),
        type: block.type,
        props: block.props,
      })),
    };

    writeJson(
      path.join(packageDir, 'templates', templateSlug, 'pages', `${slug}.json`),
      pageJson
    );

    return {
      slug,
      title: page.title,
      path: pagePaths[slug],
      file: `${slug}.json`,
      blockCount: page.blocks.length,
    };
  });

  writeJson(
    path.join(packageDir, 'templates', templateSlug, 'pages', 'pages.json'),
    {
      template: templateSlug,
      defaultPage: 'home',
      pages: pagesManifest,
    }
  );
}

function exportContentSeeds() {
  writeJson(
    path.join(packageDir, 'templates', templateSlug, 'content', 'content-modes.json'),
    boldIndustrialTradeContentModesManifest
  );

  for (const modeEntry of boldIndustrialTradeContentModesManifest.modes) {
    const seed = boldIndustrialTradeContentSeeds[modeEntry.mode];
    writeJson(
      path.join(packageDir, 'templates', templateSlug, 'content', modeEntry.file),
      seed
    );
  }
}

function exportTemplateJson() {
  writeJson(path.join(packageDir, 'templates', templateSlug, 'template.json'), {
    id: templateSlug,
    slug: templateSlug,
    name: templateName,
    version: '1.0.0',
    status: 'draft',
    category: 'trade',
    style: 'bold-industrial',
    description:
      'A bold industrial block-based template for UK trade businesses handling demanding installs, repairs and maintenance.',
    industries: [
      'Industrial heating',
      'Plumbing',
      'Heating',
      'Oil boiler engineering',
      'Electrical',
      'Renewables',
      'Building',
      'Commercial contractors',
      'Plant and mechanical trades',
      'Property maintenance',
      'Local services',
      'Trade businesses',
    ],
    defaultPage: 'home',
    pages: pageOrder,
    requiredBlocks: [...new Set(pageOrder.flatMap((slug) => boldIndustrialTradePages[slug].blocks.map((block) => block.type)))],
    source: {
      type: 'storybook-recipes',
      recipeFile: 'src/twd/templates/boldIndustrialTrade.pages.ts',
      registryFile: 'src/twd/registry/blockRegistry.ts',
    },
  });
}

function exportThemeJson() {
  writeJson(path.join(packageDir, 'templates', templateSlug, 'styles', 'theme.json'), {
    slug: templateSlug,
    name: templateName,
    tokens: {
      colors: {
        primary: '#111827',
        primaryText: '#FFFFFF',
        industrialBlack: '#0B0F14',
        secondary: '#334155',
        secondaryText: '#E5E7EB',
        accent: '#F97316',
        accentStrong: '#F59E0B',
        accentText: '#111827',
        background: '#FFFFFF',
        mutedBackground: '#F3F4F6',
        sectionDark: '#111827',
        sectionSteel: '#334155',
        border: '#475569',
        text: '#111827',
        textOnDark: '#F9FAFB',
        mutedText: '#475569',
      },
      typography: {
        headingFamily: 'Archivo Black, Impact, sans-serif',
        bodyFamily: 'Barlow, Arial, sans-serif',
        headingWeight: 800,
        bodyWeight: 500,
        baseFontSize: '16px',
        lineHeight: 1.5,
      },
      radius: {
        small: '0.125rem',
        medium: '0.25rem',
        large: '0.375rem',
      },
      spacing: {
        sectionY: '5.5rem',
        sectionDivider: '3rem',
        containerX: '1.5rem',
        maxWidth: '80rem',
      },
      sectionBackgrounds: {
        hero: '#0B0F14',
        alternate: '#F3F4F6',
        highlight: '#111827',
        neutral: '#FFFFFF',
      },
      buttons: {
        primaryStyle: 'solid-accent',
        secondaryStyle: 'solid-primary',
        primaryBackground: '#F97316',
        primaryText: '#111827',
        secondaryBackground: '#111827',
        secondaryText: '#FFFFFF',
        borderRadius: '0.25rem',
        weight: 700,
      },
      cards: {
        background: '#ffffff',
        alternateBackground: '#F3F4F6',
        borderColor: '#334155',
        borderWidth: '2px',
        shadow: '0 8px 24px rgba(11, 15, 20, 0.2)',
        borderRadius: '0.25rem',
      },
      forms: {
        fieldBackground: '#FFFFFF',
        fieldBorder: '#475569',
        fieldText: '#111827',
        focusRing: '#F97316',
        borderRadius: '0.25rem',
      },
      serviceCards: {
        background: '#FFFFFF',
        borderColor: '#334155',
        titleColor: '#111827',
        accentBar: '#F97316',
      },
      cta: {
        background: '#111827',
        text: '#F9FAFB',
        accent: '#F59E0B',
      },
      gallery: {
        cardBackground: '#F3F4F6',
        captionColor: '#111827',
        borderColor: '#334155',
      },
      reviews: {
        cardBackground: '#FFFFFF',
        quoteColor: '#111827',
        borderColor: '#334155',
        ratingColor: '#F59E0B',
      },
      header: {
        style: 'dark-industrial',
        background: '#0B0F14',
        text: '#F9FAFB',
        borderBottom: '#334155',
      },
      footer: {
        style: 'dark-structured',
        background: '#0B0F14',
        text: '#E5E7EB',
        borderTop: '#334155',
      },
    },
  });
}

function exportCmsMapping() {
  writeJson(path.join(packageDir, 'templates', templateSlug, 'cms-mapping.json'), {
    template: templateSlug,
    businessFields: {
      businessName: [
        'site.header.logoText',
        'site.footer.logoText',
      ],
      phone: [
        'site.header.phone',
        'hero.standard.phone',
        'cta.banner.phone',
        'contact.split.phone',
        'site.footer.phone',
      ],
      email: [
        'contact.split.email',
        'site.footer.email',
      ],
      address: [
        'contact.split.address',
      ],
      openingHours: [
        'contact.split.openingHours',
      ],
    },
    repeatableCollections: {
      services: {
        blockTypes: ['services.grid'],
        itemFields: ['title', 'description', 'href'],
      },
      reviews: {
        blockTypes: ['reviews.grid'],
        itemFields: ['quote', 'name', 'location', 'rating'],
      },
      areas: {
        blockTypes: ['areas.grid'],
        itemFields: ['name', 'href'],
      },
      faqs: {
        blockTypes: ['faq.accordion'],
        itemFields: ['question', 'answer'],
      },
      galleryImages: {
        blockTypes: ['gallery.grid'],
        itemFields: ['alt', 'caption'],
      },
      blogPosts: {
        blockTypes: ['blog.index'],
        itemFields: ['title', 'excerpt', 'href', 'date'],
      },
      legalSections: {
        blockTypes: ['legal.content'],
        itemFields: ['heading', 'body'],
      },
    },
  });
}

function exportBlockRegistry() {
  writeJson(path.join(packageDir, 'registry', 'block-registry.json'), {
    version: '1.0.0',
    source: 'src/twd/registry/blockRegistry.ts',
    blocks: twdBlockRegistry,
  });
}

function exportValidatorScript() {
  writeText(path.join(packageDir, 'scripts', 'validate-template.ts'), `
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'templates/${templateSlug}/template.json',
  'templates/${templateSlug}/pages/pages.json',
  'templates/${templateSlug}/content/content-modes.json',
  ${boldIndustrialTradeContentModesManifest.modes.map((mode) => `'templates/${templateSlug}/content/${mode.file}'`).join(',\n  ')},
  'templates/${templateSlug}/styles/theme.json',
  'templates/${templateSlug}/cms-mapping.json',
  'registry/block-registry.json',
];

const pageFiles = [
  ${pageOrder.map((slug) => `'templates/${templateSlug}/pages/${slug}.json'`).join(',\n  ')},
];

const missing = [...requiredFiles, ...pageFiles].filter((file) => {
  return !fs.existsSync(path.join(root, file));
});

if (missing.length > 0) {
  console.error('Template package is missing required files:');
  for (const file of missing) {
    console.error('- ' + file);
  }
  process.exit(1);
}

const template = JSON.parse(
  fs.readFileSync(path.join(root, 'templates/${templateSlug}/template.json'), 'utf8')
);

const pages = JSON.parse(
  fs.readFileSync(path.join(root, 'templates/${templateSlug}/pages/pages.json'), 'utf8')
);

if (template.slug !== '${templateSlug}') {
  throw new Error('Invalid template slug');
}

if (!Array.isArray(pages.pages) || pages.pages.length === 0) {
  throw new Error('pages.json must include a non-empty pages array');
}

console.log('Template package validation passed.');
`);
}

function exportSupabaseSeed() {
  writeText(path.join(packageDir, 'supabase', 'seed-template-example.sql'), `
-- Example seed for the Bold Industrial Trade template.
-- Adjust table and column names to match the final TWD database schema.

-- insert into website_templates (slug, name, category, status)
-- values ('${templateSlug}', '${templateName}', 'trade', 'draft')
-- on conflict (slug) do update set
--   name = excluded.name,
--   category = excluded.category,
--   status = excluded.status;
`);
}

function exportReadme() {
  writeText(path.join(packageDir, 'README.md'), `
# ${templateName} Template Package

This package was generated from the TWD Storybook block recipes.

## Structure

- \`templates/${templateSlug}/template.json\`
- \`templates/${templateSlug}/pages/pages.json\`
- \`templates/${templateSlug}/pages/*.json\`
- \`templates/${templateSlug}/styles/theme.json\`
- \`templates/${templateSlug}/content/content-modes.json\`
- \`templates/${templateSlug}/content/*.json\`
- \`templates/${templateSlug}/cms-mapping.json\`
- \`registry/block-registry.json\`
- \`scripts/validate-template.ts\`
- \`supabase/seed-template-example.sql\`

## Source

Generated from:

- \`src/twd/templates/boldIndustrialTrade.pages.ts\`
- \`src/twd/registry/blockRegistry.ts\`

## Intended use

Upload/import this package into the TWD superadmin template system.

The package assumes the TWD app already knows how to render the registered block types.
`);
}

function makeZip() {
  const python = `
import os
import shutil
import sys

package_dir = sys.argv[1]
zip_path = sys.argv[2]

if os.path.exists(zip_path):
    os.remove(zip_path)

base_name = zip_path[:-4] if zip_path.endswith('.zip') else zip_path
shutil.make_archive(base_name, 'zip', root_dir=package_dir)
print(zip_path)
`;

  execFileSync('python3', ['-c', python, packageDir, zipPath], {
    stdio: 'inherit',
  });
}

function main() {
  resetOutput();

  exportTemplateJson();
  exportPages();
  exportContentSeeds();
  exportThemeJson();
  exportCmsMapping();
  exportBlockRegistry();
  exportValidatorScript();
  exportSupabaseSeed();
  exportReadme();
  makeZip();

  console.log('');
  console.log('Bold Industrial Trade template package exported.');
  console.log('');
  console.log(`Folder: ${path.relative(root, packageDir)}`);
  console.log(`ZIP:    ${path.relative(root, zipPath)}`);
}

main();
