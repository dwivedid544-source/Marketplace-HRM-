import { useState, useEffect } from 'react';
import api from '../utils/axios';

let cachedEntitlements = null;
let fetchPromise = null;

/**
 * Hook to read commercial license entitlements safely from backend.
 * Provides UX-level feature gating only. Backend remains the authoritative security boundary.
 */
export function useLicenseEntitlements() {
  const [entitlements, setEntitlements] = useState(cachedEntitlements);
  const [loading, setLoading] = useState(!cachedEntitlements);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (cachedEntitlements) {
        if (isMounted) {
          setEntitlements(cachedEntitlements);
          setLoading(false);
        }
        return;
      }

      if (!fetchPromise) {
        fetchPromise = api.get('/license/entitlements')
          .then((res) => {
            if (res.data && res.data.success && res.data.entitlements) {
              cachedEntitlements = res.data.entitlements;
              return cachedEntitlements;
            }
            return null;
          })
          .catch(() => null)
          .finally(() => {
            fetchPromise = null;
          });
      }

      const result = await fetchPromise;
      if (isMounted) {
        setEntitlements(result);
        setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasFeature = (featureName) => {
    if (!entitlements || !Array.isArray(entitlements.features)) {
      return false;
    }
    const target = String(featureName).toUpperCase().trim();
    const aliases = {
      'BIOMETRIC_SDK': 'BIOMETRIC_HARDWARE_SDK',
      'AI_ANALYTICS': 'AI_ANALYTICS_ENGINE',
      'WHITE_LABEL': 'WHITE_LABEL_BRANDING'
    };
    const canonical = aliases[target] || target;
    return entitlements.features.includes(canonical) || entitlements.features.includes(target);
  };

  const hasEdition = (minEdition) => {
    if (!entitlements || !entitlements.editionCode) return false;
    const ranks = { ui_dist: 1, full_source: 2, extended: 3 };
    const curRank = ranks[entitlements.editionCode] || 0;
    const targetRank = ranks[minEdition] || 0;
    return curRank >= targetRank;
  };

  return {
    entitlements,
    loading,
    hasFeature,
    hasEdition
  };
}
