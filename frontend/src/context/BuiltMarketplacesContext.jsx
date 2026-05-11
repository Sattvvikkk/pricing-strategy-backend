/**
 * BuiltMarketplacesContext
 * ------------------------
 * Persistent store of marketplaces that have been BUILT by the user
 * inside `MarketplaceIntelligence`. Each entry captures the product,
 * the marketplaces scanned, scraped competitor listings, and metadata.
 *
 * StrategyBuilder reads from here to display only products that have
 * already been scanned — so strategies are grounded in real intel.
 */
import {
  createContext, useContext, useCallback, useEffect, useMemo, useState,
} from 'react';

const STORAGE_KEY = 'pe_built_marketplaces_v1';
const Ctx = createContext(null);

function _read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export function BuiltMarketplacesProvider({ children }) {
  const [builds, setBuilds] = useState(_read);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setBuilds(_read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Save (or replace) a build for a product.
   * Each build keyed by `product.id` — re-building overwrites.
   */
  const saveBuild = useCallback((build) => {
    if (!build?.product?.id) return;
    setBuilds((prev) => {
      const filtered = prev.filter((b) => b.product.id !== build.product.id);
      const next = [
        {
          ...build,
          builtAt: new Date().toISOString(),
        },
        ...filtered,
      ];
      _write(next);
      return next;
    });
  }, []);

  const removeBuild = useCallback((productId) => {
    setBuilds((prev) => {
      const next = prev.filter((b) => b.product.id !== productId);
      _write(next);
      return next;
    });
  }, []);

  const clearBuilds = useCallback(() => {
    _write([]);
    setBuilds([]);
  }, []);

  const value = useMemo(() => ({
    builds,
    saveBuild,
    removeBuild,
    clearBuilds,
  }), [builds, saveBuild, removeBuild, clearBuilds]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBuiltMarketplaces = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBuiltMarketplaces must be used inside BuiltMarketplacesProvider');
  return ctx;
};
