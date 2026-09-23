import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Checkbox,
  Dialog,
  DialogContent,
  CircularProgress,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import {
  ChevronRight,
  CheckCircle,
  Truck,
  Package,
  AlertTriangle,
} from "lucide-react";
import {
  fetchReceivingShipments,
  receivePackingUnits,
  type ReceivingPackingUnit,
  type ReceivingShipment,
} from "../lib/api";

const theme = createTheme({
  direction: "rtl",
  typography: { fontFamily: "Heebo, sans-serif" },
});

// A packing unit is off the truck once it reached one of these statuses.
const ARRIVED_STATUSES = ["arrived_pending_verification", "verified"];

function hasArrived(unit: ReceivingPackingUnit): boolean {
  return ARRIVED_STATUSES.includes(unit.status);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shipmentLabel(shipment: ReceivingShipment): string {
  return shipment.id.slice(0, 5).toUpperCase();
}

// Backend messages already arrive in Hebrew and are safe to show. Anything else
// (network failures, bare status codes) is noise the user cannot act on.
function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const isHebrew = /[֐-׿]/.test(message);
  return isHebrew ? message : fallback;
}

// ─── Shared chrome ──────────────────────────────────────────────────────────

interface BottomNavProps {
  onTransport: () => void;
  onPacking: () => void;
  onHome: () => void;
}

