import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { impersonatingOwnerId } = useHub();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-select state
  const [viewAll, setViewAllState] = useState(true);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [personalSelected, setPersonalSelected] = useState(true);

  const effectiveUserId = impersonatingOwnerId || user?.id;

  const fetchCompanies = async () => {
    if (!effectiveUserId) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from("companies")
        .select("id, name, cnpj")
        .order("name");

      if (impersonatingOwnerId) {
        query = query.eq("user_id", impersonatingOwnerId);
      }

      const { data, error } = await query;

      if (!error && data) {
        setCompanies(data);
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedCompanyId(null);
    setViewAllState(true);
    setSelectedCompanyIds([]);
    setPersonalSelected(true);
    fetchCompanies();
  }, [effectiveUserId]);

  // Sync single-context selection (selectedCompanyId/isPersonal) when exactly 1 is selected.
  // This keeps single-context pages (Lançamentos, Categorias, Metas, etc.) consistent with the unified selector.
  const syncSingleFromMulti = useCallback((personal: boolean, companyIds: string[]) => {
    const total = (personal ? 1 : 0) + companyIds.length;
    if (total === 1) {
      if (personal) setSelectedCompanyId(null);
      else setSelectedCompanyId(companyIds[0]);
    }
    // For 0 or 2+: keep last selectedCompanyId as fallback for single-context pages.
  }, []);

  const setViewAll = useCallback((v: boolean) => {
    setViewAllState(v);
    if (v) {
      setSelectedCompanyIds([]);
      setPersonalSelected(true);
      // "Todas as contas" defaults single-context pages to Pessoal
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
