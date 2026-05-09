export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_pending_transactions: {
        Row: {
          ai_response_message: string | null
          amount: number
          attachment_url: string | null
          bank_account_id: string | null
          barcode: string | null
          card_terminal_id: string | null
          category: string | null
          client_id: string | null
          company_id: string | null
          competence_date: string | null
          confidence_score: number | null
          contact_name: string | null
          created_at: string
          credit_card_id: string | null
          description: string
          fingerprint: string | null
          id: string
          installment_number: number | null
          installments: number | null
          installments_total: number | null
          notes: string | null
          original_amount: number | null
          original_message: string | null
          payment_date: string | null
          payment_method: string | null
          reviewed_at: string | null
          series_id: string | null
          source: string
          status: string
          subcategory: string | null
          subcategory2: string | null
          supplier_id: string | null
          transaction_status: string | null
          type: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          ai_response_message?: string | null
          amount: number
          attachment_url?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          card_terminal_id?: string | null
          category?: string | null
          client_id?: string | null
          company_id?: string | null
          competence_date?: string | null
          confidence_score?: number | null
          contact_name?: string | null
          created_at?: string
          credit_card_id?: string | null
          description: string
          fingerprint?: string | null
          id?: string
          installment_number?: number | null
          installments?: number | null
          installments_total?: number | null
          notes?: string | null
          original_amount?: number | null
          original_message?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reviewed_at?: string | null
          series_id?: string | null
          source?: string
          status?: string
          subcategory?: string | null
          subcategory2?: string | null
          supplier_id?: string | null
          transaction_status?: string | null
          type: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          ai_response_message?: string | null
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          card_terminal_id?: string | null
          category?: string | null
          client_id?: string | null
          company_id?: string | null
          competence_date?: string | null
          confidence_score?: number | null
          contact_name?: string | null
          created_at?: string
          credit_card_id?: string | null
          description?: string
          fingerprint?: string | null
          id?: string
          installment_number?: number | null
          installments?: number | null
          installments_total?: number | null
          notes?: string | null
          original_amount?: number | null
          original_message?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reviewed_at?: string | null
          series_id?: string | null
          source?: string
          status?: string
          subcategory?: string | null
          subcategory2?: string | null
          supplier_id?: string | null
          transaction_status?: string | null
          type?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: []
      }
      ai_usage_counters: {
        Row: {
          messages_used: number
          period_year_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          messages_used?: number
          period_year_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          messages_used?: number
          period_year_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string
          cpf_cnpj: string
          created_at: string
          email: string | null
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          cpf_cnpj: string
          created_at?: string
          email?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_integrations: {
        Row: {
          api_key_encrypted: string
          api_key_iv: string
          bank_account_id: string
          company_id: string | null
          created_at: string
          id: string
          initial_balance_synced: number | null
          last_error: string | null
          last_sync_at: string | null
          sync_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted: string
          api_key_iv: string
          bank_account_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          initial_balance_synced?: number | null
          last_error?: string | null
          last_sync_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string
          api_key_iv?: string
          bank_account_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          initial_balance_synced?: number | null
          last_error?: string | null
          last_sync_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_sync_items: {
        Row: {
          amount: number
          asaas_id: string
          asaas_status: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          integration_id: string
          match_status: string
          matched_transaction_id: string | null
          payload: Json
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asaas_id: string
          asaas_status?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          integration_id: string
          match_status?: string
          matched_transaction_id?: string | null
          payload?: Json
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asaas_id?: string
          asaas_status?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          integration_id?: string
          match_status?: string
          matched_transaction_id?: string | null
          payload?: Json
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_sync_items_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "asaas_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          event_id: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          agency_number: string | null
          company_id: string | null
          created_at: string | null
          id: string
          initial_balance: number
          name: string
          type: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          agency_number?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name: string
          type: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          agency_number?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      card_terminals: {
        Row: {
          acquirer: string | null
          affiliation_key: string | null
          auto_anticipation: boolean
          bank_account_id: string
          company_id: string | null
          created_at: string | null
          credit_rate: number | null
          debit_rate: number | null
          id: string
          name: string
          rates_info: string | null
          settlement_days_credit: number | null
          settlement_days_debit: number | null
          unique_id: string | null
          user_id: string
        }
        Insert: {
          acquirer?: string | null
          affiliation_key?: string | null
          auto_anticipation?: boolean
          bank_account_id: string
          company_id?: string | null
          created_at?: string | null
          credit_rate?: number | null
          debit_rate?: number | null
          id?: string
          name: string
          rates_info?: string | null
          settlement_days_credit?: number | null
          settlement_days_debit?: number | null
          unique_id?: string | null
          user_id: string
        }
        Update: {
          acquirer?: string | null
          affiliation_key?: string | null
          auto_anticipation?: boolean
          bank_account_id?: string
          company_id?: string | null
          created_at?: string | null
          credit_rate?: number | null
          debit_rate?: number | null
          id?: string
          name?: string
          rates_info?: string | null
          settlement_days_credit?: number | null
          settlement_days_debit?: number | null
          unique_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_terminals_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_terminals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string | null
          created_at: string | null
          dre_section: string | null
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          type: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          dre_section?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          type?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          dre_section?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cnpj_cpf: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          cnpj_cpf?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          cnpj_cpf?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          bank_account_id: string
          closing_day: number
          company_id: string | null
          created_at: string | null
          due_day: number
          id: string
          last_four_digits: string | null
          limit: number
          name: string
          parent_card_id: string | null
          user_id: string
        }
        Insert: {
          bank_account_id: string
          closing_day: number
          company_id?: string | null
          created_at?: string | null
          due_day: number
          id?: string
          last_four_digits?: string | null
          limit: number
          name: string
          parent_card_id?: string | null
          user_id: string
        }
        Update: {
          bank_account_id?: string
          closing_day?: number
          company_id?: string | null
          created_at?: string | null
          due_day?: number
          id?: string
          last_four_digits?: string | null
          limit?: number
          name?: string
          parent_card_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_parent_card_id_fkey"
            columns: ["parent_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_movements: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          goal_id: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          goal_id: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          goal_id?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_movements_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          auto_reserve_amount: number | null
          auto_reserve_enabled: boolean
          auto_reserve_frequency: string | null
          auto_reserve_per_expense: number | null
          auto_reserve_per_sale: number | null
          company_id: string | null
          created_at: string | null
          current_amount: number
          deadline: string | null
          icon: string | null
          id: string
          name: string
          target_amount: number
          user_id: string
        }
        Insert: {
          auto_reserve_amount?: number | null
          auto_reserve_enabled?: boolean
          auto_reserve_frequency?: string | null
          auto_reserve_per_expense?: number | null
          auto_reserve_per_sale?: number | null
          company_id?: string | null
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          icon?: string | null
          id?: string
          name: string
          target_amount?: number
          user_id: string
        }
        Update: {
          auto_reserve_amount?: number | null
          auto_reserve_enabled?: boolean
          auto_reserve_frequency?: string | null
          auto_reserve_per_expense?: number | null
          auto_reserve_per_sale?: number | null
          company_id?: string | null
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          icon?: string | null
          id?: string
          name?: string
          target_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_configurations: {
        Row: {
          hours_per_month: number | null
          id: string
          matrix_values: Json | null
          profit_margin: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          hours_per_month?: number | null
          id?: string
          matrix_values?: Json | null
          profit_margin?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          hours_per_month?: number | null
          id?: string
          matrix_values?: Json | null
          profit_margin?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pricing_procedure_items: {
        Row: {
          description: string
          id: string
          procedure_id: string | null
          value: number | null
        }
        Insert: {
          description: string
          id?: string
          procedure_id?: string | null
          value?: number | null
        }
        Update: {
          description?: string
          id?: string
          procedure_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_procedure_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "pricing_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_procedures: {
        Row: {
          created_at: string | null
          desired_price: number | null
          execution_time: number | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          desired_price?: number | null
          execution_time?: number | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          desired_price?: number | null
          execution_time?: number | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pricing_v2_configurations: {
        Row: {
          company_id: string | null
          days_per_week: number | null
          hours_per_day: number | null
          hours_per_month: number
          id: string
          num_rooms: number
          tax_rate: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          days_per_week?: number | null
          hours_per_day?: number | null
          hours_per_month?: number
          id?: string
          num_rooms?: number
          tax_rate?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          days_per_week?: number | null
          hours_per_day?: number | null
          hours_per_month?: number
          id?: string
          num_rooms?: number
          tax_rate?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_v2_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_v2_cost_items: {
        Row: {
          category: string
          company_id: string | null
          config_id: string
          cost_group: string
          description: string
          frequency: string
          id: string
          sort_order: number
          user_id: string
          value: number
        }
        Insert: {
          category?: string
          company_id?: string | null
          config_id: string
          cost_group: string
          description?: string
          frequency?: string
          id?: string
          sort_order?: number
          user_id: string
          value?: number
        }
        Update: {
          category?: string
          company_id?: string | null
          config_id?: string
          cost_group?: string
          description?: string
          frequency?: string
          id?: string
          sort_order?: number
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_v2_cost_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_v2_cost_items_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "pricing_v2_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_v2_procedure_items: {
        Row: {
          description: string
          id: string
          procedure_id: string
          value: number
        }
        Insert: {
          description?: string
          id?: string
          procedure_id: string
          value?: number
        }
        Update: {
          description?: string
          id?: string
          procedure_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_v2_procedure_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "pricing_v2_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_v2_procedures: {
        Row: {
          company_id: string | null
          created_at: string | null
          desired_price: number
          execution_time: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          desired_price?: number
          execution_time?: number
          id?: string
          name: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          desired_price?: number
          execution_time?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_v2_procedures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          full_name: string | null
          id: string
          transaction_form_fields: Json | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          full_name?: string | null
          id: string
          transaction_form_fields?: Json | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          full_name?: string | null
          id?: string
          transaction_form_fields?: Json | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          amount: number
          attachment_url: string | null
          bank_account_id: string | null
          barcode: string | null
          card_terminal_id: string | null
          category: string
          client_id: string | null
          company_id: string | null
          competence_date: string | null
          contact_name: string | null
          created_at: string | null
          credit_card_id: string | null
          day_of_month: number | null
          day_of_week: number | null
          description: string
          end_date: string | null
          frequency: string
          id: string
          installment_number: number | null
          installments: number | null
          installments_total: number | null
          is_reconciled: boolean | null
          last_updated_amount: number | null
          month: number | null
          notes: string | null
          original_amount: number | null
          payment_date: string | null
          payment_method: string | null
          series_id: string | null
          start_date: string
          status: string | null
          subcategory: string | null
          subcategory2: string | null
          supplier_id: string | null
          total_amount: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          card_terminal_id?: string | null
          category: string
          client_id?: string | null
          company_id?: string | null
          competence_date?: string | null
          contact_name?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description: string
          end_date?: string | null
          frequency: string
          id?: string
          installment_number?: number | null
          installments?: number | null
          installments_total?: number | null
          is_reconciled?: boolean | null
          last_updated_amount?: number | null
          month?: number | null
          notes?: string | null
          original_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          series_id?: string | null
          start_date: string
          status?: string | null
          subcategory?: string | null
          subcategory2?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          card_terminal_id?: string | null
          category?: string
          client_id?: string | null
          company_id?: string | null
          competence_date?: string | null
          contact_name?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          installment_number?: number | null
          installments?: number | null
          installments_total?: number | null
          is_reconciled?: boolean | null
          last_updated_amount?: number | null
          month?: number | null
          notes?: string | null
          original_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          series_id?: string | null
          start_date?: string
          status?: string | null
          subcategory?: string | null
          subcategory2?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_card_terminal_id_fkey"
            columns: ["card_terminal_id"]
            isOneToOne: false
            referencedRelation: "card_terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "subscription_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_coupons: {
        Row: {
          applies_to_cycle: string | null
          applies_to_plan_slug: string | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          used_count: number
        }
        Insert: {
          applies_to_cycle?: string | null
          applies_to_plan_slug?: string | null
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Update: {
          applies_to_cycle?: string | null
          applies_to_plan_slug?: string | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          extra_user_price_cents: number
          features: Json
          id: string
          is_active: boolean
          max_accounts: number | null
          max_hub_members: number
          max_users: number
          monthly_ai_messages: number | null
          name: string
          price_cents: number
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_user_price_cents?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_accounts?: number | null
          max_hub_members?: number
          max_users?: number
          monthly_ai_messages?: number | null
          name: string
          price_cents: number
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_user_price_cents?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_accounts?: number | null
          max_hub_members?: number
          max_users?: number
          monthly_ai_messages?: number | null
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_subscription_id: string | null
          billing_cycle: string
          billing_type: string
          canceled_at: string | null
          coupon_code: string | null
          created_at: string
          current_period_end: string | null
          discount_amount_cents: number
          discount_percent: number
          grace_until: string | null
          id: string
          invoice_url: string | null
          is_beta: boolean
          last_payment_at: string | null
          next_due_date: string | null
          plan_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_subscription_id?: string | null
          billing_cycle?: string
          billing_type: string
          canceled_at?: string | null
          coupon_code?: string | null
          created_at?: string
          current_period_end?: string | null
          discount_amount_cents?: number
          discount_percent?: number
          grace_until?: string | null
          id?: string
          invoice_url?: string | null
          is_beta?: boolean
          last_payment_at?: string | null
          next_due_date?: string | null
          plan_id: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_subscription_id?: string | null
          billing_cycle?: string
          billing_type?: string
          canceled_at?: string | null
          coupon_code?: string | null
          created_at?: string
          current_period_end?: string | null
          discount_amount_cents?: number
          discount_percent?: number
          grace_until?: string | null
          id?: string
          invoice_url?: string | null
          is_beta?: boolean
          last_payment_at?: string | null
          next_due_date?: string | null
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          cnpj: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          attachment_url: string | null
          bank_account_id: string | null
          barcode: string | null
          card_terminal_id: string | null
          category: string
          client_id: string | null
          company_id: string | null
          competence_date: string
          contact_name: string | null
          created_at: string | null
          credit_card_id: string | null
          description: string
          external_id: string | null
          id: string
          installment_number: number | null
          installments: number | null
          installments_total: number | null
          is_internal_transfer: boolean | null
          is_reconciled: boolean | null
          liquidation_notes: string | null
          notes: string | null
          original_amount: number | null
          parent_id: string | null
          payment_date: string
          payment_method: string | null
          purchase_date_original: string | null
          series_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          subcategory: string | null
          subcategory2: string | null
          supplier_id: string | null
          transfer_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          card_terminal_id?: string | null
          category: string
          client_id?: string | null
          company_id?: string | null
          competence_date: string
          contact_name?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          description: string
          external_id?: string | null
          id?: string
          installment_number?: number | null
          installments?: number | null
          installments_total?: number | null
          is_internal_transfer?: boolean | null
          is_reconciled?: boolean | null
          liquidation_notes?: string | null
          notes?: string | null
          original_amount?: number | null
          parent_id?: string | null
          payment_date: string
          payment_method?: string | null
          purchase_date_original?: string | null
          series_id?: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          subcategory?: string | null
          subcategory2?: string | null
          supplier_id?: string | null
          transfer_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          card_terminal_id?: string | null
          category?: string
          client_id?: string | null
          company_id?: string | null
          competence_date?: string
          contact_name?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          description?: string
          external_id?: string | null
          id?: string
          installment_number?: number | null
          installments?: number | null
          installments_total?: number | null
          is_internal_transfer?: boolean | null
          is_reconciled?: boolean | null
          liquidation_notes?: string | null
          notes?: string | null
          original_amount?: number | null
          parent_id?: string | null
          payment_date?: string
          payment_method?: string | null
          purchase_date_original?: string | null
          series_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          subcategory?: string | null
          subcategory2?: string | null
          supplier_id?: string | null
          transfer_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_terminal_id_fkey"
            columns: ["card_terminal_id"]
            isOneToOne: false
            referencedRelation: "card_terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          initial_balance: number
          name: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_pending_actions: {
        Row: {
          action_type: string
          category_type: string
          context_company_id: string | null
          created_at: string
          expires_at: string
          id: string
          payload: Json
          suggested_category_name: string
          user_id: string
        }
        Insert: {
          action_type?: string
          category_type?: string
          context_company_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          suggested_category_name: string
          user_id: string
        }
        Update: {
          action_type?: string
          category_type?: string
          context_company_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          suggested_category_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_pending_actions_context_company_id_fkey"
            columns: ["context_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_member_permissions: {
        Row: {
          id: string
          resource_id: string
          resource_type: string
          workspace_member_id: string
        }
        Insert: {
          id?: string
          resource_id: string
          resource_type: string
          workspace_member_id: string
        }
        Update: {
          id?: string
          resource_id?: string
          resource_type?: string
          workspace_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_member_permissions_workspace_member_id_fkey"
            columns: ["workspace_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          email: string
          id: string
          member_name: string
          member_user_id: string
          owner_id: string
          role: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          member_name?: string
          member_user_id: string
          owner_id: string
          role?: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          member_name?: string
          member_user_id?: string
          owner_id?: string
          role?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_account_balance: {
        Args: { account_id_param: string }
        Returns: number
      }
      get_public_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      has_active_subscription: { Args: { _uid: string }; Returns: boolean }
      increment_ai_usage: { Args: { _uid: string }; Returns: number }
      is_hub_member: {
        Args: { _member_uid: string; _owner_uid: string }
        Returns: boolean
      }
      list_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
    }
    Enums: {
      account_type: "Conta Corrente" | "Poupança"
      bank_account_type: "Conta Corrente" | "Poupança"
      recurring_frequency: "monthly" | "weekly" | "yearly"
      transaction_status: "Pendente" | "Pago"
      transaction_type: "receita" | "despesa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["Conta Corrente", "Poupança"],
      bank_account_type: ["Conta Corrente", "Poupança"],
      recurring_frequency: ["monthly", "weekly", "yearly"],
      transaction_status: ["Pendente", "Pago"],
      transaction_type: ["receita", "despesa"],
    },
  },
} as const
