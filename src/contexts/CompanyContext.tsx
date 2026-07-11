import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useHub } from "./HubContext";

export interface Company {
  id: string;
  name: string;
  cnpj: string;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompanyId: string | null; // null = "Pessoal"
  setSelectedCompanyId: (id: string | null) => void;
  isPersonal: boolean;
  loading: boolean;
  refetchCompanies: () => void;
  // Multi-select for Dashboard
  selectedCompanyIds: string[]; // IDs selected (empty = use single selectedCompanyId)
  viewAll: boolean;
  setViewAll: (v: boolean) => void;
  toggleCompanyId: (id: string) => void;
  togglePersonal: () => void;
  personalSelected: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_PREFIX = "eva:company-selection:";

interface PersistedSelection {
  viewAll: boolean;
  personalSelected: boolean;
  selectedCompanyIds: string[];
  selectedCompanyId: string | null;
}

function readPersisted(uid: string): PersistedSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      viewAll: !!parsed.viewAll,
      personalSelected: !!parsed.personalSelected,
      selectedCompanyIds: Array.isArray(parsed.selectedCompanyIds) ? parsed.selectedCompanyIds.filter((x: any) => typeof x === "string") : [],
      selectedCompanyId: typeof parsed.selectedCompanyId === "string" ? parsed.selectedCompanyId : null,
    };
  } catch {
    return null;
  }
}

function writePersisted(uid: string, data: PersistedSelection) {
  try {
    localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { impersonatingOwnerId } = useHub();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-select state — default: Pessoal selected (not viewAll)
  const [viewAll, setViewAllState] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [personalSelected, setPersonalSelected] = useState(true);

  const effectiveUserId = impersonatingOwnerId || user?.id;
  const hydratedForUserRef = useRef<string | null>(null);

  const fetchCompanies = async (): Promise<Company[]> => {
    if (!effectiveUserId) {
      setCompanies([]);
      setLoading(false);
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, cnpj")
        .eq("user_id", effectiveUserId)
        .order("name");

      if (!error && data) {
        setCompanies(data);
        return data;
      }
      return [];
    } catch (err) {
      console.error("Error fetching companies:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Hydrate selection from localStorage when effectiveUserId changes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!effectiveUserId) {
        setSelectedCompanyId(null);
        setViewAllState(false);
        setSelectedCompanyIds([]);
        setPersonalSelected(true);
        hydratedForUserRef.current = null;
        await fetchCompanies();
        return;
      }

      setLoading(true);
      const loaded = await fetchCompanies();
      if (cancelled) return;

      const validIds = new Set(loaded.map((c) => c.id));
      const persisted = readPersisted(effectiveUserId);

      if (persisted) {
        const cleanIds = persisted.selectedCompanyIds.filter((id) => validIds.has(id));
        const cleanSingle = persisted.selectedCompanyId && validIds.has(persisted.selectedCompanyId)
          ? persisted.selectedCompanyId
          : null;
        setViewAllState(persisted.viewAll);
        setPersonalSelected(persisted.personalSelected);
        setSelectedCompanyIds(cleanIds);
        setSelectedCompanyId(cleanSingle);
      } else {
        // First-time default: Pessoal selected
        setViewAllState(false);
        setPersonalSelected(true);
        setSelectedCompanyIds([]);
        setSelectedCompanyId(null);
        writePersisted(effectiveUserId, {
          viewAll: false,
          personalSelected: true,
          selectedCompanyIds: [],
          selectedCompanyId: null,
        });
      }

      hydratedForUserRef.current = effectiveUserId;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Persist changes whenever selection state changes (after hydration for this user).
  useEffect(() => {
    if (!effectiveUserId) return;
    if (hydratedForUserRef.current !== effectiveUserId) return;
    writePersisted(effectiveUserId, {
      viewAll,
      personalSelected,
      selectedCompanyIds,
      selectedCompanyId,
    });
  }, [effectiveUserId, viewAll, personalSelected, selectedCompanyIds, selectedCompanyId]);

  // Sync single-context selection (selectedCompanyId/isPersonal) when exactly 1 is selected.
  const syncSingleFromMulti = useCallback((personal: boolean, companyIds: string[]) => {
    const total = (personal ? 1 : 0) + companyIds.length;
    if (total === 1) {
      if (personal) setSelectedCompanyId(null);
      else setSelectedCompanyId(companyIds[0]);
    }
  }, []);

  const setViewAll = useCallback((v: boolean) => {
    setViewAllState(v);
    if (v) {
      setSelectedCompanyIds([]);
      setPersonalSelected(true);
      setSelectedCompanyId(null);
    }
  }, []);

  const toggleCompanyId = useCallback((id: string) => {
    setViewAllState(false);
    setSelectedCompanyIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      syncSingleFromMulti(personalSelected, next);
      return next;
    });
  }, [personalSelected, syncSingleFromMulti]);

  const togglePersonal = useCallback(() => {
    setViewAllState(false);
    setPersonalSelected(prev => {
      const next = !prev;
      syncSingleFromMulti(next, selectedCompanyIds);
      return next;
    });
  }, [selectedCompanyIds, syncSingleFromMulti]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompanyId,
        setSelectedCompanyId,
        isPersonal: selectedCompanyId === null,
        loading,
        refetchCompanies: fetchCompanies,
        selectedCompanyIds,
        viewAll,
        setViewAll,
        toggleCompanyId,
        togglePersonal,
        personalSelected,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
