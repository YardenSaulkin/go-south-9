import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Box,
  Button,
  Checkbox,
  createTheme,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { ApiError } from "../api/client";
import {
  packingApi,
  type AppContext,
  type CreatePackingUnitRequest,
  type Destination,
  type EligibleItem,
  type OrgScope,
  type PackingSuccessResponse,
  type PackingUnitType,
  type SourceRoom,
  type SourceRoomDetails,
} from "../api/packing";
import { packingUnitStatusLabels } from "../statusLabels";

const theme = createTheme({
  direction: "rtl",
  typography: { fontFamily: "Heebo, sans-serif" },
});

const TYPE_OPTIONS: Array<{ value: PackingUnitType; label: string }> = [
  { value: "professional_carton", label: "קרטון מקצועי" },
  { value: "personal_carton", label: "קרטון אישי" },
  { value: "pallet", label: "משטח" },
  { value: "dolav", label: "דולב" },
  { value: "bulk", label: "תפזורת" },
];

export interface PackingDraft {
  orgScopeId: string;
  unit: string;
  anaf: string;
  mador: string;
  team: string;
  roomId: string;
  sourceDescription: string;
  destinationMode: "existing" | "new";
  destinationId: string;
  destinationDescription: string;
  building: string;
  floor: string;
  destinationRoom: string;
}

interface SelectOption {
  value: string;
  label: string;
}
interface CustomSelectProps {
  value: string;
  placeholder: string;
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}
type HierarchyField = "unit" | "anaf" | "mador" | "team";

const ORG_CODE_RANGES: Record<HierarchyField, [number, number]> = {
  unit: [0, 2],
  anaf: [2, 4],
  mador: [4, 6],
  team: [6, 8],
};

function scopeCode(scope: OrgScope, field: HierarchyField): string {
  const explicit = scope[`${field}Code`];
  if (explicit) return explicit;
  if (scope.orgCode && /^\d{8}$/.test(scope.orgCode)) {
    const [start, end] = ORG_CODE_RANGES[field];
    return scope.orgCode.slice(start, end);
  }
  return scope[field] ?? "";
}

function scopeOptions(
  scopes: OrgScope[],
  field: HierarchyField,
): SelectOption[] {
  const values = new Map<string, string>();
  for (const scope of scopes) {
    const value = scopeCode(scope, field);
    if (!value) continue;
    const name = scope[field];
    values.set(value, name && name !== value ? `${value} · ${name}` : value);
  }
  return [...values].map(([value, label]) => ({ value, label }));
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: "0.95rem",
        color: "#3d2008",
        textAlign: "right",
        mb: 1,
      }}
    >
      {children}
    </Typography>
  );
}

