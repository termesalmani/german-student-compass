import { Link, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Briefcase, Mail, LogOut, Compass, Bot, HeartPulse, Settings } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Bureaucracy", url: "/bureaucracy", icon: FileText },
  { title: "Job Applications", url: "/jobs", icon: Briefcase },
  { title: "German Email Helper", url: "/email-helper", icon: Mail },
  { title: "AI Assistant", url: "/assistant", icon: Bot },
  { title: "Student Health", url: "/health", icon: HeartPulse },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">German Student Compass</span>
            <span className="text-xs text-muted-foreground">Your guide to studying in Germany</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <Link
                      to={item.url}
                      activeOptions={{ exact: item.url === "/" }}
                      activeProps={{ "data-active": "true" }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 p-2">
          <div className="truncate text-xs text-muted-foreground" title={user?.email ?? ""}>
            {user?.email}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOut();
              router.navigate({ to: "/auth" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}