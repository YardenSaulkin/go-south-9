import { useState } from "react";
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Avatar,
  Menu,
  Chip,
  MenuItem,
  ListItemIcon,
  Button,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import {
  Package,
  Truck,
  PackageOpen,
  LayoutGrid,
  Users,
  BarChart3,
  type LucideIcon,
  LogOut,
} from "lucide-react";

interface User {
  name: string;
  personalNumber?: string;
  role?: "admin" | "poc" | "normal";
}

type TabValue = "sending" | "receiving";
type NavigateRoute =
  | "packing"
  | "transport"
  | "receiving"
  | "distribution"
  | "admin"
  | "poc";

interface ActionCardItem {
  label: string;
  route: NavigateRoute;
  Icon: LucideIcon;
}

export interface MainMenuProps {
  user: User;
  onNavigate: (route: NavigateRoute) => void;
  onLogout: () => void;
}

const SENDING_CARDS: ActionCardItem[] = [
  { label: "יחידת אריזה", route: "packing", Icon: Package },
  { label: "יצירת הובלה", route: "transport", Icon: Truck },
];

const RECEIVING_CARDS: ActionCardItem[] = [
  { label: "קבלת ציוד", route: "receiving", Icon: PackageOpen },
  { label: "פיזור ציוד", route: "distribution", Icon: LayoutGrid },
];

const ADMIN_CARDS: ActionCardItem[] = [
  { label: "ניהול משתמשים", route: "admin", Icon: Users },
];

const POC_CARDS: ActionCardItem[] = [
  { label: "דשבורד קישור", route: "poc", Icon: BarChart3 },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "מנהל",
  poc: "קצין קישור",
  normal: "משתמש",
};

const theme = createTheme({
  direction: "rtl",
  typography: { fontFamily: "Heebo, sans-serif" },
});

