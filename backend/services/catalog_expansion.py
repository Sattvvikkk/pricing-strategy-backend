"""
Catalog Expansion - generates additional deterministic SKUs and attaches
real Unsplash photo URLs to every product.

The 40 hand-curated SKUs in product_catalog.DEFAULT_PRODUCTS are kept as-is.
This module produces ~100 extra dummy SKUs (Vouge Studio extended catalogue)
so the Overview feels like a full operating brand, not a demo.

All values are derived from a deterministic hash of the SKU id, so calls are
idempotent across requests.
"""
from __future__ import annotations

import hashlib
from typing import Dict, List


# ── Image registry ───────────────────────────────────────────────────────────
# Curated Unsplash photo IDs grouped by category. Every URL points at the
# Unsplash CDN with `auto=format&fit=crop&q=80&w=600` so cards render fast and
# stay sharp on retina. If a photo ID is removed in the future, the frontend
# falls back to the deterministic gradient cover.

UNSPLASH_BY_CATEGORY: Dict[str, List[str]] = {
    "T-Shirts": [
        "1521572163474-6864f9cf17ab",
        "1583743814966-8936f5b7be1a",
        "1620799140408-edc6dcb6d633",
        "1503342217505-b0a15ec3261c",
        "1576566588028-4147f3842f27",
        "1581655353564-df123a1eb820",
        "1622445275576-721325763afe",
        "1618354691373-d851c5c3a990",
    ],
    "Shirts": [
        "1602810316693-3667c854239a",
        "1589310243389-96a5483213a8",
        "1604695573706-53170668f6a6",
        "1620012253295-c15cc3e65df4",
    ],
    "Jeans": [
        "1542272604-787c3835535d",
        "1541099649105-f69ad21f3246",
        "1604176354204-9268737828e4",
        "1582552938357-32b906df40cb",
        "1604176424472-9d7122c0c1a8",
        "1565084888279-aca607ecce0c",
    ],
    "Trousers": [
        "1594938298603-c8148c4dae35",
        "1473966968600-fa801b3a3f1f",
        "1624378439575-d8705ad7ae80",
        "1593030761757-71fae45fa0e7",
    ],
    "Jackets": [
        "1551028719-00167b16eac5",
        "1591047139829-d91aecb6caea",
        "1559551409-dadc959f76b8",
        "1544022613-e87ca75a784a",
        "1548883354-7622d03aca27",
        "1520975954732-35dd22299614",
    ],
    "Sweatshirts": [
        "1556905055-8f358a7a47b2",
        "1620799140408-edc6dcb6d633",
        "1578587018452-892bacefd3f2",
        "1591195853828-11db59a44f6b",
    ],
    "Activewear": [
        "1518611012118-696072aa579a",
        "1571019613454-1cb2f99b2d8b",
        "1593079831268-3381b0db4a77",
        "1517836357463-d25dfeac3438",
        "1506629082955-511b1aa562c8",
    ],
}

# Generic fallback when a category has no entry.
UNSPLASH_FALLBACK = [
    "1490481651871-ab68de25d43d",
    "1521572163474-6864f9cf17ab",
    "1503342217505-b0a15ec3261c",
]


def _seed(text: str) -> int:
    return int(hashlib.md5(text.encode("utf-8")).hexdigest()[:8], 16)


def image_for(product: dict) -> str:
    """Return a stable Unsplash CDN URL for the given product."""
    cat = product.get("category") or ""
    pool = UNSPLASH_BY_CATEGORY.get(cat) or UNSPLASH_FALLBACK
    pid = pool[_seed(product.get("id") or product.get("sku") or "x") % len(pool)]
    return f"https://images.unsplash.com/photo-{pid}?auto=format&fit=crop&q=80&w=600"


def attach_image(product: dict) -> dict:
    if not product.get("image"):
        product["image"] = image_for(product)
    return product


# ── Generated catalogue ──────────────────────────────────────────────────────

