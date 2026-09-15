export interface StockImage {
  id: string;
  title: string;
  group: 'nature' | 'street';
  photographer: string;
  /** Full-size image (1600px) and square thumbnail, served from public/images. */
  src: string;
  thumb: string;
  /** Photo page and photographer profile on Unsplash. */
  url: string;
  profile: string;
}

interface RawImage {
  id: string;
  title: string;
  group: StockImage['group'];
  photographer: string;
  username: string;
  unsplashId: string;
}

// Film photography from Unsplash, used under the Unsplash License.
const RAW: RawImage[] = [
  { id: 'lighthouse', title: 'Lighthouse fjord', group: 'nature', photographer: 'Kristina Delp', username: 'kdelpdp', unsplashId: 'lT72q-B13CY' },
  { id: 'red-flowers', title: 'Red blooms', group: 'nature', photographer: 'Taiyou', username: 'taiyoushounen', unsplashId: 'Zg601ytoKGE' },
  { id: 'dolomites', title: 'Dolomites meadow', group: 'nature', photographer: 'Jade Stephens', username: 'jadestephens', unsplashId: 'vVM7ZRq5lI0' },
  { id: 'wadi-rum', title: 'Wadi Rum', group: 'nature', photographer: 'Youhana Nassif', username: 'youhananassif', unsplashId: 'ls7Dx9RxMy8' },
  { id: 'autumn-valley', title: 'Autumn valley', group: 'nature', photographer: 'Daniel Garcia', username: 'dangrcia', unsplashId: 'Tk5BqXP2aXM' },
  { id: 'oregon-coast', title: 'Oregon coast', group: 'nature', photographer: 'Chase Caldwell', username: 'jchasec', unsplashId: '8BU_9MNGLco' },
  { id: 'blue-ridges', title: 'Blue ridges', group: 'nature', photographer: 'Mick Haupt', username: 'rocinante_11', unsplashId: 'Mpd15Eo4uQU' },
  { id: 'neon-street', title: 'Neon street', group: 'street', photographer: 'Cecelia Chang', username: 'ceceliaccc', unsplashId: 'g1HYfMtZ5iE' },
  { id: 'storefront', title: 'Night storefront', group: 'street', photographer: 'Kelvin Zyteng', username: 'zyteng', unsplashId: 'KMjwhr6ROeI' },
  { id: 'canopy', title: 'Canopy lights', group: 'street', photographer: 'Daniil Onischenko', username: 'flyvk', unsplashId: 'sHvhTFQIGsU' },
  { id: 'green-neon', title: 'Green neon', group: 'street', photographer: 'Johnathan Walker', username: 'syrenofisys', unsplashId: '7U27tWlRl4c' },
  { id: 'moulin-rouge', title: 'Moulin Rouge', group: 'street', photographer: 'Karl Bewick', username: 'kaaarlb', unsplashId: 'If-eR-dLc4I' },
  { id: 'subway', title: 'Subway platform', group: 'street', photographer: 'Ivan Mani', username: 'ivans_in_danger', unsplashId: 'JwZAuOdjREk' },
  { id: 'arcade', title: 'Golden arcade', group: 'street', photographer: 'Bernhard', username: 'bernhardbar', unsplashId: '3ld-qEX2UPg' },
];

const base = import.meta.env.BASE_URL;
const utm = '?utm_source=color-flocking&utm_medium=referral';

export const IMAGES: StockImage[] = RAW.map(({ username, unsplashId, ...img }) => ({
  ...img,
  src: `${base}images/${img.id}.jpg`,
  thumb: `${base}images/thumbs/${img.id}.jpg`,
  url: `https://unsplash.com/photos/${unsplashId}${utm}`,
  profile: `https://unsplash.com/@${username}${utm}`,
}));

export const findImage = (id: string | null) => IMAGES.find((img) => img.id === id);
