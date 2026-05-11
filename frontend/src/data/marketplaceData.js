/**
 * Marketplace Intelligence — synthetic but believable competitor catalogue.
 * Only public, marketplace-visible fields are modelled (no hidden ranks/sales).
 */

export const CATEGORIES = ['T-Shirts', 'Jeans', 'Jackets', 'Shirts', 'Trousers', 'Sweatshirts', 'Activewear'];

export const SKU_OPTIONS = {
  'T-Shirts':     ['VS-TS-BLK-OS', 'VS-TS-WHT-RG', 'VS-TS-BGE-VT', 'VS-TS-GRN-GR', 'VS-TS-NVY-AT'],
  'Jeans':        ['VS-JN-BLU-SK', 'VS-JN-BLK-ST', 'VS-JN-LBL-WD', 'VS-JN-GRY-CR', 'VS-JN-IND-RL'],
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

const COLORS = ['Coral', 'Ivory', 'Charcoal', 'Indigo', 'Olive', 'Rust', 'Black', 'Sand', 'Cream', 'Stone', 'Forest', 'White', 'Beige', 'Green', 'Navy', 'Blue', 'Grey', 'Light Blue', 'Denim'];
const FITS = ['Slim Fit', 'Relaxed Fit', 'Regular Fit', 'Oversized', 'Tailored', 'Athletic fit', 'Straight fit', 'Wide leg', 'Cropped straight', 'Jogger / Tapered', 'Tapered'];
const FABRICS = ['100% Cotton', 'Linen Blend', 'Viscose', 'Rayon', 'Cotton Lycra', 'Modal', 'Poly-Cotton'];
const POSITIONING = [
  'Premium Segment', 'Fast Fashion', 'Heavy Discounting', 'Bestseller',
  'Trend-Driven', 'Minimalist Styling', 'Occasion Wear', 'Streetwear',
];

// Granular image pool keyed by category + color + fit.
// Pools use locally-hosted product images so they never break or show wrong colours.
// Black Oversized pool = AI-generated real brand-style product photos.
// Other pools = existing VS- catalog photos + duplicated variants.
const _UN = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=600`;

// ── Competitor product image sets (generated, locally hosted) ─────────────
// Each array entry is a different photo so cycling gives unique images per card.
const _C  = (f) => `/products/competitors/${f}`; // competitor image helper

const _BLK_OS = [
  _C('blk_os_1.png'), _C('blk_os_2.png'), _C('blk_os_3.png'),
  _C('blk_os_4.png'), _C('blk_os_5.png'), _C('blk_os_6.png'),
  _C('blk_os_7.png'),
  // Supplement with catalog images so larger counts never repeat
  '/products/VS-TS-BLK-OS.webp',
  _C('blk_os_1.png'), _C('blk_os_3.png'), _C('blk_os_5.png'), _C('blk_os_7.png'),
];

const IMAGES_BY_ATTRIBUTES = {
  'T-Shirts': {
    'Black': {
      'Oversized': _BLK_OS,
      'Slim Fit':  _BLK_OS,
      'default':   _BLK_OS,
    },
    'White': {
      'Oversized': [
        _C('wht_rg_1.png'), '/products/VS-TS-WHT-RG.jpg',
        _C('wht_rg_1.png'), '/products/VS-TS-BGE-VT.webp',
      ],
      'default': [
        _C('wht_rg_1.png'), '/products/VS-TS-WHT-RG.jpg',
        '/products/VS-TS-BGE-VT.webp', _C('wht_rg_1.png'),
      ],
    },
    'default': [
      ..._BLK_OS.slice(0, 5),
      '/products/VS-TS-BLK-OS.webp', '/products/VS-TS-WHT-RG.jpg',
      '/products/VS-TS-BGE-VT.webp', '/products/VS-TS-GRN-GR.webp',
      '/products/VS-TS-NVY-AT.webp', _C('wht_rg_1.png'),
    ],
  },
  'Jeans': {
    'Blue': {
      'Slim Fit': [
        _UN('1542272604-787c3835535d'), _UN('1541099649105-f69ad21f3246'),
        _UN('1604176354204-9268737828e4'), '/products/VS-JN-BLU-SK.webp',
      ],
      'Regular Fit': [
        _UN('1582552938357-32b906df40cb'), _UN('1565084888279-aca607ecce0c'),
        _UN('1473445730015-841f29a9490b'),
      ],
      'default': [
        _UN('1542272604-787c3835535d'), _UN('1582552938357-32b906df40cb'),
        '/products/VS-JN-BLU-SK.webp', '/products/VS-JN-LBL-WD.webp',
      ],
    },
    'Black': {
      'Slim Fit': [
        _UN('1551854336-0fa0e6dbab92'), _UN('1542406775-ade58c52d2e4'),
        _UN('1584370848010-d7fe6bc767ec'), '/products/VS-JN-BLK-ST.webp',
      ],
      'default': [
        _UN('1551854336-0fa0e6dbab92'), _UN('1584370848010-d7fe6bc767ec'),
        '/products/VS-JN-BLK-ST.webp',
      ],
    },
    'default': [
      _UN('1542272604-787c3835535d'), _UN('1541099649105-f69ad21f3246'),
      _UN('1604176354204-9268737828e4'), _UN('1582552938357-32b906df40cb'),
      '/products/VS-JN-BLU-SK.webp', '/products/VS-JN-BLK-ST.webp',
      '/products/VS-JN-LBL-WD.webp', '/products/VS-JN-GRY-CR.webp',
      '/products/VS-JN-IND-RL.webp',
    ],
  },
  'Jackets': {
    'Black': {
      'default': [
        _UN('1551028719-00167b16eac5'), _UN('1539533018447-63fcce2678e3'),
        '/products/VS-JK-BLK-BM.webp', '/products/VS-JK-GRY-ST.webp',
      ],
    },
    'Denim': {
      'default': [
        _UN('1591047139829-d91aecb6caea'), _UN('1521223890158-f9f7c3d5d504'),
        '/products/VS-JK-DNM-TR.webp',
      ],
    },
    'default': [
      _UN('1551028719-00167b16eac5'), _UN('1591047139829-d91aecb6caea'),
      _UN('1544022613-e87ca75a784a'), _UN('1548883354-7622d03aca27'),
      '/products/VS-JK-BLK-BM.webp', '/products/VS-JK-OLV-UT.webp',
      '/products/VS-JK-DNM-TR.webp', '/products/VS-JK-CRM-PF.webp',
      '/products/VS-JK-GRY-ST.webp',
    ],
  },
  'Shirts': {
    'White': {
      'default': [
        _UN('1602810316693-3667c854239a'), _UN('1564859228273-274232fdb516'),
        '/products/VS-SH-WHT-LN.webp', '/products/VS-SH-BGE-OV.webp',
      ],
    },
    'Black': {
      'default': [
        _UN('1596755094514-f87e34085b2c'), _UN('1607345366928-199ea26cfe3e'),
        '/products/VS-SH-BLK-ST.webp',
      ],
    },
    'default': [
      _UN('1602810316693-3667c854239a'), _UN('1564859228273-274232fdb516'),
      _UN('1596755094514-f87e34085b2c'), _UN('1607345366928-199ea26cfe3e'),
      '/products/VS-SH-WHT-LN.webp', '/products/VS-SH-BLU-ST.webp',
      '/products/VS-SH-BLK-ST.webp', '/products/VS-SH-GRN-RS.webp',
      '/products/VS-SH-BGE-OV.webp',
    ],
  },
  'Trousers': {
    'Black': {
      'default': [
        _UN('1594938298603-c8148c4dae35'), '/products/VS-TR-BLK-CR.webp',
        '/products/VS-TR-NVY-SM.webp',
      ],
    },
    'Beige': {
      'default': [
        _UN('1473966968600-fa801b869a1a'), '/products/VS-TR-BGE-WL.webp',
      ],
    },
    'default': [
      _UN('1594938298603-c8148c4dae35'), _UN('1542272604-787c3835535d'),
      _UN('1473966968600-fa801b869a1a'), _UN('1551854838-212c50b4c184'),
      '/products/VS-TR-BLK-CR.webp', '/products/VS-TR-BGE-WL.webp',
      '/products/VS-TR-GRY-PL.webp', '/products/VS-TR-OLV-JG.webp',
      '/products/VS-TR-NVY-SM.webp',
    ],
  },
  'Sweatshirts': {
    'Black': {
      'default': [
        _UN('1556905055-8f358a7a47b2'), _UN('1577455532430-3f5b7e1de3e6'),
        '/products/VS-SW-BLK-MN.webp',
      ],
    },
    'default': [
      _UN('1556905055-8f358a7a47b2'), _UN('1620799140408-edc6dcb6d633'),
      _UN('1503342217505-b0a15ec3261c'), _UN('1577455532430-3f5b7e1de3e6'),
      '/products/VS-SW-GRY-OS.webp', '/products/VS-SW-BLK-MN.webp',
      '/products/VS-SW-CRM-VN.webp', '/products/VS-SW-GRN-HD.jpg',
      '/products/VS-SW-NVY-ZP.webp',
    ],
  },
  'Activewear': {
    'default': [
      _UN('1518611012118-696072aa579a'), _UN('1571019613454-1cb2f99b2d8b'),
      _UN('1593079831268-3381b0db4a77'), _UN('1517836357463-d25dfeac3438'),
      '/products/VS-AW-BLK-CP.jpg', '/products/VS-AW-GRY-JG.webp',
      '/products/VS-AW-BLU-RN.jpg', '/products/VS-AW-OLV-TK.jpg',
      '/products/VS-AW-PNK-YG.jpg',
    ],
  },
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
 *
 * Behaviour:
 *   - Cycles through every brand in BRANDS_BY_MARKETPLACE so each of the 15
 *     brands shows up at least once when count >= 15.
 *   - Cycles through the local image pool so each card shows a different
 *     product photo matching the category.
 *   - When `anchor` (the user's selected product) is provided, biases the
 *     first listings to share its color, fit, fabric, and a price band
 *     around its MRP — so the marketplace genuinely looks similar.
 */
export function generateCompetitorProducts(marketplaceId, category, count = 24, anchor = null) {
  const brands = BRANDS_BY_MARKETPLACE[marketplaceId] || [];
  const products = [];

  // Anchor attributes pulled from the user's selected product (if any)
  const anchorPrice = typeof anchor === 'number' ? anchor : (anchor?.mrp ?? anchor?.selling_price ?? anchor?.cost_price ?? null);
  const anchorColor   = anchor?.specifications?.color || anchor?.color || null;
  const anchorFit     = anchor?.specifications?.fit || anchor?.fit || null;
  const anchorFabric  = anchor?.specifications?.material || anchor?.material || null;
  const anchorImage   = (typeof anchor === 'object' && anchor?.image) ? anchor.image : null;

  // Helper to get image pool based on category+color+fit
  function getImagePool(cat, col, fitVal) {
    const catPool = IMAGES_BY_ATTRIBUTES[cat] || IMAGES_BY_ATTRIBUTES['T-Shirts'];
    const normalizedColor = col ? col.charAt(0).toUpperCase() + col.slice(1).toLowerCase() : null;
    let colorPool = null;
    if (normalizedColor) {
      const colorKey = Object.keys(catPool).find(k => k.toLowerCase() === normalizedColor.toLowerCase());
      if (colorKey && catPool[colorKey]) {
        colorPool = catPool[colorKey];
      }
    }
    if (colorPool) {
      if (fitVal) {
        const fitKey = Object.keys(colorPool).find(k => k.toLowerCase() === fitVal.toLowerCase());
        if (fitKey && fitKey !== 'default') return colorPool[fitKey];
        const partialFitKey = Object.keys(colorPool).find(k =>
          k !== 'default' && k.toLowerCase().includes(fitVal.toLowerCase().split(' ')[0])
        );
        if (partialFitKey) return colorPool[partialFitKey];
      }
      return colorPool['default'] || colorPool;
    }
    return catPool['default'] || [];
  }

  // Per-marketplace offset so each platform shows different images for the
  // same brand/index combination — simulating distinct catalogue pulls.
  const mpOffset = { myntra: 0, ajio: 3, amazon: 6, flipkart: 9 }[marketplaceId] || 0;

  for (let i = 0; i < count; i += 1) {
    const seed = _hash(`${marketplaceId}-${category}-${i}`);

    // Cycle brands so every one of the 15 appears at least once
    const brand = brands[i % brands.length];

    // Bias first 60% of cards toward anchor's color/fit/fabric so they look
    // visibly similar, then diversify for breadth.
    const similarSlot = i < Math.ceil(count * 0.6);
    const color   = (similarSlot && anchorColor)  ? anchorColor  : pick(COLORS, seed >> 2);
    const fit     = (similarSlot && anchorFit)    ? anchorFit    : pick(FITS, seed >> 3);
    const fabric  = (similarSlot && anchorFabric) ? anchorFabric : pick(FABRICS, seed >> 4);
    const positioning = pick(POSITIONING, seed >> 5);

    // Get image pool based on current color/fit (which may be anchor's or random)
    let pool = getImagePool(category, color, fit);
    // Exclude anchor image from pool
    if (anchorImage) {
      pool = pool.filter((url) => url !== anchorImage);
    }
    // If pool empty, fallback to category default
    if (!pool || pool.length === 0) {
      pool = getImagePool(category, null, null);
      if (anchorImage) {
        pool = pool.filter((url) => url !== anchorImage);
      }
    }
    // Cycle through pool with marketplace offset
    const image = pool[(i + mpOffset) % pool.length];

    // Marketplace pricing tilt — anchor around the selected product's price when available
    let basePrice;
    if (anchorPrice) {
      const mpShift = { myntra: 0.05, ajio: 0.12, amazon: -0.15, flipkart: -0.2 }[marketplaceId] || 0;
      const variance = ((seed % 80) - 40) / 100; // -40% to +40%
      basePrice = Math.round(anchorPrice * (1 + variance + mpShift));
      basePrice = Math.max(basePrice, 299);
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

    // Title pulls the category singular + dominant attributes
    const fitWord = (fit || '').split(' ')[0];
    const titleBase = category.replace(/s$/, '');
    const title = `${color || ''} ${fitWord || ''} ${titleBase}`.replace(/\s+/g, ' ').trim();

    products.push({
      id: `${marketplaceId}-${category}-${i}`.toLowerCase().replace(/\s+/g, '-'),
      title,
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
      delivery: (seed % 3 === 0) ? 'Express, same city' : 'Standard, 4\u20136 days',
      image,
      hoverImage: image,
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
