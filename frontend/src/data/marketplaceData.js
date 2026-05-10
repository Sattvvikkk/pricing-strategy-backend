/**
 * Marketplace Intelligence — synthetic but believable competitor catalogue.
 * Only public, marketplace-visible fields are modelled (no hidden ranks/sales).
 */

export const CATEGORIES = ['T-Shirts', 'Jeans', 'Dresses', 'Jackets', 'Shirts', 'Trousers', 'Sweatshirts', 'Activewear'];

export const SKU_OPTIONS = {
  'T-Shirts':     ['VS-TS-BLK-OS', 'VS-TS-WHT-RG', 'VS-TS-BGE-VT', 'VS-TS-GRN-GR', 'VS-TS-NVY-AT'],
  'Jeans':        ['VS-JN-BLU-SK', 'VS-JN-BLK-ST', 'VS-JN-LBL-WD', 'VS-JN-GRY-CR', 'VS-JN-IND-RL'],
  'Dresses':      ['VS-DR-CRL-WR', 'VS-DR-BLK-MD', 'VS-DR-PNK-SL', 'VS-DR-WHT-SM', 'VS-DR-BLU-BD'],
  'Jackets':      ['VS-JK-BLK-BM', 'VS-JK-OLV-UT', 'VS-JK-DNM-TR', 'VS-JK-CRM-PF', 'VS-JK-GRY-ST'],
  'Shirts':       ['VS-SH-WHT-LN', 'VS-SH-BLU-ST', 'VS-SH-BLK-ST', 'VS-SH-GRN-RS', 'VS-SH-BGE-OV'],
  'Trousers':     ['VS-TR-BLK-CR', 'VS-TR-BGE-WL', 'VS-TR-GRY-PL', 'VS-TR-OLV-JG', 'VS-TR-NVY-SM'],
  'Sweatshirts':  ['VS-SW-GRY-OS', 'VS-SW-BLK-MN', 'VS-SW-CRM-VN', 'VS-SW-GRN-HD', 'VS-SW-NVY-ZP'],
  'Activewear':   ['VS-AW-BLK-CP', 'VS-AW-GRY-JG', 'VS-AW-BLU-RN', 'VS-AW-OLV-TK', 'VS-AW-PNK-YG'],
};

export const MARKETPLACES = [
  {
    id: 'myntra',
    name: 'Myntra',
    tagline: 'Fashion-forward marketplace',
    description: 'Trend-heavy discovery ecosystem',
    accent: '#ff3f6c',
    glow: 'rgba(255, 63, 108, 0.18)',
    metrics: { density: 'High', visibility: 'Editorial', tilt: 'Trend' },
  },
  {
    id: 'ajio',
    name: 'Ajio',
    tagline: 'Premium contemporary positioning',
    description: 'Editorial merchandising focus',
    accent: '#d4a157',
    glow: 'rgba(212, 161, 87, 0.18)',
    metrics: { density: 'Curated', visibility: 'Premium', tilt: 'Contemporary' },
  },
  {
    id: 'amazon',
    name: 'Amazon Fashion',
    tagline: 'Mass assortment visibility',
    description: 'Broad pricing spectrum',
    accent: '#ffae3d',
    glow: 'rgba(255, 174, 61, 0.18)',
    metrics: { density: 'Massive', visibility: 'Broad', tilt: 'Variety' },
  },
  {
    id: 'flipkart',
    name: 'Flipkart Fashion',
    tagline: 'High-volume fashion discovery',
    description: 'Value-focused catalogue ecosystem',
    accent: '#4d8eff',
    glow: 'rgba(77, 142, 255, 0.18)',
    metrics: { density: 'Volume', visibility: 'Value', tilt: 'Discount' },
  },
];

export const SCAN_DEPTHS = [
  { id: 'quick',    label: 'Quick',    note: 'Top 60 listings per platform' },
  { id: 'standard', label: 'Standard', note: 'Top 200 listings per platform' },
  { id: 'deep',     label: 'Deep',     note: 'Full visible catalogue' },
];

export const SIMILARITY_MODES = [
  { id: 'category',  label: 'Exact Category' },
  { id: 'aesthetic', label: 'Similar Aesthetic' },
  { id: 'price',     label: 'Similar Price Range' },
  { id: 'fabric',    label: 'Similar Fabric' },
  { id: 'fit',       label: 'Similar Fit' },
];