# Each tuple: (category, name templates list, fit options, fabric options,
# size set, base price range, base cost ratio).
_TEMPLATES = [
    {
        "category": "T-Shirts",
        "names": [
            "Heritage Pocket Tee", "Boxy Drop-Shoulder Tee", "Vintage Wash Tee",
            "Long-Sleeve Henley", "Striped Sailor Tee", "Garment-Dyed Crew",
            "Linen-Blend Tee", "Ribbed Tank",
        ],
        "fits": ["Relaxed fit", "Boxy", "Slim fit", "Regular fit"],
        "materials": [
            "100% Combed Cotton", "Cotton-Linen Blend", "Heavy 220 GSM Cotton",
            "Pima Cotton",
        ],
        "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
        "price_range": (599, 1499),
        "cost_ratio": (0.32, 0.42),
        "sku_prefix": "VS-TEE",
        "sku_start": 100,
    },
    {
        "category": "Shirts",
        "names": [
            "Linen Resort Shirt", "Oxford Button-Down", "Mandarin Collar Shirt",
            "Cuban Camp Shirt", "Embroidered Khadi Shirt", "Corduroy Overshirt",
            "Western Yoke Shirt", "Striped Poplin Shirt",
        ],
        "fits": ["Slim fit", "Regular fit", "Relaxed fit"],
        "materials": [
            "100% Linen", "Cotton Poplin", "Cotton-Linen Blend",
            "Cotton Corduroy",
        ],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "price_range": (1299, 2999),
        "cost_ratio": (0.34, 0.44),
        "sku_prefix": "VS-SHT",
        "sku_start": 1,
    },
    {
        "category": "Jeans",
        "names": [
            "Tapered Selvedge Jean", "Cropped Mom Jean", "Distressed Boyfriend",
            "High-Rise Flare Jean", "Stone-Wash Bootcut", "Acid-Wash Skinny",
            "Black Stretch Jean",
        ],
        "fits": ["Slim fit", "Skinny", "Bootcut", "Wide leg", "Relaxed"],
        "materials": [
            "98% Cotton, 2% Elastane", "100% Cotton Denim", "Selvedge Denim 13oz",
            "Stretch Denim 10oz",
        ],
        "sizes": ["28", "30", "32", "34", "36", "38"],
        "price_range": (1599, 3299),
        "cost_ratio": (0.36, 0.46),
        "sku_prefix": "VS-JNS",
        "sku_start": 100,
    },
    {
        "category": "Trousers",
        "names": [
            "Pleated Wool Trouser", "Wide-Leg Linen Trouser", "Tapered Chino",
            "Drawstring Lounge Pant", "Cargo Utility Pant", "Cropped Pleat Pant",
        ],
        "fits": ["Pleated", "Tapered", "Wide leg", "Slim fit"],
        "materials": [
            "100% Linen", "Wool Blend", "Cotton Twill", "Stretch Cotton",
        ],
        "sizes": ["28", "30", "32", "34", "36"],
        "price_range": (1499, 3499),
        "cost_ratio": (0.34, 0.44),
        "sku_prefix": "VS-TRS",
        "sku_start": 1,
    },
    {
        "category": "Jackets",
        "names": [
            "Suede Bomber", "Quilted Vest", "Wool Overshirt",
            "Faux Leather Biker", "Reversible Windcheater", "Hooded Anorak",
            "Mock-Neck Puffer",
        ],
        "fits": ["Regular fit", "Slim fit", "Relaxed"],
        "materials": [
            "Faux Suede", "Wool Blend", "Polyamide Shell", "Quilted Polyester",
            "Faux Leather",
        ],
        "sizes": ["S", "M", "L", "XL"],
        "price_range": (2499, 5999),
        "cost_ratio": (0.36, 0.48),
        "sku_prefix": "VS-JKT",
        "sku_start": 100,
    },
    {
        "category": "Sweatshirts",
        "names": [
            "Heavyweight Crewneck", "Cropped Hoodie", "Embroidered Sweat",
            "Half-Zip Pullover", "Vintage Logo Hoodie", "Quarter-Snap Sweat",
        ],
        "fits": ["Boxy", "Regular fit", "Cropped", "Oversized"],
        "materials": [
            "400 GSM Loopback Cotton", "French Terry", "Brushed Fleece",
            "Cotton-Polyester Blend",
        ],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "price_range": (1499, 2999),
        "cost_ratio": (0.34, 0.44),
        "sku_prefix": "VS-SWT",
        "sku_start": 1,
    },
    {
        "category": "Activewear",
        "names": [
            "Compression Tights", "Seamless Tank", "Track Pant",
            "Yoga Sports Bra", "Wind-Resistant Run Jacket", "Performance Polo",
            "Quick-Dry Tee", "Cropped Run Top",
        ],
        "fits": ["Compression", "Slim fit", "Regular fit"],
        "materials": [
            "Recycled Polyester", "Nylon-Spandex Blend", "Mesh Polyester",
            "Quick-Dry Microfibre",
        ],
        "sizes": ["XS", "S", "M", "L", "XL"],
        "price_range": (999, 2499),
        "cost_ratio": (0.32, 0.42),
        "sku_prefix": "VS-ACT",
        "sku_start": 1,
    },
]

