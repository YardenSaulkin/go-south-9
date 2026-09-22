import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Box, Button, Checkbox, Collapse, createTheme, IconButton, Menu, MenuItem, Snackbar, ThemeProvider, Typography } from '@mui/material'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { api, type AppContext, type CreatePackingUnitRequest, type EligibleItem, type PackingSuccessResponse, type RoomMappingStatus, type SourceRoom } from '../api'
import { packingUnitStatusLabels } from '../statusLabels'

const theme = createTheme({ direction: 'rtl', typography: { fontFamily: 'Heebo, sans-serif' } })

const TYPE_OPTIONS: Array<{ value: CreatePackingUnitRequest['packingUnitType']; label: string }> = [
  { value: 'professional_carton', label: 'קרטון מקצועי' },
  { value: 'personal_carton', label: 'קרטון אישי' },
  { value: 'pallet', label: 'משטח' },
  { value: 'dolav', label: 'דולב' },
  { value: 'bulk', label: 'תפזורת' },
]

export interface PackingDraft {
  orgScopeId: string
  unit: string
  anaf: string
  mador: string
  roomId: string
  sourceDescription: string
  building: string
  floor: string
  destinationRoom: string
  destinationDescription: string
}

interface CustomSelectProps { value: string; placeholder: string; options: string[]; disabled?: boolean; onChange: (value: string) => void }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#3d2008', textAlign: 'right', mb: 1 }}>{children}</Typography>
}

