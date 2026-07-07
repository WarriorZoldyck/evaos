import { Building2, Folder, Users, LogOut, ScrollText, MessageCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useHub } from "@/contexts/HubContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import evaLogo from "@/assets/eva-os-logo.jpeg";

const baseMenuItems = [
  { title: "Contas", url: "/eva-hub/contas", icon: Building2 },
  { title: "Áreas de Trabalho", url: "/eva-hub/workspaces", icon: Folder },
  { title: "Membros", url: "/eva-hub/membros", icon: Users },
];

const auditoriaItem = { title: "Auditoria", url: "/eva-hub/auditoria", icon: ScrollText };
const integridadeItem = { title: "Saúde de Dados", url: "/eva-hub/integridade", icon: ShieldCheck };
const meuWhatsAppItem = { title: "Meu WhatsApp", url: "/eva-hub/meu-whatsapp", icon: MessageCircle };

export function HubSidebar() {
  const { signOut, user } = useAuth();
  const { state } = useSidebar();
  const { isHubMember } = useHub();
  const collapsed = state === "collapsed";
  const hubMenuItems = isHubMember
    ? [...baseMenuItems, meuWhatsAppItem]
    : [...baseMenuItems, integridadeItem, auditoriaItem];


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
              <span className="text-[10px] text-muted-foreground leading-none">Hub de Gestão</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
            Gestão
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hubMenuItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
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
            <p className="text-xs font-medium text-foreground truncate">{user.user_metadata?.full_name || "Usuário"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
