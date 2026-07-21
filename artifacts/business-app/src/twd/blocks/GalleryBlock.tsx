import type { GalleryImageItem } from '../types';

export type GalleryBlockProps = {
  eyebrow?: string;
  title: string;
  images: GalleryImageItem[];
  columns?: 2 | 3 | 4;
};

export function GalleryBlock({
  eyebrow = 'Gallery',
  title,
  images,
  columns = 3,
}: GalleryBlockProps) {
  const lgColumnsClass = columns === 2 ? 'lg:grid-cols-2' : columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className={`mt-10 grid gap-6 sm:grid-cols-2 ${lgColumnsClass}`}>
          {images.map((image) => (
            <figure key={image.alt + image.caption} className="rounded-xl bg-slate-100 p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-slate-300 text-center text-sm text-slate-700">
                {image.alt}
              </div>
              {image.caption ? <figcaption className="mt-3 text-sm font-medium text-slate-700">{image.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
