"""Product Catalog — 40 Vouge Studio SKUs for PriceEngine."""

from services.catalog_expansion import EXTRA_CATALOGUE, attach_image

# Unsplash photo IDs per product for high-quality individual images
_IMG = {
    # T-Shirts
    "VS-TS-BLK-OS": "1618677366787-9727d8aa4cab",  # Oversized black tee
    "VS-TS-WHT-RG": "1521572163474-6864f9cf17ab",  # Classic white crew
    "VS-TS-BGE-VT": "1553979459-d2229ba7433b",      # Vintage washed beige
    "VS-TS-GRN-GR": "1618355776464-8666794d2520",  # Graphic green street
    "VS-TS-NVY-AT": "1581655353564-df123a1eb820",  # Athletic fit navy
    # Jeans
    "VS-JN-BLU-SK": "1542272604-787c3835535d",
    "VS-JN-BLK-ST": "1541099649105-f69ad21f3246",
    "VS-JN-LBL-WD": "1604176354204-9268737828e4",
    "VS-JN-GRY-CR": "1582552938357-32b906df40cb",
    "VS-JN-IND-RL": "1565084888279-aca607ecce0c",
    # Jackets
    "VS-JK-BLK-BM": "1551028719-00167b16eac5",
    "VS-JK-OLV-UT": "1591047139829-d91aecb6caea",
    "VS-JK-DNM-TR": "1544022613-e87ca75a784a",
    "VS-JK-CRM-PF": "1548883354-7622d03aca27",
    "VS-JK-GRY-ST": "1559551409-dadc959f76b8",
    # Shirts
    "VS-SH-WHT-LN": "1602810316693-3667c854239a",
    "VS-SH-BLU-ST": "1589310243389-96a5483213a8",
    "VS-SH-BLK-ST": "1604695573706-53170668f6a6",
    "VS-SH-GRN-RS": "1620012253295-c15cc3e65df4",
    "VS-SH-BGE-OV": "1598032895397-b16abe7a8e60",
    # Trousers
    "VS-TR-BLK-CR": "1594938298603-c8148c4dae35",
    "VS-TR-BGE-WL": "1473966968600-fa801b3a3f1f",
    "VS-TR-GRY-PL": "1624378439575-d8705ad7ae80",
    "VS-TR-OLV-JG": "1593030761757-71fae45fa0e7",
    "VS-TR-NVY-SM": "1506629082955-511b1aa562c8",
    # Sweatshirts
    "VS-SW-GRY-OS": "1556905055-8f358a7a47b2",
    "VS-SW-BLK-MN": "1578587018452-892bacefd3f2",
    "VS-SW-CRM-VN": "1591195853828-11db59a44f6b",
    "VS-SW-GRN-HD": "1620799140408-edc6dcb6d633",
    "VS-SW-NVY-ZP": "1503342217505-b0a15ec3261c",
    # Activewear
    "VS-AW-BLK-CP": "1518611012118-696072aa579a",
    "VS-AW-GRY-JG": "1571019613454-1cb2f99b2d8b",
    "VS-AW-BLU-RN": "1593079831268-3381b0db4a77",
    "VS-AW-OLV-TK": "1517836357463-d25dfeac3438",
    "VS-AW-PNK-YG": "1506629082955-511b1aa562c8",
}