const cardEnterKeyframes = `
  @keyframes cardEnter {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

function getInitials(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export default function LogisticsMainMenu({
  user,
  onNavigate,
  onLogout,
}: MainMenuProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("sending");
  const [animKey, setAnimKey] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const roleLabel = user.role ? (ROLE_LABEL[user.role] ?? user.role) : null;

  const baseCards = activeTab === "sending" ? SENDING_CARDS : RECEIVING_CARDS;
  const cards = baseCards;
  const roleCards: ActionCardItem[] =
    user.role === "admin"
      ? [ADMIN_CARDS[0], POC_CARDS[0]]
      : user.role === "poc"
        ? [POC_CARDS[0]]
        : [];

  const handleTabChange = (
    _: React.MouseEvent<HTMLElement>,
    val: TabValue | null,
  ) => {
    if (val && val !== activeTab) {
      setActiveTab(val);
      setAnimKey((k) => k + 1);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <style>{cardEnterKeyframes}</style>
      <Box
        dir="rtl"
        sx={{
          width: "100vw",
          height: "100dvh",
          position: "relative",
          backgroundImage: "url(/desert-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          display: "flex",
          flexDirection: "column",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 30%, transparent 55%)",
            pointerEvents: "none",
            zIndex: 0,
          },
        }}
      >
        {/* Main content column */}
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            flexGrow: 1,
            px: "5vw",
            pt: "6vh",
            pb: "4vh",
            gap: "2vh",
          }}
        >
          {/* Greeting row: avatar left + text right */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 0.5,
              }}
            >
              <Typography
                sx={{
                  color: "white",
                  fontWeight: 700,
                  fontFamily: "Heebo, sans-serif",
                  textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                  textAlign: "right",
                  fontSize: "1.15rem",
                  lineHeight: 1.4,
                }}
              >
                שלום {user.name}, מה תרצה לעשות?
              </Typography>
              {roleLabel && user.role !== "normal" && (
                <Chip
                  label={roleLabel}
                  size="small"
                  sx={{
                    fontFamily: "Heebo, sans-serif",
                    fontWeight: 600,
                    bgcolor: "rgba(255,255,255,0.25)",
                    color: "white",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255,255,255,0.4)",
                  }}
                />
              )}
            </Box>
            <Avatar
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="תפריט משתמש"
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                bgcolor: "rgba(139, 94, 60, 0.85)",
                border: "2px solid rgba(255,255,255,0.55)",
                fontSize: "1rem",
                fontFamily: "Heebo, sans-serif",
                fontWeight: 700,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              {getInitials(user.name)}
            </Avatar>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              slotProps={{
                paper: {
                  sx: { borderRadius: "14px", minWidth: 160, mt: 0.5 },
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  onLogout();
                }}
                sx={{
                  minHeight: 52,
                  fontWeight: 600,
                  gap: 1,
                  color: "#5a3515",
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, color: "inherit" }}>
                  <LogOut size={20} />
                </ListItemIcon>
                התנתק
              </MenuItem>
            </Menu>
          </Box>

          {/* Role shortcut buttons — admin/POC only */}
          {roleCards.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              {roleCards.map((rc) => (
                <Button
                  key={rc.route}
                  onClick={() => onNavigate(rc.route)}
                  startIcon={<rc.Icon size={16} />}
                  size="small"
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textTransform: 'none',
                    color: 'white',
                    bgcolor: 'rgba(139,94,60,0.55)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '999px',
                    px: 2,
                    py: 0.5,
                    gap: 0.75,
                    '& .MuiButton-startIcon': { margin: 0 },
                    '&:hover': { bgcolor: 'rgba(139,94,60,0.75)' },
                  }}
                >
                  {rc.label}
                </Button>
              ))}
            </Box>
          )}

          {/* Pill Toggle */}
          <Box
            sx={{
              backgroundColor: "rgba(246, 215, 176, 0.9)",
              borderRadius: "999px",
              p: "3px",
              width: "65%",
              maxWidth: 240,
              boxShadow: "inset 0 1px 4px rgba(0,0,0,0.12)",
            }}
          >
            <ToggleButtonGroup
              value={activeTab}
              exclusive
              onChange={handleTabChange}
              fullWidth
              sx={{
                gap: "3px",
                "& .MuiToggleButtonGroup-grouped": {
                  border: "none",
                  borderRadius: "999px !important",
                  py: "6px",
                  px: "10px",
                  fontFamily: "Heebo, sans-serif",
                  fontWeight: 500,
                  fontSize: "0.82rem",
                  textTransform: "none",
                  color: "#6e4e37",
                  minWidth: 0,
                  transition: "all 0.2s ease",
                  "&.Mui-selected": {
                    backgroundColor: "#8B5E3C",
                    color: "white",
                    fontWeight: 700,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                    "&:hover": { backgroundColor: "#7a5232" },
                  },
                  "&:hover:not(.Mui-selected)": {
                    backgroundColor: "rgba(139, 94, 60, 0.12)",
                  },
                },
              }}
            >
              {/* RTL: first in DOM = visually RIGHT, second = visually LEFT */}
              <ToggleButton value="sending">שליחת ציוד</ToggleButton>
              <ToggleButton value="receiving">קבלת ציוד</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Action Cards */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: "2vh",
              width: "100%",
              flexGrow: 1,
            }}
          >
            {cards.map((card, i) => (
              <Paper
                key={`${activeTab}-${card.route}`}
                onClick={() => onNavigate(card.route)}
                elevation={0}
                sx={{
                  backgroundColor: "rgba(222, 185, 80, 0.52)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "18px",
                  flex: 1,
                  maxHeight: "32vh",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1.2vh",
                  cursor: "pointer",
                  userSelect: "none",
                  WebkitTapHighlightColor: "transparent",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.14)",
                  animation: "cardEnter 0.3s ease both",
                  animationDelay: `${i * 0.07}s`,
                  animationPlayState: animKey >= 0 ? "running" : "paused",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  "&:active": { transform: "scale(0.97)" },
                }}
              >
                <card.Icon size={30} color="#5a3515" strokeWidth={1.5} />
                <Typography
                  sx={{
                    fontFamily: "Heebo, sans-serif",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#2d1b0a",
                    letterSpacing: 0.3,
                  }}
                >
                  {card.label}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
