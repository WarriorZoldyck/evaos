import React, { createContext, useContext, useState, useEffect } from "react";
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
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { impersonatingOwnerId } = useHub();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    fetchCompanies();
  }, [effectiveUserId]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompanyId,
        setSelectedCompanyId,
        isPersonal: selectedCompanyId === null,
        loading,
        refetchCompanies: fetchCompanies,
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
