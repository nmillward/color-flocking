export interface StockImage {
  id: string;
  title: string;
  /** Path relative to the site root (files live in public/images). */
  src: string;
  thumb: string;
  photographer: string;
  url: string;
}

const base = import.meta.env.BASE_URL;

// Film photography from Unsplash (Unsplash License). Filled in once the image set is approved.
export const IMAGES: StockImage[] = [].map((img: Omit<StockImage, 'src' | 'thumb'>) => ({
  ...img,
  src: `${base}images/${img.id}.jpg`,
  thumb: `${base}images/thumbs/${img.id}.jpg`,
}));