_COLORS = [
    "Ecru", "Sage", "Onyx", "Sandstone", "Cobalt", "Rosewood",
    "Charcoal", "Cream", "Forest", "Ink", "Champagne", "Burgundy",
    "Olive", "Slate", "Dusty Pink", "Camel", "Rust", "Indigo",
]


def _pick(seed: int, items: list, salt: int = 0):
    return items[(seed + salt) % len(items)]


def _generate_one(template: dict, idx: int) -> dict:
    """Build one deterministic SKU from a template and an index."""
    name = template["names"][idx % len(template["names"])]
    color = _COLORS[idx % len(_COLORS)]
    full_name = f"{color} {name}"
    sku_num = template["sku_start"] + idx
    sku = f"{template['sku_prefix']}-{sku_num:03d}"
    pid = f"vs-{template['sku_prefix'].lower().replace('vs-', '')}-{sku_num:03d}-{color.lower().replace(' ', '-')}"

    seed = _seed(pid)
    lo, hi = template["price_range"]
    price = lo + (seed % (hi - lo + 1))
    # Round to nearest 49 / 99 for realistic retail psychology.
    price = round(price / 50) * 50 - 1
    cost_lo, cost_hi = template["cost_ratio"]
    cost_ratio = cost_lo + ((seed >> 4) % 1000) / 1000 * (cost_hi - cost_lo)
    cost_price = round(price * cost_ratio, 2)

    fit = _pick(seed, template["fits"])
    material = _pick(seed, template["materials"], salt=3)
    stock = 80 + (seed % 1100)
    rating = round(3.7 + ((seed >> 8) % 100) / 100 * 1.2, 1)
    reviews = 12 + (seed % 480)

    return {
        "id": pid,
        "name": full_name,
        "brand": "Vouge Studio",
        "price": float(price),
        "cost_price": float(cost_price),
        "currency": "INR",
        "category": template["category"],
        "sku": sku,
        "search_query": f"{color.lower()} {name.lower()}",
        "description": (
            f"{full_name} - cut from {material.lower()} with a {fit.lower()} "
            f"silhouette. A core piece in the Vouge Studio extended catalogue."
        ),
        "specifications": {
            "fit": fit,
            "material": material,
            "color": color,
        },
        "sizes": template["sizes"],
        "stock": stock,
        "rating": rating,
        "reviews": reviews,
    }


def build_extra_catalogue() -> Dict[str, dict]:
    """Generate the full extended catalogue (~100 SKUs)."""
    out: Dict[str, dict] = {}
    for tpl in _TEMPLATES:
        for i in range(len(tpl["names"]) * 2):  # 2 colorways per name
            p = _generate_one(tpl, i)
            attach_image(p)
            out[p["id"]] = p
    return out


EXTRA_CATALOGUE: Dict[str, dict] = build_extra_catalogue()