interface ScreenProps {
  title: string;
  onBack: () => void;
  nav: BottomNavProps;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function Screen({ title, onBack, children, footer }: ScreenProps) {
  return (
    <Box
      dir="rtl"
      sx={{
        width: "100vw",
        height: "calc(100dvh - 62px)",
        position: "relative",
        backgroundImage: "url(/desert-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 25%, transparent 50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pt: "5vh",
          pb: "1.5vh",
          px: "5vw",
          flexShrink: 0,
        }}
      >
        <IconButton
          onClick={onBack}
          aria-label="חזרה"
          sx={{ position: "absolute", right: "4vw", color: "white", p: 0.5 }}
        >
          <ChevronRight size={28} strokeWidth={2.5} />
        </IconButton>
        <Typography
          sx={{
            fontFamily: "Heebo, sans-serif",
            fontWeight: 800,
            fontSize: "1.45rem",
            color: "white",
            textShadow: "0 2px 8px rgba(0,0,0,0.45)",
            letterSpacing: 0.4,
            textAlign: "center",
          }}
        >
          {title}
        </Typography>
      </Box>

      {children}
      {footer}
    </Box>
  );
}

function CenteredNotice({ text }: { text: string }) {
  return (
    <Box
      sx={{
        mt: "2vh",
        px: "16px",
        py: "14px",
        borderRadius: "14px",
        backgroundColor: "rgba(0,0,0,0.28)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        textAlign: "center",
      }}
    >
      <Typography
        sx={{
          fontFamily: "Heebo, sans-serif",
          fontSize: "0.95rem",
          fontWeight: 600,
          color: "white",
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <Box
      sx={{
        backgroundColor: "rgba(180, 60, 30, 0.22)",
        border: "1px solid rgba(180, 60, 30, 0.45)",
        borderRadius: "12px",
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        mt: 1,
      }}
    >
      <AlertTriangle size={18} color="#ffdcd2" style={{ flexShrink: 0 }} />
      <Typography
        sx={{
          fontFamily: "Heebo, sans-serif",
          fontSize: "0.88rem",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}

interface PrimaryButtonProps {
  label: string;
  enabled: boolean;
  busy: boolean;
  onClick: () => void;
}

function PrimaryButton({ label, enabled, busy, onClick }: PrimaryButtonProps) {
  const active = enabled && !busy;
  return (
    <Box
      sx={{
        position: "relative",
        zIndex: 2,
        flexShrink: 0,
        px: "5vw",
        pt: 1.5,
        pb: "4px",
      }}
    >
      <Box
        onClick={active ? onClick : undefined}
        sx={{
          width: "100%",
          py: "15px",
          borderRadius: "999px",
          backgroundColor: active
            ? "rgba(90, 50, 18, 0.92)"
            : "rgba(90, 50, 18, 0.38)",
          color: active ? "white" : "rgba(255,255,255,0.55)",
          fontFamily: "Heebo, sans-serif",
          fontWeight: 700,
          fontSize: "1.05rem",
          textAlign: "center",
          cursor: active ? "pointer" : "default",
          boxShadow: active ? "0 4px 18px rgba(0,0,0,0.3)" : "none",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          letterSpacing: 0.5,
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          ...(active && { "&:active": { transform: "scale(0.97)" } }),
        }}
      >
        {busy ? (
          <CircularProgress size={20} sx={{ color: "rgba(255,255,255,0.8)" }} />
        ) : (
          label
        )}
      </Box>
    </Box>
  );
}

// ─── Step 1: shipments waiting to be unloaded ───────────────────────────────

interface ShipmentListProps {
  shipments: ReceivingShipment[];
  loading: boolean;
  error: string | null;
  onSelect: (shipment: ReceivingShipment) => void;
  onBack: () => void;
  nav: BottomNavProps;
}

function ShipmentList({
  shipments,
  loading,
  error,
  onSelect,
  onBack,
  nav,
}: ShipmentListProps) {
  return (
    <Screen title="יחידות הובלה שהגיעו" onBack={onBack} nav={nav}>
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          overflowY: "auto",
          px: "5vw",
          pb: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.2,
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", pt: "4vh" }}>
            <CircularProgress size={32} sx={{ color: "#8B5E3C" }} />
          </Box>
        )}

        {!loading && error && <ErrorBanner text={error} />}

        {!loading && !error && shipments.length === 0 && (
          <CenteredNotice text="אין כרגע הובלות הממתינות לקבלה" />
        )}

        {!loading &&
          !error &&
          shipments.map((shipment) => (
            <Box
              key={shipment.id}
              onClick={() => onSelect(shipment)}
              sx={{
                backgroundColor: "rgba(238, 205, 135, 0.72)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.35)",
                cursor: "pointer",
                userSelect: "none",
                WebkitTapHighlightColor: "transparent",
                display: "flex",
                flexDirection: "row",
                direction: "rtl",
                overflow: "hidden",
                transition: "transform 0.15s ease",
                "&:active": { transform: "scale(0.98)" },
              }}
            >
              <Box
                sx={{
                  width: "76px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderLeft: "1px solid rgba(160,110,40,0.2)",
                }}
              >
                <Truck size={40} color="#9B6E3C" strokeWidth={1.2} />
              </Box>

              <Box
                sx={{
                  flex: 1,
                  p: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                  <Box
                    sx={{
                      border: "1.5px solid rgba(101,62,35,0.7)",
                      borderRadius: "6px",
                      px: "12px",
                      py: "2px",
                      backgroundColor: "rgba(255,255,255,0.45)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: "Heebo, sans-serif",
                        fontWeight: 800,
                        fontSize: "0.92rem",
                        color: "#2d1b0a",
                        whiteSpace: "nowrap",
                      }}
                    >
                      מס׳ הובלה {shipmentLabel(shipment)}
                    </Typography>
                  </Box>
                </Box>

                {(
                  [
                    ["מספר רישוי", shipment.vehicleIdentifier ?? "—"],
                    ["כמות יחידות", String(shipment.packingUnits.length)],
                    ["תאריך", formatDate(shipment.transportAt)],
                    ["שעה", formatTime(shipment.transportAt)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <Typography
                    key={label}
                    sx={{
                      fontFamily: "Heebo, sans-serif",
                      fontSize: "0.8rem",
                      color: "#3d2008",
                      lineHeight: 1.5,
                      textAlign: "right",
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 700 }}>
                      {label}:{" "}
                    </Box>
                    {value}
                  </Typography>
                ))}
              </Box>
            </Box>
          ))}
      </Box>
    </Screen>
  );
}

// ─── Step 2 / 4: packing units of the selected shipment ─────────────────────

interface PackingUnitCardProps {
  unit: ReceivingPackingUnit;
  selected: boolean;
  locked: boolean;
  onToggle: () => void;
}

function PackingUnitCard({
  unit,
  selected,
  locked,
  onToggle,
}: PackingUnitCardProps) {
  const destination = useMemo(() => {
    try {
      return unit.destinationDescription
        ? (JSON.parse(unit.destinationDescription) as {
            building?: string;
            floor?: string;
            room?: string;
          })
        : null;
    } catch {
      return null;
    }
  }, [unit.destinationDescription]);

  const sourceLines = unit.sourceDescription
    ? unit.sourceDescription
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

  const text = selected ? "#fff" : "#2d1b0a";
  const subText = selected ? "rgba(255,255,255,0.78)" : "#6e4530";

  return (
    <Box
      onClick={locked ? undefined : onToggle}
      sx={{
        backgroundColor: selected
          ? "rgba(101, 55, 12, 0.80)"
          : "rgba(238, 205, 135, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: "16px",
        border: selected
          ? "1.5px solid rgba(255,255,255,0.22)"
          : "1px solid rgba(255,255,255,0.35)",
        opacity: locked ? 0.62 : 1,
        cursor: locked ? "default" : "pointer",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        transition: "background-color 0.18s ease",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        direction: "rtl",
      }}
    >
      <Box
        sx={{
          width: "64px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderLeft: `1px solid ${selected ? "rgba(255,255,255,0.12)" : "rgba(160,110,40,0.2)"}`,
        }}
      >
        <Package
          size={36}
          color={selected ? "rgba(255,255,255,0.65)" : "#9B6E3C"}
          strokeWidth={1.2}
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          p: "12px 6px 12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box
            sx={{
              border: `1.5px solid ${selected ? "rgba(255,255,255,0.5)" : "rgba(101,62,35,0.7)"}`,
              borderRadius: "6px",
              px: "12px",
              py: "2px",
              backgroundColor: selected
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.45)",
            }}
          >
            <Typography
              sx={{
                fontFamily: "Heebo, sans-serif",
                fontWeight: 800,
                fontSize: "0.9rem",
                color: text,
                whiteSpace: "nowrap",
              }}
            >
              מס׳ אריזה {unit.displaySerial ?? "—"}
            </Typography>
          </Box>

          {locked ? (
            <Typography
              sx={{
                fontFamily: "Heebo, sans-serif",
                fontWeight: 700,
                fontSize: "0.72rem",
                color: "#2d5a2d",
                backgroundColor: "rgba(255,255,255,0.6)",
                borderRadius: "999px",
                px: "10px",
                py: "2px",
                whiteSpace: "nowrap",
              }}
            >
              נפרקה
            </Typography>
          ) : (
            <Checkbox
              checked={selected}
              // The whole card is the touch target, so the box is display only.
              onChange={() => undefined}
              tabIndex={-1}
              disableRipple
              sx={{
                p: 0.5,
                pointerEvents: "none",
                color: "rgba(101,62,35,0.65)",
                "&.Mui-checked": { color: "#fff" },
              }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Box sx={{ flex: 1, textAlign: "right" }}>
            {sourceLines.length > 0 && (
              <Typography
                sx={{
                  fontFamily: "Heebo, sans-serif",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: text,
                  lineHeight: 1.6,
                }}
              >
                נשלח מ: {sourceLines[0]}
              </Typography>
            )}
            {sourceLines.slice(1).map((line, i) => (
              <Typography
                key={i}
                sx={{
                  fontFamily: "Heebo, sans-serif",
                  fontSize: "0.76rem",
                  color: subText,
                  lineHeight: 1.6,
                }}
              >
                {line}
              </Typography>
            ))}
          </Box>

          {destination && (
            <Box sx={{ flex: 1, textAlign: "right" }}>
              <Typography
                sx={{
                  fontFamily: "Heebo, sans-serif",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: text,
                  lineHeight: 1.6,
                }}
              >
                נשלח אל: {destination.building ?? "—"}
              </Typography>
              {destination.floor && (
                <Typography
                  sx={{
                    fontFamily: "Heebo, sans-serif",
                    fontSize: "0.76rem",
                    color: subText,
                    lineHeight: 1.6,
                  }}
                >
                  {destination.floor}
                </Typography>
              )}
              {destination.room && (
                <Typography
                  sx={{
                    fontFamily: "Heebo, sans-serif",
                    fontSize: "0.76rem",
                    color: subText,
                    lineHeight: 1.6,
                  }}
                >
                  {destination.room}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        <Typography
          sx={{
            fontFamily: "Heebo, sans-serif",
            fontSize: "0.78rem",
            fontWeight: 700,
            color: text,
            textAlign: "right",
          }}
        >
          {unit.description}
        </Typography>
      </Box>
    </Box>
  );
}

interface PackingUnitListProps {
  title: string;
  units: ReceivingPackingUnit[];
  selected: Set<string>;
  incomplete: boolean;
  submitting: boolean;
  error: string | null;
  actionLabel: string;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSubmit: () => void;
  onBack: () => void;
  nav: BottomNavProps;
}

function PackingUnitList({
  title,
  units,
  selected,
  incomplete,
  submitting,
  error,
  actionLabel,
  onToggle,
  onToggleAll,
  onSubmit,
  onBack,
  nav,
}: PackingUnitListProps) {
  const selectable = units.filter((unit) => !hasArrived(unit));
  const allSelected =
    selectable.length > 0 && selectable.every((unit) => selected.has(unit.id));

  return (
    <Screen
      title={title}
      onBack={onBack}
      nav={nav}
      footer={
        <PrimaryButton
          label={actionLabel}
          enabled={selected.size > 0}
          busy={submitting}
          onClick={onSubmit}
        />
      }
    >
      {/* Select all */}
      {selectable.length > 0 && (
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            px: "5vw",
            pb: "6px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            onClick={onToggleAll}
            sx={{
              fontFamily: "Heebo, sans-serif",
              fontWeight: 700,
              fontSize: "0.92rem",
              color: "white",
              textShadow: "0 1px 4px rgba(0,0,0,0.45)",
              cursor: "pointer",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            בחר הכל
          </Typography>
          <Checkbox
            checked={allSelected}
            onChange={onToggleAll}
            slotProps={{ input: { "aria-label": "בחר הכל" } }}
            sx={{
              p: 0.5,
              color: "rgba(255,255,255,0.85)",
              "&.Mui-checked": { color: "#fff" },
            }}
          />
        </Box>
      )}

      {/* Warning shown once the shipment turned out to be incomplete */}
      {incomplete && (
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            px: "5vw",
            pb: "8px",
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              backgroundColor: "rgba(198, 40, 40, 0.92)",
              borderRadius: "10px",
              px: "12px",
              py: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              boxShadow: "0 3px 12px rgba(0,0,0,0.25)",
            }}
          >
            <AlertTriangle size={18} color="#fff" style={{ flexShrink: 0 }} />
            <Typography
              sx={{
                fontFamily: "Heebo, sans-serif",
                fontWeight: 700,
                fontSize: "0.88rem",
                color: "white",
                textAlign: "center",
              }}
            >
              שימו לב, לא כל האריזות נפרקו
            </Typography>
          </Box>
        </Box>
      )}

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          overflowY: "auto",
          px: "5vw",
          pb: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        {units.length === 0 && <CenteredNotice text="אין אריזות בהובלה זו" />}

        {units.map((unit) => (
          <PackingUnitCard
            key={unit.id}
            unit={unit}
            selected={selected.has(unit.id)}
            locked={hasArrived(unit)}
            onToggle={() => onToggle(unit.id)}
          />
        ))}

        {error && <ErrorBanner text={error} />}
      </Box>
    </Screen>
  );
}

// ─── Success dialog ─────────────────────────────────────────────────────────

function CompletionDialog({
  open,
  onConfirm,
}: {
  open: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            backgroundColor: "rgba(246, 230, 195, 0.97)",
            border: "1px solid rgba(200, 160, 100, 0.5)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            mx: 3,
            direction: "rtl",
          },
        },
      }}
    >
      <DialogContent sx={{ p: 3, textAlign: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <CheckCircle size={48} color="#2d7a3d" strokeWidth={1.5} />
        </Box>

        <Typography
          sx={{
            fontFamily: "Heebo, sans-serif",
            fontWeight: 800,
            fontSize: "1.2rem",
            color: "#3d2008",
            mb: 1,
          }}
        >
          תהליך הפריקה הושלם
        </Typography>

        <Typography
          sx={{
            fontFamily: "Heebo, sans-serif",
            fontSize: "0.95rem",
            color: "#6e4e37",
            mb: 2.5,
            lineHeight: 1.6,
          }}
        >
          כל האריזות בהובלה התקבלו וההובלה סומנה כהובלה שהגיעה.
        </Typography>

        <Box
          onClick={onConfirm}
          sx={{
            width: "100%",
            py: "13px",
            borderRadius: "999px",
            backgroundColor: "#8B5E3C",
            color: "white",
            fontFamily: "Heebo, sans-serif",
            fontWeight: 700,
            fontSize: "1rem",
            textAlign: "center",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            WebkitTapHighlightColor: "transparent",
            userSelect: "none",
            "&:active": { transform: "scale(0.97)" },
          }}
        >
          אישור
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

export interface ReceivingPageProps {
  userId: string | null;
  /** Leaves the receiving flow (back to the main menu). */
  onExit: () => void;
  /** Bottom-bar shortcuts to the other logistics flows. */
  onNavigate: (route: "packing" | "transport") => void;
}

export default function ReceivingPage({
  userId,
  onExit,
  onNavigate,
}: ReceivingPageProps) {
  const [shipments, setShipments] = useState<ReceivingShipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);

  const [shipment, setShipment] = useState<ReceivingShipment | null>(null);
  const [units, setUnits] = useState<ReceivingPackingUnit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [incomplete, setIncomplete] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const loadShipments = useCallback(async () => {
    if (!userId) return;
    setLoadingShipments(true);
    setShipmentsError(null);
    try {
      const all = await fetchReceivingShipments(userId);
      // Only shipments still on the road can be unloaded.
      setShipments(all.filter((s) => s.status === "sent"));
    } catch (error) {
      setShipmentsError(friendlyError(error, "שגיאה בטעינת ההובלות, נסה שוב"));
    } finally {
      setLoadingShipments(false);
    }
  }, [userId]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const nav: BottomNavProps = {
    onTransport: () => onNavigate("transport"),
    onPacking: () => onNavigate("packing"),
    onHome: onExit,
  };

  const openShipment = (next: ReceivingShipment) => {
    setShipment(next);
    setUnits(next.packingUnits);
    setSelected(new Set());
    setIncomplete(false);
    setSubmitError(null);
  };

  const backToShipments = () => {
    setShipment(null);
    setUnits([]);
    setSelected(new Set());
    setIncomplete(false);
    setSubmitError(null);
    loadShipments();
  };

  const toggleUnit = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const selectable = units.filter((unit) => !hasArrived(unit));
    setSelected((prev) =>
      selectable.every((unit) => prev.has(unit.id))
        ? new Set()
        : new Set(selectable.map((unit) => unit.id)),
    );
  };

  const submit = async () => {
    if (!shipment || !userId || submitting || selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await receivePackingUnits(
        shipment.id,
        [...selected],
        userId,
      );
      setSelected(new Set());
      if (result.finalized) {
        setCompleted(true);
        return;
      }
      // Some packing units never showed up — keep unloading just those.
      setUnits(result.remainingPackingUnits);
      setIncomplete(true);
    } catch (error) {
      setSubmitError(friendlyError(error, "עדכון האריזות נכשל, נסה שוב"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      {shipment ? (
        <PackingUnitList
          title={incomplete ? "אריזות שטרם נפרקו" : "אריזות ביחידת הובלה"}
          units={units}
          selected={selected}
          incomplete={incomplete}
          submitting={submitting}
          error={submitError}
          actionLabel={incomplete ? "סיום עדכון" : "סיום פריקה"}
          onToggle={toggleUnit}
          onToggleAll={toggleAll}
          onSubmit={submit}
          onBack={backToShipments}
          nav={nav}
        />
      ) : (
        <ShipmentList
          shipments={shipments}
          loading={loadingShipments}
          error={shipmentsError}
          onSelect={openShipment}
          onBack={onExit}
          nav={nav}
        />
      )}
      <CompletionDialog open={completed} onConfirm={onExit} />
    </ThemeProvider>
  );
}
