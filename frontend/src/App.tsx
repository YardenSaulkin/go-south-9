import { useEffect, useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import AppLogo from "./components/AppLogo";
import LogisticsMainMenu from "./components/LogisticsMainMenu";
import BottomNavBar from "./components/BottomNavBar";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import PocDashboardPage from "./pages/PocDashboardPage";
import ShipmentsStatusPage from "./pages/ShipmentsStatusPage";
import PackingUnitsStatusPage from "./pages/PackingUnitsStatusPage";
import { navigate, usePathname } from "./navigation";
import PackingUnitPage, {
  PackingSuccessScreen,
  type PackingDraft,
} from "./components/PackingUnitPage";
import ShipmentPage from "./components/ShipmentPage";
import DistributionPage from "./components/DistributionPage";
import ReceivingPage from "./components/ReceivingPage";
import FacilityHomePage from "./facility/pages/FacilityHomePage";
import ReportFlowPage from "./facility/pages/ReportFlowPage";
import MyReportsPage from "./facility/pages/MyReportsPage";
import RoomsFlowPage from "./facility/pages/RoomsFlowPage";
import CompoundNavigationPage from "./facility/pages/CompoundNavigationPage";
import FacilityInsightsPage from "./facility/pages/FacilityInsightsPage";
import { useCurrentUser } from "./auth/useCurrentUser";
import { clearCurrentUser, userDisplayName } from "./auth/session";
import type { PackingSuccessResponse } from "./api/packing";

// Routes that manage their own bottom navbar (or need none)
const NO_NAVBAR_ROUTES = ["/home", "/login", "/signup"];

// Facility mode brings its own bottom navigation, so the logistics one stays
// off on every screen inside it.
const FACILITY_ROUTE_PREFIX = "/facility";

type NavigateRoute =
  | "packing"
  | "transport"
  | "receiving"
  | "distribution"
  | "admin"
  | "poc";

const PUBLIC_ROUTES = ["/home", "/login", "/signup"];

const FALLBACK_USER = { name: "דני", personalNumber: "1234567", role: "מפקד" };

export default function App() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [menuTab, setMenuTab] = useState<"sending" | "receiving">("sending");
  const [packingSuccess, setPackingSuccess] =
    useState<PackingSuccessResponse | null>(null);
  const [packingDraft, setPackingDraft] = useState<PackingDraft | null>(null);

  useEffect(() => {
    if (pathname === "/") {
      navigate("/home", { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!user && pathname !== "/" && !PUBLIC_ROUTES.includes(pathname)) {
      navigate("/home", { replace: true });
    }
  }, [user, pathname]);

  const handleNavigate = (route: NavigateRoute) => {
    if (route === "packing") navigate("/packing");
    else if (route === "transport") navigate("/transport");
    else if (route === "admin") navigate("/admin/users");
    else if (route === "poc") navigate("/poc/dashboard");
    else console.log("navigate ->", route);
  };
  const handleBack = () => navigate("/menu");

  const handleLogout = () => {
    clearCurrentUser();
    setPackingDraft(null);
    setPackingSuccess(null);
    navigate("/home");
  };

  const inFacilityMode = pathname.startsWith(FACILITY_ROUTE_PREFIX);
  const showNavBar =
    !!user && !inFacilityMode && !NO_NAVBAR_ROUTES.includes(pathname);
  const navActive =
    pathname === "/status/shipments"
      ? "shipments"
      : pathname === "/status/packing-units"
        ? "packing-units"
        : pathname === "/menu"
          ? "home"
          : undefined;

  if (pathname === "/home") return <HomePage />;
  if (pathname === "/login") return <LoginPage />;
  if (pathname === "/signup") return <SignUpPage />;
  if (!user) return <HomePage />;

  let page: ReactNode;
  if (pathname === "/facility") page = <FacilityHomePage user={user} />;
  else if (pathname === "/facility/report") page = <ReportFlowPage />;
  else if (pathname === "/facility/reports") page = <MyReportsPage />;
  else if (pathname === "/facility/rooms") page = <RoomsFlowPage />;
  else if (pathname === "/facility/navigate") page = <CompoundNavigationPage />;
  else if (pathname === "/facility/insights") page = <FacilityInsightsPage />;
  else if (pathname === "/admin/users")
    page = <AdminUsersPage userId={user.id} />;
  else if (pathname === "/poc/dashboard")
    page = <PocDashboardPage userId={user.id} />;
  else if (pathname === "/status/shipments")
    page = <ShipmentsStatusPage userId={user.id} />;
  else if (pathname === "/status/packing-units")
    page = <PackingUnitsStatusPage userId={user.id} />;
  else if (pathname === "/packing/success" && packingSuccess) {
    return (
      <PackingSuccessScreen
        response={packingSuccess}
        onContinue={() => {
          setPackingDraft({
            orgScopeId: packingSuccess.source.orgScopeId,
            unit: packingSuccess.source.unit ?? "",
            anaf: packingSuccess.source.anaf ?? "",
            mador: packingSuccess.source.mador ?? "",
            team: packingSuccess.source.team ?? "",
            roomId: packingSuccess.source.roomId ?? "",
            building: packingSuccess.destination.building ?? "",
            floor: packingSuccess.destination.floor ?? "",
            destinationRoom: packingSuccess.destination.room ?? "",
            sourceDescription: packingSuccess.source.description ?? "",
            destinationDescription:
              packingSuccess.destination.description ?? "",
            destinationMode: "existing",
            destinationId: packingSuccess.destination.id ?? "",
          });
          setPackingSuccess(null);
          navigate("/packing");
        }}
        onHome={() => {
          setPackingDraft(null);
          setPackingSuccess(null);
          navigate("/home");
        }}
      />
    );
  } else if (pathname === "/packing")
    return (
      <PackingUnitPage
        key={packingDraft ? "retained-packing" : "new-packing"}
        initialDraft={packingDraft}
        onBack={handleBack}
        onComplete={(response, draft) => {
          setPackingDraft(draft);
          setPackingSuccess(response);
          navigate("/packing/success");
        }}
      />
    );
  else if (pathname === "/distribution")
    page = (
      <DistributionPage
        onBack={handleBack}
        userId={user.id}
        orgScopeId={user.orgScopeId}
      />
    );
  else if (pathname === "/transport")
    page = (
      <ShipmentPage
        onBack={handleBack}
        userId={user.id}
        orgScopeId={user.orgScopeId}
      />
    );
  else if (pathname === "/receiving")
    page = (
      <ReceivingPage
        userId={user.id}
        onExit={handleBack}
        onNavigate={handleNavigate}
      />
    );
  else
    page = (
      <>
        <AppLogo />
        <LogisticsMainMenu
          user={{
            name: userDisplayName(user),
            personalNumber: user.personalNumber ?? undefined,
            role: user.role,
          }}
          onNavigate={handleNavigate}
          onEnterFacilityMode={() => navigate("/facility")}
          onLogout={handleLogout}
          activeTab={menuTab}
          onTabChange={setMenuTab}
        />
      </>
    );

  return (
    <Box sx={{ pb: showNavBar ? "62px" : 0 }}>
      {page}
      {showNavBar && <BottomNavBar active={navActive} />}
    </Box>
  );
}
