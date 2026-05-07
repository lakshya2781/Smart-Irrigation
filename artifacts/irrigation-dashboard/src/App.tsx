import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout/Layout";
import Overview from "@/pages/Overview";
import Zones from "@/pages/Zones";
import Control from "@/pages/Control";
import Sensors from "@/pages/Sensors";
import AiPanel from "@/pages/AiPanel";
import Alerts from "@/pages/Alerts";
import History from "@/pages/History";
import CropsConfig from "@/pages/CropsConfig";
import CropHealth from "@/pages/CropHealth";
import NotFound from "@/pages/not-found";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RealtimeBridge() {
  useRealtimeUpdates();
  return null;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/zones" component={Zones} />
        <Route path="/control" component={Control} />
        <Route path="/sensors" component={Sensors} />
        <Route path="/ai" component={AiPanel} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/history" component={History} />
        <Route path="/crops" component={CropsConfig} />
        <Route path="/crop-health" component={CropHealth} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <RealtimeBridge />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