function CustomSelect({
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: CustomSelectProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const label =
    options.find((option) => option.value === value)?.label ?? value;
  return (
    <>
      <Box
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={placeholder}
        onClick={(event) => !disabled && setAnchorEl(event.currentTarget)}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setAnchorEl(event.currentTarget as HTMLElement);
          }
        }}
        sx={{
          backgroundColor: disabled
            ? "rgba(230,218,194,.62)"
            : "rgba(246,230,195,.85)",
          border: "1px solid rgba(200,160,100,.4)",
          borderRadius: "12px",
          px: "14px",
          py: "10px",
          minHeight: 44,
          fontSize: ".9rem",
          color: value ? "#3d2008" : "#b08060",
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          outline: "none",
          "&:focus-visible": { outline: "3px solid #1f5e78", outlineOffset: 2 },
        }}
      >
        <ChevronDown size={16} color="#8B5E3C" />
        <span style={{ textAlign: "right", flex: 1 }}>
          {label || placeholder}
        </span>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: "12px",
              backgroundColor: "rgba(246,230,195,.97)",
              minWidth: 140,
            },
          },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setAnchorEl(null);
            }}
            sx={{
              justifyContent: "flex-end",
              direction: "rtl",
              "&.Mui-selected": {
                backgroundColor: "rgba(139,94,60,.15)",
                fontWeight: 700,
              },
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

const sectionCardSx = {
  backgroundColor: "rgba(240,210,155,.65)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  borderRadius: "18px",
  p: 2,
  border: "1px solid rgba(255,255,255,.25)",
  boxShadow: "0 4px 18px rgba(0,0,0,.1)",
};
const inputSx = {
  backgroundColor: "rgba(246,230,195,.85)",
  border: "1px solid rgba(200,160,100,.4)",
  borderRadius: "12px",
  padding: "10px 14px",
  fontFamily: "Heebo, sans-serif",
  fontSize: ".9rem",
  color: "#3d2008",
  outline: "none",
  width: "100%",
  direction: "rtl" as const,
  minHeight: 44,
  "&:focus-visible": { outline: "3px solid #1f5e78", outlineOffset: 2 },
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "אירעה שגיאה. נסה שוב.";
}

function BackgroundScreen({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <Box
        dir="rtl"
        sx={{
          width: "100vw",
          height: "100dvh",
          position: "relative",
          backgroundImage: "url(/desert-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
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
              "linear-gradient(to bottom, rgba(0,0,0,.25), transparent 50%)",
            pointerEvents: "none",
          }}
        />
        {children}
      </Box>
    </ThemeProvider>
  );
}

export interface PackingUnitPageProps {
  onBack: () => void;
  initialDraft?: PackingDraft | null;
  onComplete: (response: PackingSuccessResponse, draft: PackingDraft) => void;
}

const EMPTY_DRAFT: PackingDraft = {
  orgScopeId: "",
  unit: "",
  anaf: "",
  mador: "",
  team: "",
  roomId: "",
  sourceDescription: "",
  destinationMode: "new",
  destinationId: "",
  destinationDescription: "",
  building: "",
  floor: "",
  destinationRoom: "",
};

export default function PackingUnitPage({
  onBack,
  initialDraft,
  onComplete,
}: PackingUnitPageProps) {
  const [context, setContext] = useState<AppContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [source, setSource] = useState<PackingDraft>({
    ...EMPTY_DRAFT,
    ...initialDraft,
  });
  const [rooms, setRooms] = useState<SourceRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [sourceRoom, setSourceRoom] = useState<SourceRoomDetails | null>(null);
  const [sourceRoomError, setSourceRoomError] = useState("");
  const [roomLoading, setRoomLoading] = useState(false);
  const [items, setItems] = useState<EligibleItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [packingType, setPackingType] = useState<PackingUnitType | "">("");
  const [description, setDescription] = useState("");
  const [descriptionEdited, setDescriptionEdited] = useState(false);
  const [destinationMode, setDestinationMode] = useState<"existing" | "new">(
    initialDraft?.destinationMode ?? "new",
  );
  const [destinationSearch, setDestinationSearch] = useState(
    initialDraft?.destinationId ?? "",
  );
  const [destinationResults, setDestinationResults] = useState<Destination[]>(
    [],
  );
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState("");
  const [selectedDestination, setSelectedDestination] =
    useState<Destination | null>(
      initialDraft?.destinationMode === "existing" && initialDraft.destinationId
        ? {
            id: initialDraft.destinationId,
            description: initialDraft.destinationDescription,
          }
        : null,
    );
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const roomVersion = useRef(0);
  const destinationVersion = useRef(0);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;
    packingApi
      .getContext()
      .then((value) => {
        if (!active) return;
        setContext(value);
        const scope = value.scopes.find(
          (candidate) => candidate.id === initialDraft?.orgScopeId,
        );
        if (scope)
          setSource((current) => ({
            ...current,
            unit: scopeCode(scope, "unit"),
            anaf: scopeCode(scope, "anaf"),
            mador: scopeCode(scope, "mador"),
            team: scopeCode(scope, "team"),
          }));
      })
      .catch((reason: unknown) => {
        if (active) setContextError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [initialDraft?.orgScopeId]);

  const scopes = context?.scopes ?? [];
  const unitOptions = scopeOptions(scopes, "unit");
  const unitScopes = scopes.filter(
    (scope) => scopeCode(scope, "unit") === source.unit,
  );
  const anafOptions = scopeOptions(unitScopes, "anaf");
  const anafScopes = unitScopes.filter(
    (scope) => scopeCode(scope, "anaf") === source.anaf,
  );
  const madorOptions = scopeOptions(anafScopes, "mador");
  const madorScopes = anafScopes.filter(
    (scope) => scopeCode(scope, "mador") === source.mador,
  );
  const teamOptions = scopeOptions(madorScopes, "team");
  const selectedScope = scopes.find((scope) => scope.id === source.orgScopeId);
  const isPersonal = packingType === "personal_carton";

  const groupedItems = useMemo(() => {
    const groups = new Map<string, EligibleItem[]>();
    for (const item of items)
      groups.set(item.description, [
        ...(groups.get(item.description) ?? []),
        item,
      ]);
    return [...groups];
  }, [items]);

  const generatedDescription = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const item of items)
      if (selected[item.id])
        quantities.set(
          item.description,
          (quantities.get(item.description) ?? 0) + selected[item.id],
        );
    return [...quantities]
      .map(([name, quantity]) => `${name} × ${quantity}`)
      .join(", ");
  }, [items, selected]);

  useEffect(() => {
    if (!descriptionEdited && !isPersonal) setDescription(generatedDescription);
  }, [descriptionEdited, generatedDescription, isPersonal]);

  useEffect(() => {
    if (!source.orgScopeId) {
      setRooms([]);
      return;
    }
    let active = true;
    setRoomsLoading(true);
    packingApi
      .getSourceRooms(source.orgScopeId)
      .then((value) => {
        if (active) setRooms(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [source.orgScopeId]);

  useEffect(() => {
    const version = ++roomVersion.current;
    setSourceRoom(null);
    setSourceRoomError("");
    setItems([]);
    if (!source.orgScopeId || !source.roomId.trim()) {
      setRoomLoading(false);
      setItemsLoading(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setRoomLoading(true);
      setItemsLoading(true);
      Promise.all([
        packingApi.getSourceRoom(source.orgScopeId, source.roomId.trim()),
        packingApi.getEligibleItems(source.orgScopeId, source.roomId.trim()),
      ])
        .then(([room, eligibleItems]) => {
          if (version !== roomVersion.current) return;
          setSourceRoom(room);
          setSource((current) => ({
            ...current,
            sourceDescription: room.description ?? "",
          }));
          setItems(eligibleItems);
          setExpandedGroups(
            Object.fromEntries(
              eligibleItems.map((item) => [item.description, true]),
            ),
          );
        })
        .catch((reason: unknown) => {
          if (version !== roomVersion.current) return;
          setSourceRoomError(
            reason instanceof ApiError && reason.status === 404
              ? "החדר לא קיים"
              : "לא ניתן לטעון כרגע את נתוני החדר",
          );
        })
        .finally(() => {
          if (version === roomVersion.current) {
            setRoomLoading(false);
            setItemsLoading(false);
          }
        });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [source.orgScopeId, source.roomId]);

  useEffect(() => {
    const version = ++destinationVersion.current;
    if (
      destinationMode !== "existing" ||
      !source.orgScopeId ||
      !destinationSearch.trim()
    ) {
      setDestinationResults([]);
      setDestinationLoading(false);
      setDestinationError("");
      return;
    }
    const timeout = window.setTimeout(() => {
      setDestinationLoading(true);
      setDestinationError("");
      packingApi
        .searchDestinations(
          source.orgScopeId,
          destinationSearch.trim(),
          source.roomId.trim() || undefined,
        )
        .then((value) => {
          if (version === destinationVersion.current)
            setDestinationResults(value);
        })
        .catch(() => {
          if (version === destinationVersion.current)
            setDestinationError("לא ניתן לטעון יעדים כרגע");
        })
        .finally(() => {
          if (version === destinationVersion.current)
            setDestinationLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [destinationMode, destinationSearch, source.orgScopeId, source.roomId]);

  const clearOperational = () => {
    setSelected({});
    setItems([]);
    setSourceRoom(null);
    setSourceRoomError("");
    setError("");
    setDescription("");
    setDescriptionEdited(false);
  };
  const clearExistingDestinationForScopeChange = () => {
    if (destinationMode !== "existing") return;
    setSelectedDestination(null);
    setDestinationSearch("");
    setDestinationResults([]);
    setDestinationError("");
  };
  const selectUnit = (unit: string) => {
    clearOperational();
    clearExistingDestinationForScopeChange();
    setSource((current) => ({
      ...current,
      unit,
      anaf: "",
      mador: "",
      team: "",
      orgScopeId: "",
      roomId: "",
      sourceDescription: "",
    }));
  };
  const selectAnaf = (anaf: string) => {
    clearOperational();
    clearExistingDestinationForScopeChange();
    setSource((current) => ({
      ...current,
      anaf,
      mador: "",
      team: "",
      orgScopeId: "",
      roomId: "",
      sourceDescription: "",
    }));
  };
  const selectMador = (mador: string) => {
    clearOperational();
    clearExistingDestinationForScopeChange();
    const matches = anafScopes.filter(
      (scope) => scopeCode(scope, "mador") === mador,
    );
    const scope = matches.find((candidate) => !scopeCode(candidate, "team"));
    setSource((current) => ({
      ...current,
      mador,
      team: "",
      orgScopeId: scope?.id ?? "",
      roomId: "",
      sourceDescription: "",
    }));
  };
  const selectTeam = (team: string) => {
    clearOperational();
    clearExistingDestinationForScopeChange();
    const scope = madorScopes.find(
      (candidate) => scopeCode(candidate, "team") === team,
    );
    setSource((current) => ({
      ...current,
      team,
      orgScopeId: scope?.id ?? "",
      roomId: "",
      sourceDescription: "",
    }));
  };
  const selectRoom = (roomId: string) => {
    clearOperational();
    setSource((current) => ({ ...current, roomId, sourceDescription: "" }));
  };
  const toggleType = (value: PackingUnitType) => {
    setPackingType(value);
    setError("");
    if (value === "personal_carton") {
      setSelected({});
      setDescription("");
      setDescriptionEdited(false);
    }
  };
  const toggleItem = (item: EligibleItem, checked: boolean) =>
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[item.id] = current[item.id] ?? item.quantity;
      else delete next[item.id];
      return next;
    });
  const toggleGroup = (group: EligibleItem[], checked: boolean) =>
    setSelected((current) => {
      const next = { ...current };
      for (const item of group) {
        if (checked) next[item.id] = current[item.id] ?? item.quantity;
        else delete next[item.id];
      }
      return next;
    });
  const updateQuantity = (
    item: EligibleItem,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const quantity = Number(event.target.value);
    setSelected((current) => ({
      ...current,
      [item.id]: Number.isFinite(quantity)
        ? Math.min(item.quantity, Math.max(1, Math.floor(quantity)))
        : 1,
    }));
  };
  const changeDestinationMode = (mode: "existing" | "new") => {
    setDestinationMode(mode);
    setDestinationError("");
    setError("");
    setSelectedDestination(null);
    setDestinationResults([]);
    if (mode === "existing") setDestinationSearch("");
    else
      setSource((current) => ({
        ...current,
        destinationId: "",
        destinationDescription: "",
        building: "",
        floor: "",
        destinationRoom: "",
      }));
  };

  const destinationIsValid =
    destinationMode === "existing"
      ? Boolean(selectedDestination)
      : Boolean(
          source.destinationId.trim() &&
          source.destinationDescription.trim() &&
          source.building.trim() &&
          source.floor.trim() &&
          source.destinationRoom.trim(),
        );
  const canSubmit = Boolean(
    selectedScope &&
    sourceRoom &&
    packingType &&
    description.trim() &&
    destinationIsValid &&
    (isPersonal ||
      (sourceRoom.mappingStatus.completed && Object.keys(selected).length)),
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!selectedScope || !sourceRoom || !packingType || !destinationIsValid) {
      setError("יש להשלים את מקור האריזה, סוג האריזה והיעד.");
      setToastOpen(true);
      return;
    }
    if (!description.trim()) {
      setError(
        isPersonal
          ? "יש להזין פירוט עבור קרטון אישי"
          : "יש להזין פירוט יחידת אריזה",
      );
      setToastOpen(true);
      return;
    }
    if (!isPersonal && !sourceRoom.mappingStatus.completed) {
      setError("יש לסיים את המיפוי לפני אריזה שאינה אישית.");
      setToastOpen(true);
      return;
    }
    const selectedItems = Object.entries(selected).map(
      ([itemId, quantity]) => ({ itemId, quantity }),
    );
    if (!isPersonal && !selectedItems.length) {
      setError("יש לבחור לפחות פריט אחד לאריזה");
      setToastOpen(true);
      return;
    }

    const destination: CreatePackingUnitRequest["destination"] =
      destinationMode === "existing"
        ? { mode: "existing", destinationId: selectedDestination!.id }
        : {
            mode: "new",
            destinationId: source.destinationId.trim(),
            description: source.destinationDescription.trim(),
            building: source.building.trim(),
            floor: source.floor.trim(),
            room: source.destinationRoom.trim(),
          };
    const draft: PackingDraft = {
      ...source,
      destinationMode,
      destinationId:
        destinationMode === "existing"
          ? selectedDestination!.id
          : source.destinationId.trim(),
      destinationDescription:
        destinationMode === "existing"
          ? selectedDestination!.description
          : source.destinationDescription.trim(),
    };

    setSubmitLoading(true);
    try {
      const response = await packingApi.createPackingUnit({
        idempotencyKey: idempotencyKey.current,
        orgScopeId: selectedScope.id,
        description: description.trim(),
        packingUnitType: packingType,
        sourceRoomId: source.roomId.trim(),
        destination,
        items: isPersonal ? [] : selectedItems,
      });
      onComplete(response, draft);
    } catch (reason: unknown) {
      const message =
        reason instanceof ApiError &&
        reason.status === 409 &&
        /יעד|destination/i.test(reason.message)
          ? "יעד עם מזהה זה כבר קיים"
          : errorMessage(reason);
      setError(message);
      setToastOpen(true);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!context)
    return (
      <BackgroundScreen>
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            m: "auto",
            px: 3,
            textAlign: "center",
            color: "white",
          }}
        >
          <Typography role={contextError ? "alert" : "status"}>
            {contextError || "טוען נתוני אריזה…"}
          </Typography>
          <Button onClick={onBack} sx={{ mt: 2, color: "white" }}>
            חזרה
          </Button>
        </Box>
      </BackgroundScreen>
    );

  return (
    <ThemeProvider theme={theme}>
      <Box
        dir="rtl"
        sx={{
          width: "100vw",
          height: "100dvh",
          position: "relative",
          backgroundImage: "url(/desert-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
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
              "linear-gradient(to bottom, rgba(0,0,0,.25), transparent 50%)",
            pointerEvents: "none",
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
            sx={{ position: "absolute", right: "4vw", color: "white" }}
          >
            <ChevronRight size={28} strokeWidth={2.5} />
          </IconButton>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: "1.6rem",
              color: "white",
              textShadow: "0 2px 8px rgba(0,0,0,.45)",
            }}
          >
            יחידת אריזה
          </Typography>
        </Box>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              px: "5vw",
              pt: 1,
              pb: 2,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
            }}
          >
            <Box sx={sectionCardSx}>
              <SectionLabel>מאיפה אורזים?</SectionLabel>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <CustomSelect
                    value={source.unit}
                    placeholder="בחר יחידה"
                    options={unitOptions}
                    onChange={selectUnit}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <CustomSelect
                    value={source.anaf}
                    placeholder="בחר ענף"
                    options={anafOptions}
                    disabled={!source.unit}
                    onChange={selectAnaf}
                  />
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <CustomSelect
                    value={source.mador}
                    placeholder="בחר מדור"
                    options={madorOptions}
                    disabled={!source.anaf}
                    onChange={selectMador}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <CustomSelect
                    value={source.team}
                    placeholder="בחר צוות"
                    options={teamOptions}
                    disabled={!source.mador || !teamOptions.length}
                    onChange={selectTeam}
                  />
                </Box>
              </Box>
              <Box
                component="input"
                list="source-rooms"
                value={source.roomId}
                disabled={!source.orgScopeId}
                placeholder={
                  roomsLoading ? "טוען חדרים…" : "בחר או הזן חדר מקור"
                }
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  selectRoom(event.target.value)
                }
                sx={{ ...inputSx, opacity: source.orgScopeId ? 1 : 0.65 }}
              />
              <datalist id="source-rooms">
                {rooms.map((room) => (
                  <option key={room.roomId} value={room.roomId}>
                    {room.description ?? undefined}
                  </option>
                ))}
              </datalist>
              {roomLoading && (
                <Typography
                  sx={{ mt: 1, color: "#72583f", fontSize: ".85rem" }}
                  role="status"
                >
                  טוען פרטי חדר…
                </Typography>
              )}
              {sourceRoom && (
                <Box
                  sx={{
                    mt: 1,
                    color: "#72583f",
                    fontSize: ".84rem",
                    display: "grid",
                  }}
                >
                  <strong>{sourceRoom.id}</strong>
                  <span>{sourceRoom.description || "לא הוגדר"}</span>
                </Box>
              )}
              {sourceRoomError && (
                <Typography
                  sx={{
                    mt: 1,
                    color: "#9e1e22",
                    fontSize: ".88rem",
                    fontWeight: 700,
                  }}
                  role="alert"
                >
                  {sourceRoomError}
                </Typography>
              )}
              {!roomLoading &&
                sourceRoom &&
                !sourceRoom.mappingStatus.completed && (
                  <Typography
                    sx={{
                      mt: 1,
                      color: "#9e1e22",
                      fontSize: ".9rem",
                      fontWeight: 700,
                    }}
                    role="alert"
                  >
                    *יש לסיים את המיפוי
                    {isPersonal && (
                      <span> · קרטון אישי ניתן ליצור ללא מיפוי</span>
                    )}
                  </Typography>
                )}
            </Box>

            <Box sx={sectionCardSx}>
              <SectionLabel>בחר סוג אריזה</SectionLabel>
              <Box
                sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
                role="radiogroup"
                aria-label="סוג אריזה"
              >
                {TYPE_OPTIONS.map((option) => {
                  const active = packingType === option.value;
                  return (
                    <Box
                      key={option.value}
                      role="radio"
                      aria-checked={active}
                      tabIndex={0}
                      onClick={() => toggleType(option.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ")
                          toggleType(option.value);
                      }}
                      sx={{
                        px: 2,
                        py: "6px",
                        borderRadius: "999px",
                        backgroundColor: active
                          ? "#8B5E3C"
                          : "rgba(246,230,195,.85)",
                        color: active ? "white" : "#6e4e37",
                        fontWeight: active ? 700 : 500,
                        fontSize: ".85rem",
                        cursor: "pointer",
                        border: "1px solid rgba(200,160,100,.4)",
                        "&:focus-visible": {
                          outline: "3px solid #1f5e78",
                          outlineOffset: 2,
                        },
                      }}
                    >
                      {option.label}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {isPersonal ? (
              <Box sx={{ ...sectionCardSx, py: 1.5 }}>
                <Typography
                  sx={{
                    color: "#6e4e37",
                    fontSize: ".88rem",
                    textAlign: "center",
                  }}
                >
                  קרטון אישי אינו כולל פריטים. יש להזין פירוט ולשמור את היחידה.
                </Typography>
              </Box>
            ) : (
              <Box sx={sectionCardSx}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <SectionLabel>בחר פריטים לארוז</SectionLabel>
                  <Typography sx={{ color: "#80644b", fontSize: ".78rem" }}>
                    {itemsLoading
                      ? "טוען…"
                      : `${Object.keys(selected).length} נבחרו`}
                  </Typography>
                </Box>
                {!source.roomId && (
                  <Typography sx={{ color: "#72583f", fontSize: ".85rem" }}>
                    בחר חדר מקור כדי לטעון פריטים זמינים.
                  </Typography>
                )}
                {!itemsLoading && sourceRoom && !items.length && (
                  <Typography sx={{ color: "#72583f", fontSize: ".85rem" }}>
                    אין פריטים זמינים בחדר שנבחר.
                  </Typography>
                )}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {groupedItems.map(([groupName, group]) => {
                    const selectedCount = group.filter(
                      (item) => item.id in selected,
                    ).length;
                    const expanded = expandedGroups[groupName] ?? true;
                    return (
                      <Box key={groupName}>
                        <Box
                          onClick={() =>
                            setExpandedGroups((current) => ({
                              ...current,
                              [groupName]: !expanded,
                            }))
                          }
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: "rgba(246,230,195,.85)",
                            borderRadius: expanded ? "12px 12px 0 0" : "12px",
                            px: 1.5,
                            py: 1,
                            cursor: "pointer",
                            border: "1px solid rgba(200,160,100,.3)",
                          }}
                        >
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            {expanded ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                            <Typography
                              sx={{ fontSize: ".85rem", color: "#6e4e37" }}
                            >
                              כמות:{" "}
                              {group.reduce(
                                (sum, item) => sum + item.quantity,
                                0,
                              )}
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <strong>{groupName}</strong>
                            <Checkbox
                              size="small"
                              checked={selectedCount === group.length}
                              indeterminate={
                                selectedCount > 0 &&
                                selectedCount < group.length
                              }
                              onChange={(event) =>
                                toggleGroup(group, event.target.checked)
                              }
                              onClick={(event) => event.stopPropagation()}
                              sx={{ p: 0, color: "#8B5E3C" }}
                            />
                          </Box>
                        </Box>
                        {expanded && (
                          <Box
                            sx={{
                              backgroundColor: "rgba(250,238,210,.75)",
                              borderRadius: "0 0 12px 12px",
                              border: "1px solid rgba(200,160,100,.3)",
                              borderTop: 0,
                            }}
                          >
                            {group.map((item, index) => (
                              <Box
                                key={item.id}
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 1,
                                  px: 1.5,
                                  py: 1,
                                  borderBottom:
                                    index < group.length - 1
                                      ? "1px solid rgba(200,160,100,.2)"
                                      : 0,
                                }}
                              >
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    minWidth: 0,
                                  }}
                                >
                                  <Checkbox
                                    size="small"
                                    checked={item.id in selected}
                                    onChange={(event) =>
                                      toggleItem(item, event.target.checked)
                                    }
                                    sx={{ p: 0, mr: 0.5, color: "#8B5E3C" }}
                                  />
                                  <Typography
                                    sx={{
                                      fontSize: ".8rem",
                                      color: "#6e4e37",
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {item.description}{" "}
                                    <small>({item.id})</small>
                                  </Typography>
                                </Box>
                                {item.id in selected && (
                                  <Box
                                    component="input"
                                    type="number"
                                    min={1}
                                    max={item.quantity}
                                    value={selected[item.id]}
                                    aria-label={`כמות ${item.description}`}
                                    onChange={(
                                      event: ChangeEvent<HTMLInputElement>,
                                    ) => updateQuantity(item, event)}
                                    sx={{
                                      ...inputSx,
                                      width: 70,
                                      minHeight: 34,
                                      p: "5px 7px",
                                    }}
                                  />
                                )}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            <Box sx={sectionCardSx}>
              <SectionLabel>פירוט יחידת אריזה</SectionLabel>
              <Box
                component="textarea"
                value={description}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setDescription(event.target.value);
                  setDescriptionEdited(true);
                }}
                placeholder={
                  isPersonal
                    ? "פירוט עבור קרטון אישי"
                    : "הפירוט מתעדכן לפי הפריטים שנבחרו"
                }
                rows={4}
                sx={{
                  ...inputSx,
                  minHeight: 106,
                  resize: "vertical",
                  display: "block",
                }}
              />
              {!isPersonal && !descriptionEdited && generatedDescription && (
                <Typography
                  sx={{ mt: 0.75, color: "#80644b", fontSize: ".76rem" }}
                >
                  הפירוט נוצר אוטומטית מהפריטים שנבחרו; אפשר לערוך אותו.
                </Typography>
              )}
            </Box>

            <Box sx={sectionCardSx}>
              <SectionLabel>לאן שולחים?</SectionLabel>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 0.75,
                  mb: 1.5,
                  p: 0.4,
                  borderRadius: "999px",
                  backgroundColor: "rgba(246,230,195,.7)",
                }}
                role="radiogroup"
              >
                {(["existing", "new"] as const).map((mode) => (
                  <Box
                    key={mode}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={destinationMode === mode}
                    onClick={() => changeDestinationMode(mode)}
                    sx={{
                      minHeight: 40,
                      border: 0,
                      borderRadius: "999px",
                      color: destinationMode === mode ? "white" : "#6e4e37",
                      backgroundColor:
                        destinationMode === mode ? "#8B5E3C" : "transparent",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {mode === "existing" ? "יעד קיים" : "יעד חדש"}
                  </Box>
                ))}
              </Box>
              {destinationMode === "existing" ? (
                <Box sx={{ display: "grid", gap: 1 }}>
                  <Box
                    component="input"
                    value={destinationSearch}
                    disabled={!source.orgScopeId}
                    placeholder="חיפוש לפי מזהה או תיאור יעד"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setDestinationSearch(event.target.value);
                      setSelectedDestination(null);
                    }}
                    sx={{ ...inputSx, opacity: source.orgScopeId ? 1 : 0.65 }}
                  />
                  {destinationLoading && (
                    <Typography role="status">טוען יעדים…</Typography>
                  )}
                  {destinationError && (
                    <Typography color="error" role="alert">
                      {destinationError}
                    </Typography>
                  )}
                  {!destinationLoading &&
                    !destinationError &&
                    destinationSearch.trim() &&
                    !destinationResults.length && (
                      <Typography sx={{ color: "#72583f", fontSize: ".85rem" }}>
                        לא נמצאו יעדים
                      </Typography>
                    )}
                  {!!destinationResults.length && (
                    <Box
                      role="listbox"
                      sx={{
                        maxHeight: 230,
                        overflowY: "auto",
                        border: "1px solid rgba(200,160,100,.35)",
                        borderRadius: "12px",
                      }}
                    >
                      {destinationResults.map((destination) => (
                        <Box
                          key={destination.id}
                          component="button"
                          type="button"
                          role="option"
                          aria-selected={
                            selectedDestination?.id === destination.id
                          }
                          onClick={() => {
                            setSelectedDestination(destination);
                            setDestinationSearch(destination.id);
                            setSource((current) => ({
                              ...current,
                              destinationId: destination.id,
                              destinationDescription: destination.description,
                            }));
                          }}
                          sx={{
                            display: "block",
                            width: "100%",
                            border: 0,
                            borderBottom: "1px solid rgba(200,160,100,.22)",
                            px: 1.5,
                            py: 1.25,
                            textAlign: "right",
                            color: "#3d2008",
                            backgroundColor:
                              selectedDestination?.id === destination.id
                                ? "rgba(139,94,60,.16)"
                                : "rgba(250,238,210,.72)",
                            cursor: "pointer",
                          }}
                        >
                          <strong>
                            {destination.id} — {destination.description}
                          </strong>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {selectedDestination && (
                    <Typography sx={{ color: "#72583f", fontSize: ".84rem" }}>
                      <strong>{selectedDestination.id}</strong> —{" "}
                      {selectedDestination.description}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box sx={{ display: "grid", gap: 1 }}>
                  <Box
                    component="input"
                    value={source.destinationId}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setSource((current) => ({
                        ...current,
                        destinationId: event.target.value,
                      }))
                    }
                    placeholder="מזהה יעד"
                    aria-label="מזהה יעד"
                    sx={inputSx}
                  />
                  <Box
                    component="textarea"
                    value={source.destinationDescription}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      setSource((current) => ({
                        ...current,
                        destinationDescription: event.target.value,
                      }))
                    }
                    placeholder="תיאור היעד"
                    aria-label="תיאור היעד"
                    rows={3}
                    sx={{ ...inputSx, resize: "vertical" }}
                  />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                      component="input"
                      value={source.building}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setSource((current) => ({
                          ...current,
                          building: event.target.value,
                        }))
                      }
                      placeholder="בניין"
                      aria-label="בניין יעד"
                      sx={inputSx}
                    />
                    <Box
                      component="input"
                      value={source.floor}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setSource((current) => ({
                          ...current,
                          floor: event.target.value,
                        }))
                      }
                      placeholder="קומה"
                      aria-label="קומת יעד"
                      sx={inputSx}
                    />
                  </Box>
                  <Box
                    component="input"
                    value={source.destinationRoom}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setSource((current) => ({
                        ...current,
                        destinationRoom: event.target.value,
                      }))
                    }
                    placeholder="חדר יעד"
                    aria-label="חדר יעד"
                    sx={inputSx}
                  />
                </Box>
              )}
            </Box>
            {error && (
              <Typography
                sx={{
                  color: "#9e1e22",
                  fontSize: ".9rem",
                  fontWeight: 700,
                  px: 1,
                }}
                role="alert"
              >
                {error}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              px: "5vw",
              pt: 1.5,
              pb: "max(env(safe-area-inset-bottom), 20px)",
            }}
          >
            <Box
              component="button"
              type="submit"
              disabled={submitLoading || roomLoading}
              sx={{
                width: "100%",
                py: "14px",
                border: 0,
                borderRadius: "999px",
                backgroundColor: canSubmit ? "#8B5E3C" : "rgba(139,94,60,.4)",
                color: canSubmit ? "white" : "rgba(255,255,255,.6)",
                fontWeight: 700,
                fontSize: "1.05rem",
                cursor: submitLoading || roomLoading ? "wait" : "pointer",
              }}
            >
              {submitLoading ? "שומר יחידת אריזה…" : "סיום אריזה"}
            </Box>
          </Box>
        </Box>
        <Snackbar
          open={toastOpen}
          autoHideDuration={2500}
          onClose={() => setToastOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          message={error}
        />
      </Box>
    </ThemeProvider>
  );
}

export function PackingSuccessScreen({
  response,
  onContinue,
  onHome,
}: {
  response: PackingSuccessResponse;
  onContinue: () => void;
  onHome: () => void;
}) {
  const typeLabel =
    TYPE_OPTIONS.find((option) => option.value === response.packingUnit.type)
      ?.label ?? "יחידת אריזה";
  const sourceLabel =
    [
      response.source.unit,
      response.source.anaf,
      response.source.mador,
      response.source.team,
      response.source.roomDisplayName ?? response.source.roomId,
    ]
      .filter(Boolean)
      .join(" · ") || "לא הוגדר";
  const destinationLocation = [
    response.destination.building,
    response.destination.floor,
    response.destination.room,
  ]
    .filter(Boolean)
    .join(" · ");
  const destinationLabel =
    [response.destination.id, destinationLocation]
      .filter(Boolean)
      .join(" — ") || "לא הוגדר";
  const statusLabel =
    packingUnitStatusLabels[response.packingUnit.status] ??
    response.packingUnit.status;
  const personLabel = (
    person: { name: string; phone: string | null } | null,
  ) =>
    person
      ? `${person.name}${person.phone ? ` · ${person.phone}` : ""}`
      : "לא הוגדר";
  const details = [
    ["נשלח מ:", sourceLabel],
    ["תיאור מקור:", response.source.description || "לא הוגדר"],
    ["נשלח אל:", destinationLabel],
    ["תיאור יעד:", response.destination.description || "לא הוגדר"],
    ["אחראי מדור:", personLabel(response.responsiblePeople.mador)],
    ["אחראי חדר:", personLabel(response.responsiblePeople.room)],
    ["אורז:", response.responsiblePeople.packer.displayName],
    ["פריטים:", String(response.packingUnit.itemCount)],
  ];
  return (
    <BackgroundScreen>
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "grid",
          placeItems: "center",
          px: "5vw",
          py: 3,
        }}
      >
        <Box
          sx={{
            ...sectionCardSx,
            width: "min(700px, 100%)",
            p: { xs: 2.5, sm: 4 },
            color: "#3d2008",
          }}
        >
          <Typography
            sx={{ color: "#8b5e3c", textAlign: "center", fontWeight: 800 }}
          >
            {typeLabel}
          </Typography>
          <Typography
            component="h1"
            sx={{
              mb: 2.5,
              textAlign: "center",
              fontSize: "clamp(1.55rem, 5vw, 2.2rem)",
              fontWeight: 800,
            }}
          >
            יחידת אריזה הושלמה!
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 0.5,
              mb: 2,
              p: 2,
              borderRadius: "16px",
              color: "white",
              textAlign: "center",
              backgroundColor: "#8b5e3c",
            }}
          >
            <small>מס׳ אריזה</small>
            <Typography
              sx={{ fontSize: "2rem", letterSpacing: ".14em", fontWeight: 800 }}
            >
              {response.packingUnit.displaySerial ?? "לא הוגדר"}
            </Typography>
            <small>{statusLabel}</small>
          </Box>
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: "14px",
              backgroundColor: "rgba(255,247,228,.65)",
            }}
          >
            {response.packingUnit.description}
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 1.5,
            }}
          >
            {details.map(([label, value]) => (
              <Box
                key={label}
                sx={{
                  display: "grid",
                  gap: 0.3,
                  pb: 1,
                  borderBottom: "1px solid rgba(141,95,52,.22)",
                }}
              >
                <Typography sx={{ color: "#80644b", fontSize: ".82rem" }}>
                  {label}
                </Typography>
                <Typography
                  sx={{ overflowWrap: "anywhere", fontSize: ".92rem" }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              mt: 2.5,
              pt: 2,
              borderTop: "1px solid rgba(141,95,52,.25)",
              textAlign: "center",
            }}
          >
            <strong>האם להמשיך באריזה?</strong>
            <Box
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}
            >
              <Box
                component="button"
                type="button"
                onClick={onContinue}
                sx={{
                  minHeight: 48,
                  border: 0,
                  borderRadius: "999px",
                  color: "white",
                  backgroundColor: "#8b5e3c",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                כן
              </Box>
              <Box
                component="button"
                type="button"
                onClick={onHome}
                sx={{
                  minHeight: 48,
                  border: 0,
                  borderRadius: "999px",
                  color: "#5b3519",
                  backgroundColor: "rgba(255,247,228,.86)",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                לא
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </BackgroundScreen>
  );
}