# Per-SKU local image override (relative to frontend `public/`).
# Files live at `frontend/public/products/<filename>` so Vite serves them
# directly. Add a new entry here as soon as a real product photo is dropped
# into that folder.
_LOCAL_IMG = {
    # T-Shirts
    "VS-TS-BLK-OS": "/products/VS-TS-BLK-OS.webp",
    "VS-TS-WHT-RG": "/products/VS-TS-WHT-RG.jpg",
    "VS-TS-BGE-VT": "/products/VS-TS-BGE-VT.webp",
    "VS-TS-GRN-GR": "/products/VS-TS-GRN-GR.webp",
    "VS-TS-NVY-AT": "/products/VS-TS-NVY-AT.webp",
    # Jeans
    "VS-JN-BLU-SK": "/products/VS-JN-BLU-SK.webp",
    "VS-JN-BLK-ST": "/products/VS-JN-BLK-ST.webp",
    "VS-JN-LBL-WD": "/products/VS-JN-LBL-WD.webp",
    "VS-JN-GRY-CR": "/products/VS-JN-GRY-CR.webp",
    "VS-JN-IND-RL": "/products/VS-JN-IND-RL.webp",
    # Jackets
    "VS-JK-BLK-BM": "/products/VS-JK-BLK-BM.webp",
    "VS-JK-OLV-UT": "/products/VS-JK-OLV-UT.webp",
    "VS-JK-DNM-TR": "/products/VS-JK-DNM-TR.webp",
    "VS-JK-CRM-PF": "/products/VS-JK-CRM-PF.webp",
    "VS-JK-GRY-ST": "/products/VS-JK-GRY-ST.webp",
    # Shirts
    "VS-SH-WHT-LN": "/products/VS-SH-WHT-LN.webp",
    "VS-SH-BLU-ST": "/products/VS-SH-BLU-ST.webp",
    "VS-SH-BLK-ST": "/products/VS-SH-BLK-ST.webp",
    "VS-SH-GRN-RS": "/products/VS-SH-GRN-RS.webp",
    "VS-SH-BGE-OV": "/products/VS-SH-BGE-OV.webp",
    # Trousers
    "VS-TR-BLK-CR": "/products/VS-TR-BLK-CR.webp",
    "VS-TR-BGE-WL": "/products/VS-TR-BGE-WL.webp",
    "VS-TR-GRY-PL": "/products/VS-TR-GRY-PL.webp",
    "VS-TR-OLV-JG": "/products/VS-TR-OLV-JG.webp",
    "VS-TR-NVY-SM": "/products/VS-TR-NVY-SM.webp",
    # Sweatshirts
    "VS-SW-GRY-OS": "/products/VS-SW-GRY-OS.webp",
    "VS-SW-BLK-MN": "/products/VS-SW-BLK-MN.webp",
    "VS-SW-CRM-VN": "/products/VS-SW-CRM-VN.webp",
    "VS-SW-GRN-HD": "/products/VS-SW-GRN-HD.jpg",
    "VS-SW-NVY-ZP": "/products/VS-SW-NVY-ZP.webp",
    # Activewear
    "VS-AW-BLK-CP": "/products/VS-AW-BLK-CP.jpg",
    "VS-AW-GRY-JG": "/products/VS-AW-GRY-JG.webp",
    "VS-AW-BLU-RN": "/products/VS-AW-BLU-RN.jpg",
    "VS-AW-OLV-TK": "/products/VS-AW-OLV-TK.jpg",
    "VS-AW-PNK-YG": "/products/VS-AW-PNK-YG.jpg",
}


def _img(sku):
    if sku in _LOCAL_IMG:
        return _LOCAL_IMG[sku]
    pid = _IMG.get(sku, "1521572163474-6864f9cf17ab")
    return f"https://images.unsplash.com/photo-{pid}?auto=format&fit=crop&q=80&w=600"

def _p(id, name, sku, cat, price, cost, color, fit, material, desc, sizes, stock, rating, reviews, **extra_specs):
    specs = {"fit": fit, "material": material, "color": color}
    specs.update(extra_specs)
    # Calculate landing_cost as cost + 3-8% overhead
    landing_cost = round(cost + cost * 0.05, 2)
    return {
        "id": id, "name": name, "brand": "Vouge Studio", "price": price,
        "cost_price": cost, "landing_cost": landing_cost, "currency": "INR", "category": cat, "sku": sku,
        "search_query": f"{color.lower()} {name.lower()}",
        "description": desc, "specifications": specs,
        "sizes": sizes, "stock": stock, "rating": rating, "reviews": reviews,
        "image": _img(sku),
    }

_SZ_TEE = ["XS", "S", "M", "L", "XL", "XXL"]
_SZ_JN = ["28", "30", "32", "34", "36", "38"]
_SZ_DR = ["XS", "S", "M", "L", "XL"]
_SZ_JK = ["S", "M", "L", "XL", "XXL"]
_SZ_SH = ["S", "M", "L", "XL", "XXL"]
_SZ_TR = ["28", "30", "32", "34", "36"]
_SZ_SW = ["S", "M", "L", "XL", "XXL"]
_SZ_AW = ["XS", "S", "M", "L", "XL"]