function CustomSelect({ value, placeholder, options, disabled, onChange }: CustomSelectProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  return <>
    <Box role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={placeholder} onClick={(event) => !disabled && setAnchorEl(event.currentTarget)} onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) setAnchorEl(event.currentTarget as HTMLElement) }} sx={{ backgroundColor: disabled ? 'rgba(230, 218, 194, 0.62)' : 'rgba(246, 230, 195, 0.85)', border: '1px solid rgba(200, 160, 100, 0.4)', borderRadius: '12px', px: '14px', py: '10px', minHeight: 44, fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', color: value ? '#3d2008' : '#b08060', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', WebkitTapHighlightColor: 'transparent', outline: 'none', '&:focus-visible': { outline: '3px solid #1f5e78', outlineOffset: 2 } }}>
      <ChevronDown size={16} color="#8B5E3C" style={{ flexShrink: 0 }} /><span style={{ textAlign: 'right', flex: 1 }}>{value || placeholder}</span>
    </Box>
    <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { mt: '4px', borderRadius: '12px', backgroundColor: 'rgba(246, 230, 195, 0.97)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid rgba(200, 160, 100, 0.4)', minWidth: 140, overflow: 'hidden' } } }}>
      {options.map((option) => <MenuItem key={option} onClick={() => { onChange(option); setAnchorEl(null) }} selected={option === value} sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', color: '#3d2008', justifyContent: 'flex-end', direction: 'rtl', py: '10px', px: '16px', '&.Mui-selected': { backgroundColor: 'rgba(139, 94, 60, 0.15)', fontWeight: 700 }, '&:hover': { backgroundColor: 'rgba(139, 94, 60, 0.1)' } }}>{option}</MenuItem>)}
    </Menu>
  </>
}

const sectionCardSx = { backgroundColor: 'rgba(240, 210, 155, 0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: '18px', p: 2, border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 18px rgba(0,0,0,0.1)' }
const inputSx = { backgroundColor: 'rgba(246, 230, 195, 0.85)', border: '1px solid rgba(200, 160, 100, 0.4)', borderRadius: '12px', padding: '10px 14px', fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', color: '#3d2008', outline: 'none', width: '100%', direction: 'rtl' as const, minHeight: 44, '&:focus-visible': { outline: '3px solid #1f5e78', outlineOffset: 2 } }

function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'אירעה שגיאה. נסה שוב.' }
function unique(values: Array<string | null>) { return [...new Set(values.filter((value): value is string => Boolean(value)))] }

function BackgroundScreen({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}><Box dir="rtl" sx={{ width: '100vw', height: '100dvh', position: 'relative', backgroundImage: 'url(/desert-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}><Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 25%, transparent 50%)', pointerEvents: 'none', zIndex: 0 }} />{children}</Box></ThemeProvider>
}

export interface PackingUnitPageProps { onBack: () => void; initialDraft?: PackingDraft | null; onComplete: (response: PackingSuccessResponse, draft: PackingDraft) => void }

export default function PackingUnitPage({ onBack, initialDraft, onComplete }: PackingUnitPageProps) {
  const [context, setContext] = useState<AppContext | null>(null)
  const [contextError, setContextError] = useState('')
  const [source, setSource] = useState<PackingDraft>({ orgScopeId: initialDraft?.orgScopeId ?? '', unit: initialDraft?.unit ?? '', anaf: initialDraft?.anaf ?? '', mador: initialDraft?.mador ?? '', roomId: initialDraft?.roomId ?? '', sourceDescription: initialDraft?.sourceDescription ?? '', building: initialDraft?.building ?? '', floor: initialDraft?.floor ?? '', destinationRoom: initialDraft?.destinationRoom ?? '', destinationDescription: initialDraft?.destinationDescription ?? '' })
  const [rooms, setRooms] = useState<SourceRoom[]>([])
  const [items, setItems] = useState<EligibleItem[]>([])
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [packingType, setPackingType] = useState<CreatePackingUnitRequest['packingUnitType'] | ''>('')
  const [mapping, setMapping] = useState<RoomMappingStatus | null>(null)
  const [mappingLoading, setMappingLoading] = useState(false)
  const [mappingError, setMappingError] = useState('')
  const [itemsLoading, setItemsLoading] = useState(false)
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [sourceRoom, setSourceRoom] = useState<SourceRoomDetails | null>(null)
  const [sourceRoomError, setSourceRoomError] = useState('')
  const [destinationMode, setDestinationMode] = useState<'existing' | 'new'>(initialDraft?.destinationMode ?? 'new')
  const [destinationSearch, setDestinationSearch] = useState(initialDraft?.destinationCode ?? '')
  const [destinationResults, setDestinationResults] = useState<Destination[]>([])
  const [destinationLoading, setDestinationLoading] = useState(false)
  const [destinationError, setDestinationError] = useState('')
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(initialDraft?.destinationId ? {
    id: initialDraft.destinationId,
    destinationCode: initialDraft.destinationCode,
    description: initialDraft.destinationDescription,
    building: initialDraft.building,
    floor: initialDraft.floor,
    room: initialDraft.destinationRoom,
  } : null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [descriptionEdited, setDescriptionEdited] = useState(false)
  const [sourceDescriptionOpen, setSourceDescriptionOpen] = useState(Boolean(initialDraft?.sourceDescription))
  const [destinationDescriptionOpen, setDestinationDescriptionOpen] = useState(Boolean(initialDraft?.destinationDescription))
  const requestVersion = useRef(0)

  useEffect(() => { let active = true; api.getContext().then((value) => { if (active) setContext(value) }).catch((reason: unknown) => { if (active) setContextError(errorMessage(reason)) }); return () => { active = false } }, [])

  const userId = authenticatedUserId
  const scopes = context?.scopes ?? []
  const unitOptions = scopeOptions(scopes, 'unit')
  const anafOptions = scopeOptions(scopes.filter((scope) => scopeValue(scope, 'unit') === source.unit), 'anaf')
  const madorOptions = scopeOptions(scopes.filter((scope) => scopeValue(scope, 'unit') === source.unit && scopeValue(scope, 'anaf') === source.anaf), 'mador')
  const teamOptions = scopeOptions(scopes.filter((scope) => scopeValue(scope, 'unit') === source.unit && scopeValue(scope, 'anaf') === source.anaf && scopeValue(scope, 'mador') === source.mador), 'team')
  const selectedScope = scopes.find((scope) => scope.id === source.orgScopeId)
  const isPersonal = packingType === 'personal_carton'
  const canSubmitVisual = Boolean(source.orgScopeId && source.roomId && packingType && description.trim() && source.building && source.floor && source.destinationRoom && (isPersonal || (mapping?.completed && Object.keys(selected).length > 0)))
  const groupedItems = useMemo(() => { const groups = new Map<string, EligibleItem[]>(); for (const item of items) groups.set(item.description, [...(groups.get(item.description) ?? []), item]); return [...groups.entries()] }, [items])
  const generatedDescription = useMemo(() => items.filter((item) => item.id in selected).map((item) => `${item.description} (${selected[item.id]})`).join(', '), [items, selected])

  useEffect(() => { if (!descriptionEdited && !isPersonal) setDescription(generatedDescription) }, [descriptionEdited, generatedDescription, isPersonal])
  useEffect(() => { if (!userId || !source.orgScopeId) return; let active = true; setRoomsLoading(true); api.getSourceRooms(userId, source.orgScopeId).then((value) => { if (active) setRooms(value) }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setRoomsLoading(false) }); return () => { active = false } }, [source.orgScopeId, userId])
  useEffect(() => {
    const version = ++requestVersion.current
    if (!userId || !source.orgScopeId || !source.roomId) { setMapping(null); setMappingError(''); setItems([]); setMappingLoading(false); setItemsLoading(false); return }
    setMappingLoading(true); setItemsLoading(true); setMappingError('')
    Promise.all([api.getMappingStatus(userId, source.orgScopeId, source.roomId), api.getEligibleItems(userId, source.orgScopeId, source.roomId)]).then(([mappingResult, itemsResult]) => { if (version !== requestVersion.current) return; setMapping(mappingResult); setItems(itemsResult); setExpandedGroups((value) => ({ ...value, ...Object.fromEntries(itemsResult.map((item) => [item.description, value[item.description] ?? true])) })) }).catch((reason: unknown) => { if (version !== requestVersion.current) return; setMappingError(errorMessage(reason)); setError(errorMessage(reason)) }).finally(() => { if (version === requestVersion.current) { setMappingLoading(false); setItemsLoading(false) } })
  }, [source.orgScopeId, source.roomId, userId])

  const clearOperationalSelection = () => { setSelected({}); setItems([]); setMapping(null); setMappingError(''); setError(''); setDescription(''); setDescriptionEdited(false) }
  const selectUnit = (unit: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, unit, anaf: '', mador: '', orgScopeId: '', roomId: '' })) }
  const selectAnaf = (anaf: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, anaf, mador: '', orgScopeId: '', roomId: '' })) }
  const selectMador = (mador: string) => { clearOperationalSelection(); const scope = scopes.find((value) => value.unit === source.unit && value.anaf === source.anaf && value.mador === mador); setSource((value) => ({ ...value, mador, orgScopeId: scope?.id ?? '', roomId: '' })) }
  const selectRoom = (roomId: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, roomId })) }
  const toggleType = (value: CreatePackingUnitRequest['packingUnitType']) => { setPackingType(value); setError(''); if (value === 'personal_carton') { setSelected({}); setDescription(''); setDescriptionEdited(false) } }
  const toggleItem = (item: EligibleItem, checked: boolean) => setSelected((value) => { const next = { ...value }; if (checked) next[item.id] = value[item.id] ?? item.quantity; else delete next[item.id]; return next })
  const toggleGroup = (group: EligibleItem[], checked: boolean) => setSelected((value) => { const next = { ...value }; for (const item of group) { if (checked) next[item.id] = value[item.id] ?? item.quantity; else delete next[item.id] } return next })
  const updateQuantity = (item: EligibleItem, event: ChangeEvent<HTMLInputElement>) => { const quantity = Number(event.target.value); setSelected((value) => ({ ...value, [item.id]: Number.isFinite(quantity) ? Math.min(item.quantity, Math.max(1, Math.floor(quantity))) : 1 })) }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!userId || !selectedScope || !source.roomId || !packingType || !source.building || !source.floor || !source.destinationRoom) { setError('יש להשלים את מקור האריזה, סוג האריזה והיעד.'); setToastOpen(true); return }
    if (!description.trim()) { setError(isPersonal ? 'יש להזין פירוט עבור קרטון אישי' : 'יש להזין פירוט יחידת אריזה'); setToastOpen(true); return }
    if (!isPersonal && mappingError) { setError('לא ניתן לבדוק את המיפוי. נסה שוב.'); return }
    if (!isPersonal && (!mapping || !mapping.completed)) { setError('יש לסיים את המיפוי לפני אריזה שאינה אישית.'); return }
    const selectedItems = Object.entries(selected).map(([itemId, quantity]) => ({ itemId, quantity }))
    if (!isPersonal && selectedItems.length === 0) { setError('יש לבחור לפחות פריט אחד לאריזה'); setToastOpen(true); return }
    const draft = { ...source, sourceDescription: source.sourceDescription.trim(), destinationDescription: source.destinationDescription.trim() }
    setSubmitLoading(true)
    try { const response = await api.createPackingUnit(userId, { idempotencyKey: crypto.randomUUID(), orgScopeId: selectedScope.id, description: description.trim(), packingUnitType: packingType, sourceRoomId: source.roomId, sourceDescription: source.sourceDescription.trim() || undefined, destination: { building: source.building, floor: source.floor, room: source.destinationRoom, roomId: source.destinationRoom, description: source.destinationDescription.trim() || undefined }, items: isPersonal ? [] : selectedItems }); onComplete(response, draft) } catch (reason: unknown) { setError(errorMessage(reason)); setToastOpen(true) } finally { setSubmitLoading(false) }
  }

  if (!context) return <BackgroundScreen><Box sx={{ position: 'relative', zIndex: 1, m: 'auto', px: 3, textAlign: 'center', color: 'white' }}><Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '1.1rem' }} role={contextError ? 'alert' : 'status'}>{contextError || 'טוען נתוני אריזה…'}</Typography><Button onClick={onBack} sx={{ mt: 2, color: 'white', fontFamily: 'Heebo, sans-serif' }}>חזרה</Button></Box></BackgroundScreen>

  return <ThemeProvider theme={theme}><Box dir="rtl" sx={{ width: '100vw', height: '100dvh', position: 'relative', backgroundImage: 'url(/desert-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 25%, transparent 50%)', pointerEvents: 'none', zIndex: 0 }} />
    <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', pt: '5vh', pb: '1.5vh', px: '5vw', flexShrink: 0 }}><IconButton onClick={onBack} aria-label="חזרה" sx={{ position: 'absolute', right: '4vw', color: 'white', p: 0.5 }}><ChevronRight size={28} strokeWidth={2.5} /></IconButton><Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: '1.6rem', color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.45)', letterSpacing: 0.5 }}>יחידת אריזה</Typography></Box>
    <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: '5vw', pt: 1, pb: 2, display: 'flex', flexDirection: 'column', gap: 2, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
        <Box sx={sectionCardSx}><SectionLabel>מאיפה אורזים?</SectionLabel><Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}><Box sx={{ flex: 1 }}><CustomSelect value={source.unit} placeholder="בחר יחידה" options={unitOptions} onChange={selectUnit} /></Box><Box sx={{ flex: 1 }}><CustomSelect value={source.anaf} placeholder="בחר ענף" options={anafOptions} disabled={!source.unit} onChange={selectAnaf} /></Box></Box><Box sx={{ display: 'flex', gap: 1 }}><Box sx={{ flex: 1 }}><CustomSelect value={source.mador} placeholder="בחר מדור" options={madorOptions} disabled={!source.anaf} onChange={selectMador} /></Box><Box sx={{ flex: 1 }}><Box component="input" list="source-rooms" value={source.roomId} disabled={!source.orgScopeId} placeholder={roomsLoading ? 'טוען חדרים…' : 'בחר חדר'} onChange={(event: ChangeEvent<HTMLInputElement>) => selectRoom(event.target.value)} sx={{ ...inputSx, opacity: source.orgScopeId ? 1 : 0.65 }} /><datalist id="source-rooms">{rooms.map((room) => <option key={room.roomId} value={room.roomId} />)}</datalist></Box></Box>{mappingLoading && <Typography sx={{ mt: 1, color: '#72583f', fontSize: '0.85rem' }} role="status">בודק את מצב המיפוי…</Typography>}{!mappingLoading && mapping && !mapping.completed && <Typography sx={{ mt: 1, color: '#9e1e22', fontSize: '0.9rem', fontWeight: 700 }} role="alert">*יש לסיים את המיפוי{isPersonal && <span> · קרטון אישי ניתן ליצור ללא מיפוי</span>}</Typography>}{mappingError && <Typography sx={{ mt: 1, color: '#9e1e22', fontSize: '0.85rem' }} role="alert">שגיאה בבדיקת המיפוי: {mappingError}</Typography>}<Button type="button" onClick={() => setSourceDescriptionOpen((value) => !value)} endIcon={sourceDescriptionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} sx={{ mt: 1, p: 0, color: '#6e4e37', fontFamily: 'Heebo, sans-serif', fontSize: '0.78rem', '&:hover': { background: 'transparent' } }}>פירוט מקור נוסף</Button><Collapse in={sourceDescriptionOpen}><Box component="textarea" value={source.sourceDescription} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setSource((value) => ({ ...value, sourceDescription: event.target.value }))} placeholder="פירוט חופשי על מקור האריזה" rows={3} sx={{ ...inputSx, display: 'block', mt: 1, resize: 'vertical' }} /></Collapse></Box>

        <Box sx={sectionCardSx}><SectionLabel>בחר סוג אריזה</SectionLabel><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }} role="radiogroup" aria-label="סוג אריזה">{TYPE_OPTIONS.map((option) => { const selectedType = packingType === option.value; return <Box key={option.value} role="radio" aria-checked={selectedType} tabIndex={0} onClick={() => toggleType(option.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') toggleType(option.value) }} sx={{ px: 2, py: '6px', borderRadius: '999px', backgroundColor: selectedType ? '#8B5E3C' : 'rgba(246, 230, 195, 0.85)', color: selectedType ? 'white' : '#6e4e37', fontFamily: 'Heebo, sans-serif', fontWeight: selectedType ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', border: selectedType ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(200, 160, 100, 0.4)', boxShadow: selectedType ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', transition: 'all 0.15s ease', WebkitTapHighlightColor: 'transparent', '&:focus-visible': { outline: '3px solid #1f5e78', outlineOffset: 2 } }}>{option.label}</Box> })}</Box></Box>

        <Box sx={sectionCardSx}><SectionLabel>פירוט יחידת אריזה</SectionLabel><Box component="textarea" value={description} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setDescription(event.target.value); setDescriptionEdited(true) }} placeholder={isPersonal ? 'פירוט עבור קרטון אישי' : 'הפירוט מתעדכן לפי הפריטים שנבחרו'} rows={4} aria-label="פירוט יחידת אריזה" sx={{ ...inputSx, minHeight: 106, resize: 'vertical', display: 'block' }} />{!isPersonal && !descriptionEdited && generatedDescription && <Typography sx={{ mt: 0.75, color: '#80644b', fontSize: '0.76rem' }}>הפירוט נוצר אוטומטית מהפריטים שנבחרו; אפשר לערוך אותו.</Typography>}</Box>

        {isPersonal ? <Box sx={{ ...sectionCardSx, py: 1.5 }}><Typography sx={{ color: '#6e4e37', fontSize: '0.88rem', textAlign: 'center' }}>קרטון אישי אינו כולל פריטים. יש להזין פירוט ולשמור את היחידה.</Typography></Box> : <Box sx={sectionCardSx}><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><SectionLabel>בחר פריטים לארוז</SectionLabel><Typography sx={{ color: '#80644b', fontSize: '0.78rem', mb: 1 }}>{itemsLoading ? 'טוען…' : `${Object.keys(selected).length} נבחרו`}</Typography></Box>{!source.roomId && <Typography sx={{ color: '#72583f', fontSize: '0.85rem' }}>בחר חדר מקור כדי לטעון פריטים זמינים.</Typography>}{!itemsLoading && source.roomId && items.length === 0 && <Typography sx={{ color: '#72583f', fontSize: '0.85rem' }}>אין פריטים זמינים בחדר שנבחר.</Typography>}<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{groupedItems.map(([groupName, group]) => { const selectedCount = group.filter((item) => item.id in selected).length; const expanded = expandedGroups[groupName] ?? true; return <Box key={groupName}><Box onClick={() => setExpandedGroups((value) => ({ ...value, [groupName]: !expanded }))} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(246, 230, 195, 0.85)', borderRadius: expanded ? '12px 12px 0 0' : '12px', px: 1.5, py: 1, cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', border: '1px solid rgba(200, 160, 100, 0.3)' }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{expanded ? <ChevronUp size={18} color="#8B5E3C" /> : <ChevronDown size={18} color="#8B5E3C" />}<Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.85rem', color: '#6e4e37', fontWeight: 500 }}>כמות: {group.reduce((sum, item) => sum + item.quantity, 0)}</Typography></Box><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: '#3d2008' }}>{groupName}</Typography><Checkbox size="small" checked={selectedCount === group.length} indeterminate={selectedCount > 0 && selectedCount < group.length} onChange={(event) => toggleGroup(group, event.target.checked)} onClick={(event) => event.stopPropagation()} sx={{ p: 0, color: '#8B5E3C', '&.Mui-checked': { color: '#8B5E3C' }, '&.MuiCheckbox-indeterminate': { color: '#8B5E3C' } }} /></Box></Box>{expanded && <Box sx={{ backgroundColor: 'rgba(250, 238, 210, 0.75)', borderRadius: '0 0 12px 12px', border: '1px solid rgba(200, 160, 100, 0.3)', borderTop: 'none', overflow: 'hidden' }}>{group.map((item, index) => <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.5, py: '8px', borderBottom: index < group.length - 1 ? '1px solid rgba(200, 160, 100, 0.2)' : 'none' }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}><Checkbox size="small" checked={item.id in selected} onChange={(event) => toggleItem(item, event.target.checked)} sx={{ p: 0, color: '#8B5E3C', '&.Mui-checked': { color: '#8B5E3C' } }} /><Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.8rem', color: '#6e4e37', overflowWrap: 'anywhere' }}>{item.description} <Typography component="span" sx={{ color: '#967c63', fontSize: '0.7rem' }}>({item.id})</Typography></Typography></Box>{item.id in selected && <Box component="input" type="number" min={1} max={item.quantity} value={selected[item.id]} aria-label={`כמות ${item.description}`} onChange={(event: ChangeEvent<HTMLInputElement>) => updateQuantity(item, event)} sx={{ ...inputSx, width: 70, minHeight: 34, padding: '5px 7px', flexShrink: 0 }} />}</Box>)}</Box>}</Box> })}</Box></Box>}

        <Box sx={sectionCardSx}><SectionLabel>לאן שולחים?</SectionLabel><Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}><Box sx={{ flex: 1 }}><Box component="input" value={source.building} onChange={(event: ChangeEvent<HTMLInputElement>) => setSource((value) => ({ ...value, building: event.target.value }))} placeholder="בניין" sx={inputSx} /></Box><Box sx={{ flex: 1 }}><Box component="input" value={source.floor} onChange={(event: ChangeEvent<HTMLInputElement>) => setSource((value) => ({ ...value, floor: event.target.value }))} placeholder="קומה" sx={inputSx} /></Box></Box><Box component="input" value={source.destinationRoom} onChange={(event: ChangeEvent<HTMLInputElement>) => setSource((value) => ({ ...value, destinationRoom: event.target.value }))} placeholder="חדר יעד" sx={inputSx} /><Button type="button" onClick={() => setDestinationDescriptionOpen((value) => !value)} endIcon={destinationDescriptionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} sx={{ mt: 1, p: 0, color: '#6e4e37', fontFamily: 'Heebo, sans-serif', fontSize: '0.78rem', '&:hover': { background: 'transparent' } }}>פירוט יעד נוסף</Button><Collapse in={destinationDescriptionOpen}><Box component="textarea" value={source.destinationDescription} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setSource((value) => ({ ...value, destinationDescription: event.target.value }))} placeholder="פירוט חופשי על יעד האריזה" rows={3} sx={{ ...inputSx, display: 'block', mt: 1, resize: 'vertical' }} /></Collapse></Box>
        {error && <Typography sx={{ color: '#9e1e22', fontSize: '0.9rem', fontWeight: 700, px: 1 }} role="alert">{error}</Typography>}
      </Box>
      <Box sx={{ position: 'relative', zIndex: 2, flexShrink: 0, px: '5vw', pt: 1.5, pb: 'max(env(safe-area-inset-bottom), 20px)', backgroundColor: 'transparent' }}><Box component="button" type="submit" disabled={submitLoading || mappingLoading} sx={{ width: '100%', py: '14px', border: 0, borderRadius: '999px', backgroundColor: canSubmitVisual ? '#8B5E3C' : 'rgba(139, 94, 60, 0.4)', color: canSubmitVisual ? 'white' : 'rgba(255,255,255,0.6)', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: '1.05rem', textAlign: 'center', cursor: submitLoading || mappingLoading ? 'wait' : canSubmitVisual ? 'pointer' : 'default', boxShadow: canSubmitVisual ? '0 4px 16px rgba(0,0,0,0.25)' : 'none', letterSpacing: 0.5, WebkitTapHighlightColor: 'transparent', userSelect: 'none', transition: 'all 0.2s ease', '&:active': { transform: 'scale(0.97)' }, '&:focus-visible': { outline: '3px solid #1f5e78', outlineOffset: 2 } }}>{submitLoading ? 'שומר יחידת אריזה…' : 'סיים אריזה'}</Box></Box>
    </Box>
    <Snackbar open={toastOpen} autoHideDuration={2500} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={error} slotProps={{ content: { sx: { backgroundColor: '#5a3010', fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', borderRadius: '12px', direction: 'rtl' } } }} />
  </Box></ThemeProvider>
}

export function PackingSuccessScreen({ response, onContinue, onHome }: { response: PackingSuccessResponse; onContinue: () => void; onHome: () => void }) {
  const typeLabel = TYPE_OPTIONS.find((option) => option.value === response.packingUnit.type)?.label ?? 'יחידת אריזה'
  const sourceLabel = [response.source.unit, response.source.anaf, response.source.mador, response.source.roomDisplayName ?? response.source.roomId].filter(Boolean).join(' · ') || 'לא הוגדר'
  const destinationLabel = [response.destination.building, response.destination.floor, response.destination.room].filter(Boolean).join(' · ') || 'לא הוגדר'
  const statusLabel = packingUnitStatusLabels[response.packingUnit.status] ?? response.packingUnit.status
  const personLabel = (person: { name: string; phone: string | null } | null) => person ? `${person.name}${person.phone ? ` · ${person.phone}` : ''}` : 'לא הוגדר'
  return <BackgroundScreen><Box sx={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', placeItems: 'center', px: '5vw', py: 3 }}><Box sx={{ ...sectionCardSx, width: 'min(700px, 100%)', p: { xs: 2.5, sm: 4 }, color: '#3d2008' }}><Typography sx={{ color: '#8b5e3c', textAlign: 'center', fontWeight: 800, fontFamily: 'Heebo, sans-serif' }}>{typeLabel}</Typography><Typography component="h1" sx={{ mt: 0.5, mb: 2.5, color: '#3d2008', textAlign: 'center', fontSize: 'clamp(1.55rem, 5vw, 2.2rem)', fontWeight: 800, fontFamily: 'Heebo, sans-serif' }}>יחידת אריזה הושלמה!</Typography><Box sx={{ display: 'grid', gap: 0.5, mb: 2.5, p: 2, borderRadius: '16px', color: 'white', textAlign: 'center', backgroundColor: '#8b5e3c' }}><Typography sx={{ fontSize: '.82rem', fontFamily: 'Heebo, sans-serif' }}>מס׳ אריזה</Typography><Typography sx={{ fontSize: '2rem', letterSpacing: '.14em', fontWeight: 800, fontFamily: 'Heebo, sans-serif' }}>{response.packingUnit.displaySerial ?? 'לא הוגדר'}</Typography><Typography sx={{ fontSize: '.78rem', fontFamily: 'Heebo, sans-serif' }}>{statusLabel}</Typography></Box><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>{[[ 'נשלח מ:', sourceLabel ], [ 'נשלח אל:', destinationLabel ], [ 'אחראי מדור:', personLabel(response.responsiblePeople.mador) ], [ 'אחראי חדר:', personLabel(response.responsiblePeople.room) ], [ 'אורז:', response.responsiblePeople.packer.displayName ], [ 'פריטים:', String(response.packingUnit.itemCount) ]].map(([label, value]) => <Box key={label} sx={{ display: 'grid', gap: .3, pb: 1, borderBottom: '1px solid rgba(141, 95, 52, .22)' }}><Typography sx={{ color: '#80644b', fontSize: '.82rem', fontFamily: 'Heebo, sans-serif' }}>{label}</Typography><Typography sx={{ color: '#3d2008', fontSize: '.92rem', overflowWrap: 'anywhere', fontFamily: 'Heebo, sans-serif' }}>{value}</Typography></Box>)}</Box><Box sx={{ display: 'grid', gap: 1.5, mt: 2.5, pt: 2, borderTop: '1px solid rgba(141, 95, 52, .25)', textAlign: 'center' }}><Typography sx={{ fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>האם להמשיך באריזה?</Typography><Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}><Box component="button" type="button" onClick={onContinue} sx={{ minHeight: 48, border: 0, borderRadius: '999px', color: 'white', backgroundColor: '#8b5e3c', font: 'inherit', fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', '&:focus-visible': { outline: '3px solid #1f5e78', outlineOffset: 2 } }}>כן</Box><Box component="button" type="button" onClick={onHome} sx={{ minHeight: 48, border: 0, borderRadius: '999px', color: '#5b3519', backgroundColor: 'rgba(255, 247, 228, .86)', font: 'inherit', fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', '&:focus-visible': { outline: '3px solid #1f5e78', outlineOffset: 2 } }}>לא</Box></Box></Box></Box></Box></BackgroundScreen>
}
