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
  Radio,
} from "lucide-react";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useRef } from "react";

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

function useWsStatus() {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (!mounted) return;
      setStatus("connecting");
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => { if (mounted) setStatus("connected"); };
      ws.onclose = () => {
        if (!mounted) return;
        setStatus("disconnected");
        timeoutId = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      wsRef.current?.close();
    };
  }, []);

  return status;
}

export default function Sidebar() {
  const [location] = useLocation();
  const summary = useGetDashboardSummary();
  const wsStatus = useWsStatus();

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
      <div className="px-4 py-2.5 border-b border-sidebar-border space-y-1.5">
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
              <span className="text-muted-foreground">ESP32 Offline</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Radio className={cn(
            "w-3 h-3",
            wsStatus === "connected" ? "text-primary" :
            wsStatus === "connecting" ? "text-amber-400" : "text-muted-foreground"
          )} />
          <span className={cn(
            "text-[10px]",
            wsStatus === "connected" ? "text-primary" :
            wsStatus === "connecting" ? "text-amber-400" : "text-muted-foreground"
          )}>
            {wsStatus === "connected" ? "Live stream active" :
             wsStatus === "connecting" ? "Connecting…" : "Stream offline"}
          </span>
          {wsStatus === "connected" && (
            <div className="w-1 h-1 rounded-full bg-primary animate-pulse-green ml-auto" />
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
          <div>ESP32 · DHT22 · 4× Moisture</div>
          <div>2× L298N · 135 Crops · 59 Soils</div>
        </div>
      </div>
    </aside>
  );
}
