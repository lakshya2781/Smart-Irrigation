import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  Sliders,
  BarChart2,
  Brain,
  Bell,
  History,
  Leaf,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/zones", label: "Zones", icon: Layers },
  { href: "/control", label: "Pump Control", icon: Sliders },
  { href: "/sensors", label: "Sensor Data", icon: BarChart2 },
  { href: "/ai", label: "AI Engine", icon: Brain },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/history", label: "History", icon: History },
  { href: "/crops", label: "Crop & Soil", icon: Leaf },
];

export default function Sidebar() {
  const [location] = useLocation();
  const summary = useGetDashboardSummary();

  const activeAlerts = summary.data?.activeAlerts ?? 0;
  const systemStatus = summary.data?.systemStatus ?? "offline";

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      {/* Logo / Brand */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground tracking-wide">AgroFlow</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Irrigation OS</div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 text-xs">
          {systemStatus === "online" ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-green" />
              <Wifi className="w-3 h-3 text-primary" />
              <span className="text-primary font-medium">ESP32 Online</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              <WifiOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href;
          const showBadge = href === "/alerts" && activeAlerts > 0;

          return (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all cursor-pointer group",
                  isActive
                    ? "bg-sidebar-primary/15 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                  )}
                />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-4">
                    {activeAlerts}
                  </Badge>
                )}
                {isActive && <div className="w-1 h-4 rounded-full bg-primary" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-[10px] text-muted-foreground">
          <div className="font-medium text-sidebar-foreground text-xs mb-0.5">Smart Irrigation v1.0</div>
          <div>ESP32 + DHT22 + 4x Moisture</div>
          <div>2x L298N Motor Drivers</div>
        </div>
      </div>
    </aside>
  );
}
