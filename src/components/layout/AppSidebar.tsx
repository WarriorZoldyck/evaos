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
  Target,
  TrendingUp,
  BookOpen,
  CalendarDays,
  Plug,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
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
import evaLogo from "@/assets/eva-os-logo.jpeg";

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Lançamentos", url: "/lancamentos", icon: ArrowLeftRight },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
];

const financeMenuItems = [
  { title: "Plano de Caixa", url: "/plano-de-caixa", icon: BarChart3 },
  { title: "DRE Competência", url: "/dre", icon: FileText },
  { title: "Precificação", url: "/precificacao", icon: Calculator },
];

const registrationMenuItems = [
  { title: "Contas & Cartões", url: "/contas", icon: CreditCard },
  { title: "Categorias", url: "/categorias", icon: FolderTree },
  { title: "Fornecedores e Clientes", url: "/contatos", icon: Users },
  { title: "Integrações", url: "/integracoes", icon: Plug },
];

const comingSoonItems = [
  { title: "EVA Kids", url: "/eva-kids", icon: GraduationCap },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Precificação V2", url: "/precificacao-v2", icon: TrendingUp },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { companies, selectedCompanyId, setSelectedCompanyId, isPersonal } = useCompany();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const contextLabel = isPersonal ? "Pessoal" : selectedCompany?.name ?? "Pessoal";

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

      {/* Context Selector */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 rounded-lg bg-sidebar-accent/80 px-3 py-2.5 text-sm text-sidebar-accent-foreground hover:bg-accent transition-all duration-200 border border-transparent hover:border-primary/20">
                {isPersonal ? (
                  <User className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="truncate flex-1 text-left font-medium">{contextLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => setSelectedCompanyId(null)}>
                <User className="mr-2 h-4 w-4" />
                Pessoal
              </DropdownMenuItem>
              {companies.length > 0 && <DropdownMenuSeparator />}
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => setSelectedCompanyId(company.id)}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {company.name}
                </DropdownMenuItem>
              ))}
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
