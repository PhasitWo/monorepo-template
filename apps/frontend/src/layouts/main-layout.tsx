import { NavLink, Outlet } from 'react-router';
import { LogOut, Moon, Sun } from 'lucide-react';
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/hooks/use-app-state';
import { APP_NAME } from '@/constants';

const navGroups = [
  {
    title: 'Main',
    items: [{ title: 'Tags', url: '/tags' }],
  },
  {
    title: 'Administration',
    items: [
      { title: 'Users', url: '/users' },
      { title: 'Audit log', url: '/audit-logs' },
    ],
  },
];

export default function MainLayout() {
  return (
    <SidebarProvider>
      <MainSidebar />
      <main className="p-5 w-full min-w-0">
        <SidebarTrigger className="mb-2 md:hidden" />
        <Outlet />
      </main>
    </SidebarProvider>
  );
}

function MainSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { theme, setTheme } = useTheme();
  const {
    state: { currentUser },
    signOut,
  } = useAppState();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="px-2 py-1">
          <div className="font-semibold">{APP_NAME}</div>
          {currentUser && <div className="text-muted-foreground text-xs">{currentUser.name}</div>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end>
                        {item.title}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Moon /> : <Sun />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
              <LogOut />
            </Button>
          </div>
          <div className="text-muted-foreground/50 text-xs">Build: {import.meta.env.VITE_BUILD_HASH}</div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