export const BRANDS_BY_MARKETPLACE = {
  myntra: [
    'Roadster', 'Tokyo Talkies', 'DressBerry', 'Athena', 'HERE&NOW',
    'SASSAFRAS', 'Sangria', 'Chemistry', 'StyleCast', 'KASSUALLY',
    'Berrylush', 'Mast & Harbour', 'Moda Rapido', 'Campus Sutra', 'Anouk',
  ],
  ajio: [
    'Outryt', 'Avaasa', 'Netplay', 'Teamspirit', 'Indie Picks',
    'Rio', 'DNMX', 'Project Eve', 'Puma', 'GAP',
    'Superdry', 'Stylum', 'The Indian Garage Co', 'Miss Chase', 'Fig',
  ],
  amazon: [
    'Symbol', 'Allen Solly', "Levi's", 'Van Heusen', 'U.S. Polo Assn.',
    'Max', 'Global Desi', 'Pepe Jeans', 'Kraus Jeans', 'Campus Sutra',
    'Bewakoof', 'W for Woman', 'BIBA', 'Only', 'Miss Chase',
  ],
  flipkart: [
    'Highlander', 'Harvard', 'Provogue', 'Metronaut', 'Veirdo',
    'Urbano Fashion', 'Tokyo Talkies', 'Sassafras', 'Hubberholme', 'Ketch',
    'Funday Fashion', 'Campus Sutra', 'Mast & Harbour', 'Dollar Missy', 'Allen Solly',
  ],
};

const COLORS = ['Coral', 'Ivory', 'Charcoal', 'Indigo', 'Olive', 'Rust', 'Black', 'Sand', 'Cream', 'Stone', 'Forest'];
const FITS = ['Slim Fit', 'Relaxed Fit', 'Regular Fit', 'Oversized', 'Tailored'];
const FABRICS = ['100% Cotton', 'Linen Blend', 'Viscose', 'Rayon', 'Cotton Lycra', 'Modal', 'Poly-Cotton'];
const POSITIONING = [
  'Premium Segment', 'Fast Fashion', 'Heavy Discounting', 'Bestseller',
  'Trend-Driven', 'Minimalist Styling', 'Occasion Wear', 'Streetwear',
];

const IMAGE_BY_CATEGORY = {
  'T-Shirts':     'photo-1521572163474-6864f9cf17ab',
  'Jeans':        'photo-1542272604-787c3835535d',
  'Dresses':      'photo-1539109136881-3be0616acf4b',
  'Jackets':      'photo-1551028719-00167b16eac5',
  'Shirts':       'photo-1602810316693-3667c854239a',
  'Trousers':     'photo-1594938298603-c8148c4dae35',
  'Sweatshirts':  'photo-1556905055-8f358a7a47b2',
  'Activewear':   'photo-1518611012118-696072aa579a',
};

function _hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(arr, seed) { return arr[seed % arr.length]; }

/**
 * Generate a deterministic competitor product list per marketplace for the
 * selected category. All values are publicly observable on the marketplace.
 */
