import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { ecoRenewablesTradePages } from '../src/twd/templates/ecoRenewablesTrade.pages';
import { ecoRenewablesTradeContentModesManifest, ecoRenewablesTradeContentSeeds } from '../src/twd/content/ecoRenewablesTradeContentModes';
import { twdBlockRegistry } from '../src/twd/registry/blockRegistry';

const root = process.cwd();

const templateSlug = 'eco-renewables-trade';
const templateName = 'Eco Renewables Trade';
const packageName = 'eco-renewables-trade-template-package';

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
  'service-detail': '/services/heat-pumps',
  'areas-covered': '/areas-covered',
  'area-detail': '/areas/ellon',
  reviews: '/reviews',
  gallery: '/gallery',
  faq: '/faq',
  contact: '/contact',
  'blog-index': '/blog',
  'blog-post': '/blog/heat-pump-solar-battery-upgrade-path',
  'privacy-policy': '/privacy-policy',
  'cookie-policy': '/cookie-policy',
  'terms-conditions': '/terms-conditions',
  '404': '/404',
};

const seoDescriptions: Record<string, string> = {
  home: 'Low-carbon heating and renewable energy services with clear guidance and practical delivery.',
  about: 'Learn more about this local renewable services business and how it works.',
  services: 'Browse heat pump, solar PV, battery and EV charging services for homes and small sites.',
  'service-detail': 'Heat pump survey and installation detail, what is included, and how to book.',
  'areas-covered': 'See the towns and local areas covered for surveys, installations and maintenance.',
  'area-detail': 'Local renewable services in Ellon and surrounding areas.',
  reviews: 'Read customer feedback from local homeowners and property managers.',
  gallery: 'View recent renewable project examples and tidy installation outcomes.',
  faq: 'Answers to common renewable service questions before booking.',
  contact: 'Contact this local renewable business to request a survey, quote or advice.',
  'blog-index': 'Helpful renewable advice and practical customer guides.',
  'blog-post': 'Advice article about planning practical low-carbon upgrades.',
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
    const page = ecoRenewablesTradePages[slug];

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
    ecoRenewablesTradeContentModesManifest
  );

  for (const modeEntry of ecoRenewablesTradeContentModesManifest.modes) {
    const seed = ecoRenewablesTradeContentSeeds[modeEntry.mode];
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
    style: 'eco-renewables',
    description:
      'A clean, trustworthy block-based template for UK renewable trade and low-carbon service businesses.',
    industries: [
      'Heat pump installation',
      'Solar PV installation',
      'Battery storage',
      'EV charger installation',
      'Renewable heating',
      'Energy-efficiency upgrades',
      'Low-carbon services',
      'Trade businesses',
    ],
    defaultPage: 'home',
    pages: pageOrder,
    requiredBlocks: [...new Set(pageOrder.flatMap((slug) => ecoRenewablesTradePages[slug].blocks.map((block) => block.type)))],
    source: {
      type: 'storybook-recipes',
      recipeFile: 'src/twd/templates/ecoRenewablesTrade.pages.ts',
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
        primary: '#0f766e',
        primaryText: '#ffffff',
        secondary: '#334155',
        secondaryText: '#ffffff',
        accent: '#84cc16',
        accentText: '#ffffff',
        background: '#ffffff',
        mutedBackground: '#f0fdfa',
        sectionDark: '#134e4a',
        border: '#d1e5df',
        text: '#1f2937',
        mutedText: '#475569',
      },
      typography: {
        headingFamily: 'Manrope, system-ui, sans-serif',
        bodyFamily: 'Source Sans 3, system-ui, sans-serif',
        baseFontSize: '16px',
      },
      radius: {
        small: '0.5rem',
        medium: '0.875rem',
        large: '1.25rem',
      },
      spacing: {
        sectionY: '5.5rem',
        containerX: '1.5rem',
        maxWidth: '80rem',
      },
      buttons: {
        primaryStyle: 'solid-primary',
        secondaryStyle: 'outline-primary',
      },
      cards: {
        background: '#ffffff',
        borderColor: '#d1e5df',
        shadow: '0 6px 18px rgba(15, 118, 110, 0.08)',
      },
      header: {
        background: '#ffffff',
        text: '#1f2937',
      },
      footer: {
        background: '#134e4a',
        text: '#ecfeff',
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
  ${ecoRenewablesTradeContentModesManifest.modes.map((mode) => `'templates/${templateSlug}/content/${mode.file}'`).join(',\n  ')},
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
-- Example seed for the Eco Renewables Trade template.
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

- \`src/twd/templates/ecoRenewablesTrade.pages.ts\`
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
  console.log('Eco Renewables Trade template package exported.');
  console.log('');
  console.log(`Folder: ${path.relative(root, packageDir)}`);
  console.log(`ZIP:    ${path.relative(root, zipPath)}`);
}

main();