DEFAULT_PRODUCTS = {}
_all = [
    # ── T-SHIRTS ──
    _p("vs-ts-blk-os", "Oversized Essential Tee – Black", "VS-TS-BLK-OS", "T-Shirts",
       999, 340, "Black", "Oversized", "100% Cotton 240 GSM",
       "Drop-shoulder oversized tee in heavy-weight cotton. Pre-shrunk, enzyme-washed for a buttery soft hand feel.",
       _SZ_TEE, 1200, 4.6, 342, sleeve="Drop shoulder", weight="240 GSM"),
    _p("vs-ts-wht-rg", "Classic Crew Tee – White", "VS-TS-WHT-RG", "T-Shirts",
       799, 280, "White", "Regular fit", "100% Combed Cotton",
       "Clean-finish crew-neck in premium combed cotton. The everyday essential that pairs with everything.",
       _SZ_TEE, 1500, 4.5, 412, sleeve="Short sleeve", weight="180 GSM"),
    _p("vs-ts-bge-vt", "Vintage Washed Tee – Beige", "VS-TS-BGE-VT", "T-Shirts",
       899, 310, "Beige", "Relaxed fit", "Cotton Jersey",
       "Sun-faded vintage wash tee with a lived-in feel. Soft jersey cotton with rolled hems.",
       _SZ_TEE, 800, 4.3, 189, sleeve="Short sleeve", weight="180 GSM"),
    _p("vs-ts-grn-gr", "Graphic Street Tee – Green", "VS-TS-GRN-GR", "T-Shirts",
       1099, 380, "Green", "Relaxed fit", "100% Cotton",
       "Bold chest graphic tee with street-art inspired print. Heavyweight cotton for premium drape.",
       _SZ_TEE, 650, 4.4, 167, sleeve="Short sleeve", weight="220 GSM"),
    _p("vs-ts-nvy-at", "Athletic Fit Tee – Navy", "VS-TS-NVY-AT", "T-Shirts",
       1199, 420, "Navy", "Athletic fit", "Cotton-Elastane Blend",
       "Performance-cut tee with 2% stretch. Tapered body and fitted sleeves for an athletic silhouette.",
       _SZ_TEE, 720, 4.5, 234, sleeve="Short sleeve", weight="200 GSM"),

    # ── JEANS ──
    _p("vs-jn-blu-sk", "Slim Fit Denim – Blue", "VS-JN-BLU-SK", "Jeans",
       2499, 900, "Blue", "Slim fit", "98% Cotton, 2% Elastane",
       "Classic slim-fit in deep blue wash with power stretch. Five-pocket styling, tapered leg.",
       _SZ_JN, 900, 4.5, 312, rise="Mid rise", wash="Dark blue", weight="12 oz"),
    _p("vs-jn-blk-st", "Straight Fit Jeans – Black", "VS-JN-BLK-ST", "Jeans",
       2299, 820, "Black", "Straight fit", "100% Cotton Denim",
       "Clean straight-leg jeans in jet black. Garment-dyed for rich, consistent colour.",
       _SZ_JN, 750, 4.4, 267, rise="Mid rise", wash="Garment dyed", weight="11.5 oz"),
    _p("vs-jn-lbl-wd", "Washed Wide-Leg Denim – Light Blue", "VS-JN-LBL-WD", "Jeans",
       2699, 950, "Light Blue", "Wide leg", "100% Cotton Denim",
       "90s-inspired wide-leg in vintage light-blue wash. Relaxed through hip with a dramatic flare.",
       _SZ_JN, 420, 4.3, 178, rise="High rise", wash="Vintage light", weight="13 oz"),
    _p("vs-jn-gry-cr", "Cropped Urban Jeans – Grey", "VS-JN-GRY-CR", "Jeans",
       2599, 930, "Grey", "Cropped straight", "95% Cotton, 3% Poly, 2% Elastane",
       "Ankle-length cropped jeans in smoky grey. Clean hem, urban-ready silhouette.",
       _SZ_JN, 380, 4.2, 143, rise="Mid rise", wash="Light grey", weight="10.5 oz"),
    _p("vs-jn-ind-rl", "Relaxed Fit Denim – Indigo", "VS-JN-IND-RL", "Jeans",
       2399, 860, "Indigo", "Relaxed fit", "100% Cotton Denim",
       "Easy relaxed-fit jeans in raw indigo. Unwashed selvedge-edge details for the denim purist.",
       _SZ_JN, 520, 4.4, 198, rise="Mid rise", wash="Raw indigo", weight="14 oz"),

    # ── JACKETS ──
    _p("vs-jk-blk-bm", "Bomber Jacket – Black", "VS-JK-BLK-BM", "Jackets",
       3999, 1400, "Black", "Regular fit", "Nylon Shell, Polyester Lining",
       "Classic bomber with ribbed cuffs, zip pockets, and satin lining. The go-to transitional jacket.",
       _SZ_JK, 350, 4.6, 256, closure="Front zip", pockets="2 zip + 1 internal"),
    _p("vs-jk-olv-ut", "Utility Overshirt Jacket – Olive", "VS-JK-OLV-UT", "Jackets",
       3499, 1250, "Olive", "Relaxed fit", "Cotton Twill",
       "Rugged utility overshirt with chest flap pockets and snap buttons. Layer it or wear it solo.",
       _SZ_JK, 280, 4.4, 178, closure="Snap buttons", pockets="4 (2 chest, 2 side)"),
    _p("vs-jk-dnm-tr", "Trucker Denim Jacket – Blue", "VS-JK-DNM-TR", "Jackets",
       3299, 1180, "Blue", "Regular fit", "100% Cotton Denim 12 oz",
       "Iconic trucker silhouette in rigid denim with chest flap pockets and adjustable waist tabs.",
       _SZ_JK, 300, 4.5, 203, closure="Button front", pockets="4"),
    _p("vs-jk-crm-pf", "Puffer Jacket – Cream", "VS-JK-CRM-PF", "Jackets",
       4999, 1800, "Cream", "Regular fit", "Recycled Polyester, Down Fill",
       "Lightweight puffer with 80/20 down fill. Packable, water-resistant, warmth without bulk.",
       _SZ_JK, 200, 4.7, 142, closure="Front zip", pockets="2 zip"),
    _p("vs-jk-gry-st", "Structured Blazer Jacket – Grey", "VS-JK-GRY-ST", "Jackets",
       5499, 1950, "Grey", "Slim fit", "Wool-Polyester Blend",
       "Tailored blazer with natural shoulder and patch pockets. Unstructured lining for comfort.",
       _SZ_JK, 180, 4.5, 98, closure="Two-button", pockets="3"),

    # ── SHIRTS ──
    _p("vs-sh-wht-ln", "Linen Relaxed Shirt – White", "VS-SH-WHT-LN", "Shirts",
       1999, 700, "White", "Relaxed fit", "100% Linen",
       "Breathable linen shirt with a relaxed drop-shoulder cut. Mother-of-pearl buttons, resort ready.",
       _SZ_SH, 600, 4.5, 234, sleeve="Full sleeve", collar="Spread collar"),
    _p("vs-sh-blu-st", "Striped Formal Shirt – Blue", "VS-SH-BLU-ST", "Shirts",
       2299, 800, "Blue/White Stripe", "Slim fit", "Cotton Poplin",
       "Classic Bengal stripe in crisp poplin. French cuff option, semi-spread collar, boardroom ready.",
       _SZ_SH, 450, 4.4, 189, sleeve="Full sleeve", collar="Semi-spread"),
    _p("vs-sh-blk-st", "Satin Evening Shirt – Black", "VS-SH-BLK-ST", "Shirts",
       2799, 980, "Black", "Slim fit", "Satin Cotton",
       "Lustrous satin-finish shirt for evening occasions. Concealed placket, tonal buttons.",
       _SZ_SH, 280, 4.3, 112, sleeve="Full sleeve", collar="Mandarin"),
    _p("vs-sh-grn-rs", "Resort Cuban Collar Shirt – Green", "VS-SH-GRN-RS", "Shirts",
       1799, 630, "Green", "Relaxed fit", "Viscose Rayon",
       "Cuban collar camp shirt in tropical green. Short sleeve, boxy cut, vacation essential.",
       _SZ_SH, 520, 4.6, 267, sleeve="Short sleeve", collar="Cuban / Camp"),
    _p("vs-sh-bge-ov", "Oversized Casual Shirt – Beige", "VS-SH-BGE-OV", "Shirts",
       1699, 590, "Beige", "Oversized", "Cotton-Linen Blend",
       "Relaxed oversized shirt in soft cotton-linen. Dropped shoulder, chest pocket, weekend staple.",
       _SZ_SH, 680, 4.4, 198, sleeve="Full sleeve", collar="Button-down"),

    # ── TROUSERS ──
    _p("vs-tr-blk-cr", "Cargo Utility Trousers – Black", "VS-TR-BLK-CR", "Trousers",
       2499, 880, "Black", "Relaxed fit", "Cotton Twill",
       "Modern cargo trousers with flap utility pockets and adjustable ankle snaps. Street-ready.",
       _SZ_TR, 500, 4.4, 203, rise="Mid rise", closure="Zip fly"),
    _p("vs-tr-bge-wl", "Wide Leg Tailored Pants – Beige", "VS-TR-BGE-WL", "Trousers",
       2799, 980, "Beige", "Wide leg", "Wool Blend",
       "Flowing wide-leg trousers in tailored wool blend. Single pleat, pressed crease, editorial elegance.",
       _SZ_TR, 320, 4.5, 167, rise="High rise", closure="Hook & bar"),
    _p("vs-tr-gry-pl", "Pleated Formal Trousers – Grey", "VS-TR-GRY-PL", "Trousers",
       2999, 1050, "Grey", "Tapered", "Wool Gabardine",
       "Double-pleat formal trousers in fine wool gabardine. Tapered leg, side adjusters.",
       _SZ_TR, 280, 4.3, 134, rise="High rise", closure="Button fly"),
    _p("vs-tr-olv-jg", "Jogger Fit Trousers – Olive", "VS-TR-OLV-JG", "Trousers",
       1999, 700, "Olive", "Jogger / Tapered", "Stretch Cotton Twill",
       "Tapered jogger trousers with elasticated waist and cuffed ankles. Smart-casual versatility.",
       _SZ_TR, 620, 4.5, 245, rise="Mid rise", closure="Drawstring"),
    _p("vs-tr-nvy-sm", "Slim Office Pants – Navy", "VS-TR-NVY-SM", "Trousers",
       2599, 920, "Navy", "Slim fit", "Stretch Polyester-Viscose",
       "Clean slim-fit office trousers in wrinkle-resistant fabric. Flat front, no-iron convenience.",
       _SZ_TR, 450, 4.4, 189, rise="Mid rise", closure="Zip fly"),

    # ── SWEATSHIRTS ──
    _p("vs-sw-gry-os", "Oversized Fleece Sweatshirt – Grey", "VS-SW-GRY-OS", "Sweatshirts",
       1999, 700, "Grey", "Oversized", "400 GSM Loopback Cotton",
       "Heavyweight oversized sweatshirt in brushed fleece. Ribbed cuffs and hem, cozy perfection.",
       _SZ_SW, 550, 4.5, 234, weight="400 GSM"),
    _p("vs-sw-blk-mn", "Minimal Logo Sweatshirt – Black", "VS-SW-BLK-MN", "Sweatshirts",
       1799, 630, "Black", "Regular fit", "French Terry Cotton",
       "Clean minimal sweatshirt with subtle tonal logo. French terry for breathable comfort.",
       _SZ_SW, 680, 4.4, 198, weight="350 GSM"),
    _p("vs-sw-crm-vn", "Vintage Wash Crewneck – Cream", "VS-SW-CRM-VN", "Sweatshirts",
       1699, 590, "Cream", "Relaxed fit", "Cotton Fleece",
       "Sun-faded vintage wash crewneck with distressed edges. Soft interior fleece, lived-in feel.",
       _SZ_SW, 420, 4.3, 156, weight="380 GSM"),
    _p("vs-sw-grn-hd", "Streetwear Hoodie Sweatshirt – Green", "VS-SW-GRN-HD", "Sweatshirts",
       2299, 800, "Green", "Oversized", "Heavy Cotton Fleece",
       "Oversized hoodie with kangaroo pocket and bold branding. Double-lined hood, statement streetwear.",
       _SZ_SW, 380, 4.6, 278, weight="420 GSM"),
    _p("vs-sw-nvy-zp", "Zip-Up Sweatshirt – Navy", "VS-SW-NVY-ZP", "Sweatshirts",
       2499, 880, "Navy", "Regular fit", "Cotton-Polyester Blend",
       "Full-zip sweatshirt with stand collar and side pockets. Smooth YKK zip, layering essential.",
       _SZ_SW, 350, 4.4, 167, weight="360 GSM"),

    # ── ACTIVEWEAR ──
    _p("vs-aw-blk-cp", "Compression Training Tee – Black", "VS-AW-BLK-CP", "Activewear",
       1299, 450, "Black", "Compression", "Recycled Polyester-Spandex",
       "Second-skin compression tee with moisture-wicking tech. Flatlock seams, reflective details.",
       _SZ_AW, 700, 4.5, 234, sleeve="Short sleeve", tech="Moisture-wicking"),
    _p("vs-aw-gry-jg", "Performance Joggers – Grey", "VS-AW-GRY-JG", "Activewear",
       1999, 700, "Grey", "Tapered", "Quick-Dry Polyester",
       "Technical joggers with zip pockets and tapered leg. 4-way stretch for unrestricted movement.",
       _SZ_AW, 520, 4.4, 189, closure="Drawstring", tech="4-way stretch"),
    _p("vs-aw-blu-rn", "Running Shorts – Blue", "VS-AW-BLU-RN", "Activewear",
       999, 340, "Blue", "Regular fit", "Recycled Nylon",
       "Lightweight running shorts with built-in liner. Side split hem, zip back pocket.",
       _SZ_AW, 800, 4.3, 178, length="5 inch inseam", tech="Built-in liner"),
    _p("vs-aw-olv-tk", "Training Tank – Olive", "VS-AW-OLV-TK", "Activewear",
       899, 310, "Olive", "Regular fit", "Mesh Polyester",
       "Breathable mesh-back training tank. Dropped armholes for freedom of movement.",
       _SZ_AW, 600, 4.2, 134, sleeve="Sleeveless", tech="Mesh ventilation"),
    _p("vs-aw-pnk-yg", "Yoga Flex Leggings – Pink", "VS-AW-PNK-YG", "Activewear",
       1799, 630, "Pink", "Compression", "Nylon-Spandex Blend",
       "High-waist yoga leggings with 4-way stretch and hidden pocket. Squat-proof, buttery soft.",
       _SZ_AW, 480, 4.6, 312, rise="High rise", tech="Squat-proof"),
]

for p in _all:
    DEFAULT_PRODUCTS[p["id"]] = p


def _full_catalogue() -> dict:
    """Return ONLY the 35 curated Vouge Studio SKUs (no auto-generated extras)."""
    return dict(DEFAULT_PRODUCTS)


_CATALOGUE = _full_catalogue()


def get_all_products() -> list[dict]:
    """Return the full Vouge Studio catalogue (curated + extended)."""
    return list(_CATALOGUE.values())


def get_product_by_id(product_id: str) -> dict | None:
    """Return a single product dict by ID, or None if not found."""
    return _CATALOGUE.get(product_id)


# Alias used by dashboard/analytics routes
get_product = get_product_by_id


def get_products_by_category(category: str) -> list[dict]:
    """Return all products matching a given category (case-insensitive)."""
    cat = category.strip().lower()
    return [p for p in _CATALOGUE.values() if p["category"].lower() == cat]