export function generateCompetitorProducts(marketplaceId, category, count = 24, anchorPrice = null) {
  const brands = BRANDS_BY_MARKETPLACE[marketplaceId] || [];
  const products = [];
  const baseImg = IMAGE_BY_CATEGORY[category] || IMAGE_BY_CATEGORY.Dresses;
  for (let i = 0; i < count; i += 1) {
    const seed = _hash(`${marketplaceId}-${category}-${i}`);
    const brand = brands[seed % brands.length];
    const color = pick(COLORS, seed >> 2);
    const fit = pick(FITS, seed >> 3);
    const fabric = pick(FABRICS, seed >> 4);
    const positioning = pick(POSITIONING, seed >> 5);

    // Marketplace pricing tilt — anchor around the selected product's price when available
    let basePrice;
    if (anchorPrice) {
      // Generate competitors in a band around the anchor price (±40%)
      const mpShift = { myntra: 0.05, ajio: 0.12, amazon: -0.15, flipkart: -0.2 }[marketplaceId] || 0;
      const variance = ((seed % 80) - 40) / 100; // -40% to +40%
      basePrice = Math.round(anchorPrice * (1 + variance + mpShift));
      basePrice = Math.max(basePrice, 299); // floor
    } else {
      basePrice = {
        myntra:   1200 + (seed % 1800),
        ajio:     1600 + (seed % 2200),
        amazon:    700 + (seed % 2800),
        flipkart:  600 + (seed % 1900),
      }[marketplaceId] || 1500;
    }

    const mrp = Math.round((basePrice * 1.6) / 10) * 10;
    const discountPct = 15 + (seed % 60);
    const price = Math.round((mrp * (100 - discountPct) / 100) / 10) * 10;

    const rating = Number((3.6 + ((seed % 13) / 10)).toFixed(1));
    const reviews = 80 + (seed % 5800);
    const bestseller = (seed % 11) < 2;
    const newArrival = !bestseller && (seed % 9) < 2;
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].filter((_, k) => ((seed >> (k + 1)) & 1) === 1 || k <= 3);

    products.push({
      id: `${marketplaceId}-${category}-${i}`.toLowerCase().replace(/\s+/g, '-'),
      title: `${color} ${fit.split(' ')[0]} ${category.replace(/s$/, '')}`,
      brand,
      marketplace: marketplaceId,
      category,
      color,
      fit,
      fabric,
      mrp,
      price,
      discountPct,
      rating,
      reviews,
      sizes,
      seller: `${brand} Official Store`,
      bestseller,
      newArrival,
      positioning,
      delivery: (seed % 3 === 0) ? 'Express, same city' : 'Standard, 4–6 days',
      image: `https://images.unsplash.com/${baseImg}?auto=format&fit=crop&q=80&w=600`,
      hoverImage: `https://images.unsplash.com/${baseImg}?auto=format&fit=crop&q=80&w=600&sat=-30`,
    });
  }
  return products;
}

export function marketplaceSummary(marketplaceId, products) {
  if (!products.length) return null;
  const avgPrice = Math.round(
    products.reduce((s, p) => s + p.price, 0) / products.length,
  );
  const avgDiscount = Math.round(
    products.reduce((s, p) => s + p.discountPct, 0) / products.length,
  );
  const avgRating = (
    products.reduce((s, p) => s + p.rating, 0) / products.length
  ).toFixed(2);
  
  // Price range
  const prices = products.map(p => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // Dominant fit
  const fitCount = {};
  for (const p of products) fitCount[p.fit] = (fitCount[p.fit] || 0) + 1;
  const dominantFit = Object.entries(fitCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  
  // Dominant color
  const colorCount = {};
  for (const p of products) colorCount[p.color] = (colorCount[p.color] || 0) + 1;
  const dominantColor = Object.entries(colorCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  
  // Top brands
  const brandCount = {};
  for (const p of products) brandCount[p.brand] = (brandCount[p.brand] || 0) + 1;
  const topBrands = Object.entries(brandCount).sort((a, b) => b[1] - a[1]).map(([brand]) => brand);
  
  // Bestsellers and new arrivals
  const bestsellerCount = products.filter(p => p.bestseller).length;
  const newArrivalCount = products.filter(p => p.newArrival).length;
  
  // Reviews and delivery
  const totalReviews = products.reduce((s, p) => s + p.reviews, 0);
  const avgDelivery = Math.round(products.reduce((s, p) => {
    const days = p.delivery.includes('same') ? 1 : p.delivery.includes('Express') ? 2 : 5;
    return s + days;
  }, 0) / products.length);
  
  // Competition level based on listing density
  const competitionLevel = products.length > 50 ? 'High' : products.length > 25 ? 'Medium' : 'Low';
  
  // Growth trend (mock data)
  const growthTrends = ['Growing', 'Stable', 'Declining', 'Volatile'];
  const growthTrend = growthTrends[marketplaceId.charCodeAt(0) % growthTrends.length];

  return {
    listings: products.length,
    avgPrice,
    minPrice,
    maxPrice,
    avgDiscount,
    avgRating,
    totalReviews,
    topBrands,
    dominantFit,
    dominantColor,
    bestsellerCount,
    newArrivalCount,
    avgDelivery,
    reviewDensity: totalReviews > products.length * 1500 ? 'High' : 'Moderate',
    competitionLevel,
    growthTrend,
  };
}
