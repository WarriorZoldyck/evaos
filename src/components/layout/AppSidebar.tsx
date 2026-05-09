import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  FileText,
  Calculator,
  CreditCard,
  FolderTree,
  Users,
  Settings,
  LogOut,
  Building2,
  User,
  ChevronDown,
  GraduationCap,
  LifeBuoy,
  TrendingUp,
  BookOpen,
  Sparkles,
  Plug,
  UsersRound,
  Layers,
  Check,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useAIPendingTransactions } from "@/hooks/useAIPendingTransactions";
import { useHub } from "@/contexts/HubContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import evaLogo from "@/assets/eva-os-logo.jpeg";

const mainMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Lançamentos", url: "/lancamentos", icon: ArrowLeftRight },
  { title: "Análises EVA", url: "/analises-eva", icon: Sparkles, hasBadge: true },
];

const financeMenuItems = [
  { title: "Plano de Caixa", url: "/plano-de-caixa", icon: BarChart3 },
  { title: "DRE Competência", url: "/dre", icon: FileText },
  { title: "Precificação", url: "/precificacao", icon: Calculator },
];

const registrationMenuItems = [
  { title: "Contas & Cartões", url: "/contas", icon: CreditCard },
  { title: "Conciliação Bancária", url: "/conciliacao-bancaria", icon: ArrowLeftRight },
  { title: "Categorias", url: "/categorias", icon: FolderTree },
  { title: "Centros de Custos", url: "/centros-de-custos", icon: Layers },
  { title: "Fornecedores e Clientes", url: "/contatos", icon: Users },
  { title: "Integrações", url: "/integracoes", icon: Plug },
];

const comingSoonItems = [
  { title: "EVA Kids", url: "/eva-kids", icon: GraduationCap },
  { title: "Metas", url: "/metas", icon: LifeBuoy },
  { title: "Precificação V2", url: "/precificacao-v2", icon: TrendingUp },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { companies, viewAll, setViewAll, toggleCompanyId, togglePersonal, personalSelected, selectedCompanyIds } = useCompany();
  const { pendingCount } = useAIPendingTransactions();
  const { state } = useSidebar();
  const { isHubMember, isOwnerWithMembers } = useHub();
  const { hubAllowed } = usePlanLimits();
  const showHub = hubAllowed || isHubMember || isOwnerWithMembers;
  const collapsed = state === "collapsed";

  // Unified label + icon
  const selectedCount = (personalSelected ? 1 : 0) + selectedCompanyIds.length;
  const ContextIcon = viewAll || selectedCount > 1
    ? Layers
    : (selectedCount === 1 && personalSelected) || selectedCount === 0
      ? User
      : Building2;
  const contextLabel = viewAll
    ? "Todas as contas"
    : selectedCount === 0
      ? "Nenhum contexto"
      : selectedCount === 1
        ? (personalSelected
            ? "Pessoal"
            : companies.find(c => c.id === selectedCompanyIds[0])?.name ?? "1 contexto")
        : `${selectedCount} contextos`;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden glow-primary-sm">
            <img src={evaLogo} alt="EVA OS" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold font-display tracking-tight text-gradient-primary">EVA OS</span>
              <span className="text-[10px] text-muted-foreground leading-none">Gestão Financeira</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Unified Context Selector — supports single + multi-select via checkboxes */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 rounded-lg bg-sidebar-accent/80 px-3 py-2.5 text-sm text-sidebar-accent-foreground hover:bg-accent transition-all duration-200 border border-transparent hover:border-primary/20">
                <ContextIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate flex-1 text-left font-medium">{contextLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={() => setViewAll(true)}>
                <Layers className="mr-2 h-4 w-4" />
                Todas as contas
                {viewAll && <Check className="ml-auto h-4 w-4 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); togglePersonal(); }}>
                <Checkbox checked={viewAll || personalSelected} className="mr-2 pointer-events-none" />
                <User className="mr-2 h-4 w-4" />
                Pessoal
              </DropdownMenuItem>
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onSelect={(e) => { e.preventDefault(); toggleCompanyId(company.id); }}
                >
                  <Checkbox checked={viewAll || selectedCompanyIds.includes(company.id)} className="mr-2 pointer-events-none" />
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="truncate">{company.name}</span>
                </DropdownMenuItem>
              ))}
              {selectedCount > 1 && !viewAll && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    Multi-seleção ativa em Dashboard, Plano de Caixa e DRE
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent rounded-lg transition-all duration-200"
                      activeClassName="bg-gradient-primary-soft border border-primary/20 text-primary font-medium glow-primary-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.hasBadge && pendingCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
                          {pendingCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent rounded-lg transition-all duration-200"
                      activeClassName="bg-gradient-primary-soft border border-primary/20 text-primary font-medium glow-primary-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Cadastros</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {registrationMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent rounded-lg transition-all duration-200"
                      activeClassName="bg-gradient-primary-soft border border-primary/20 text-primary font-medium glow-primary-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* EVA Hub - only for plans that include it (or hub members/owners with existing members) */}
        {showHub && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="EVA Hub">
                    <NavLink
                      to="/eva-hub"
                      className="hover:bg-sidebar-accent rounded-lg transition-all duration-200"
                      activeClassName="bg-gradient-primary-soft border border-primary/20 text-primary font-medium glow-primary-sm"
                    >
                      <UsersRound className="h-4 w-4" />
                      <span>EVA Hub</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Novidades</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {comingSoonItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent rounded-lg transition-all duration-200"
                      activeClassName="bg-gradient-primary-soft border border-primary/20 text-primary font-medium glow-primary-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      <span className="ml-auto text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">Em breve</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Documentação">
              <NavLink
                to="/docs"
                className="hover:bg-sidebar-accent rounded-lg transition-all duration-200"
                activeClassName="bg-gradient-primary-soft border border-primary/20 text-primary font-medium glow-primary-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span>Documentação</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações">
              <NavLink
                to="/configuracoes"
                className="hover:bg-sidebar-accent rounded-lg transition-all duration-200"
                activeClassName="bg-gradient-primary-soft border border-primary/20 text-primary font-medium glow-primary-sm"
              >
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sair"
              className="hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && user && (
          <div className="px-3 py-2.5 border-t border-sidebar-border mt-1">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
