"""Product API routes — catalog listing, product details, and URL lookup."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from auth.jwt_handler import get_current_user
from services.product_catalog import get_all_products, get_product_by_id, lookup_product_by_url

router = APIRouter(prefix="/api/products", tags=["Products"])


class ProductURLRequest(BaseModel):
    url: str


@router.get("/catalog")
def list_products():
    """Return all available products in the catalog."""
    products = get_all_products()
    # Return lightweight list for sidebar selector
    return {
        "products": [
            {
                "id": p["id"],
                "name": p["name"],
                "brand": p["brand"],
                "price": p["price"],
                "image": p["image"],
                "category": p["category"],
            }
            for p in products
        ]
    }


@router.get("/detail/{product_id}")
def get_product_detail(product_id: str):
    """Return full product details including specs, sizes, care instructions."""
    product = get_product_by_id(product_id)
    if not product:
        return {"error": "Product not found"}
    return {"product": product}


@router.post("/lookup")
def lookup_url(req: ProductURLRequest):
    """Look up a product by its URL and return its details."""
    product = lookup_product_by_url(req.url)
    return {"product": product}
