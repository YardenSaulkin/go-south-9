import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api, type AppContext, type CreatePackingUnitRequest, type EligibleItem, type PackingSuccessResponse, type RoomMappingStatus, type SourceRoom } from '../api'

export interface PackingDraft {
  orgScopeId: string
  unit: string
  anaf: string
  mador: string
  roomId: string
  building: string
  floor: string
  destinationRoom: string
}

const TYPE_OPTIONS: Array<{ value: CreatePackingUnitRequest['packingUnitType']; label: string }> = [
  { value: 'professional_carton', label: 'קרטון מקצועי' },
  { value: 'personal_carton', label: 'קרטון אישי' },
  { value: 'pallet', label: 'משטח' },
  { value: 'dolav', label: 'דולב' },
  { value: 'bulk', label: 'תפזורת' },
]

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'אירעה שגיאה. נסה שוב.'
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function GroupCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return <input ref={ref} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label="בחירת כל הפריטים בקבוצה" />
}

function ScopeSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: string[]; disabled?: boolean; onChange: (value: string) => void }) {
  return <label className="packing-field"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">בחר {label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

export default function PackingUnitPage({ onBack, initialDraft, onComplete }: { onBack: () => void; initialDraft?: PackingDraft | null; onComplete: (response: PackingSuccessResponse, draft: PackingDraft) => void }) {
  const [context, setContext] = useState<AppContext | null>(null)
  const [contextError, setContextError] = useState('')
  const [source, setSource] = useState<PackingDraft>({
    orgScopeId: initialDraft?.orgScopeId ?? '',
    unit: initialDraft?.unit ?? '',
    anaf: initialDraft?.anaf ?? '',
    mador: initialDraft?.mador ?? '',
    roomId: initialDraft?.roomId ?? '',
    building: initialDraft?.building ?? '',
    floor: initialDraft?.floor ?? '',
    destinationRoom: initialDraft?.destinationRoom ?? '',
  })
  const [rooms, setRooms] = useState<SourceRoom[]>([])
  const [items, setItems] = useState<EligibleItem[]>([])
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [packingType, setPackingType] = useState<CreatePackingUnitRequest['packingUnitType'] | ''>('')
  const [mapping, setMapping] = useState<RoomMappingStatus | null>(null)
  const [mappingLoading, setMappingLoading] = useState(false)
  const [mappingError, setMappingError] = useState('')
  const [itemsLoading, setItemsLoading] = useState(false)
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)

  useEffect(() => {
    let active = true
    api.getContext().then((value) => { if (active) setContext(value) }).catch((reason: unknown) => { if (active) setContextError(errorMessage(reason)) })
    return () => { active = false }
  }, [])

  const userId = context?.users[0]?.id ?? ''
  const scopes = context?.scopes ?? []
  const unitOptions = unique(scopes.map((scope) => scope.unit))
  const anafOptions = unique(scopes.filter((scope) => scope.unit === source.unit).map((scope) => scope.anaf))
  const madorOptions = unique(scopes.filter((scope) => scope.unit === source.unit && scope.anaf === source.anaf).map((scope) => scope.mador))
  const selectedScope = scopes.find((scope) => scope.id === source.orgScopeId)
  const isPersonal = packingType === 'personal_carton'
  const groupedItems = useMemo(() => {
    const groups = new Map<string, EligibleItem[]>()
    for (const item of items) groups.set(item.description, [...(groups.get(item.description) ?? []), item])
    return [...groups.entries()]
  }, [items])

  useEffect(() => {
    if (!userId || !source.orgScopeId) {
      return
    }
    let active = true
    setRoomsLoading(true)
    api.getSourceRooms(userId, source.orgScopeId).then((value) => { if (active) setRooms(value) }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setRoomsLoading(false) })
    return () => { active = false }
  }, [source.orgScopeId, userId])

  useEffect(() => {
    const version = ++requestVersion.current
    if (!userId || !source.orgScopeId || !source.roomId) return
    setMappingLoading(true)
    setItemsLoading(true)
    Promise.all([api.getMappingStatus(userId, source.orgScopeId, source.roomId), api.getEligibleItems(userId, source.orgScopeId, source.roomId)]).then(([mappingResult, itemsResult]) => {
      if (version !== requestVersion.current) return
      setMapping(mappingResult)
      setItems(itemsResult)
    }).catch((reason: unknown) => {
      if (version !== requestVersion.current) return
      setMappingError(errorMessage(reason))
      setError(errorMessage(reason))
    }).finally(() => {
      if (version === requestVersion.current) {
        setMappingLoading(false)
        setItemsLoading(false)
      }
    })
  }, [source.orgScopeId, source.roomId, userId])

  const clearOperationalSelection = () => {
    setSelected({})
    setItems([])
    setMapping(null)
    setMappingError('')
    setError('')
  }

  const selectUnit = (unit: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, unit, anaf: '', mador: '', orgScopeId: '', roomId: '' })) }
  const selectAnaf = (anaf: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, anaf, mador: '', orgScopeId: '', roomId: '' })) }
  const selectMador = (mador: string) => {
    clearOperationalSelection()
    const scope = scopes.find((value) => value.unit === source.unit && value.anaf === source.anaf && value.mador === mador)
    setSource((value) => ({ ...value, mador, orgScopeId: scope?.id ?? '', roomId: '' }))
  }
  const selectRoom = (roomId: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, roomId })) }
  const toggleType = (value: CreatePackingUnitRequest['packingUnitType']) => { setPackingType(value); setError(''); if (value === 'personal_carton') setSelected({}) }

  const toggleItem = (item: EligibleItem, checked: boolean) => {
    setSelected((value) => {
      const next = { ...value }
      if (checked) next[item.id] = value[item.id] ?? item.quantity
      else delete next[item.id]
      return next
    })
  }

  const toggleGroup = (group: EligibleItem[], checked: boolean) => {
    setSelected((value) => {
      const next = { ...value }
      for (const item of group) {
        if (checked) next[item.id] = value[item.id] ?? item.quantity
        else delete next[item.id]
      }
      return next
    })
  }

  const updateQuantity = (item: EligibleItem, event: ChangeEvent<HTMLInputElement>) => {
    const quantity = Number(event.target.value)
    setSelected((value) => ({ ...value, [item.id]: Number.isFinite(quantity) ? Math.min(item.quantity, Math.max(1, quantity)) : 1 }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!userId || !selectedScope || !source.roomId || !packingType || !source.building || !source.floor || !source.destinationRoom) {
      setError('יש להשלים את מקור האריזה, סוג האריזה והיעד.')
      return
    }
    if (!isPersonal && mappingError) { setError('לא ניתן לבדוק את המיפוי. נסה שוב.'); return }
    if (!isPersonal && (!mapping || !mapping.completed)) { setError('יש לסיים את המיפוי לפני אריזה שאינה אישית.'); return }
    const selectedItems = Object.entries(selected).map(([itemId, quantity]) => ({ itemId, quantity }))
    if (!isPersonal && selectedItems.length === 0) { setError('יש לבחור לפחות פריט אחד לאריזה'); return }
    const draft = { ...source }
    setSubmitLoading(true)
    try {
      const response = await api.createPackingUnit(userId, {
        idempotencyKey: crypto.randomUUID(),
        orgScopeId: selectedScope.id,
        description: `${TYPE_OPTIONS.find((option) => option.value === packingType)?.label ?? 'יחידת אריזה'} - ${source.roomId}`,
        packingUnitType: packingType,
        sourceRoomId: source.roomId,
        sourceDescription: JSON.stringify({ unit: source.unit, anaf: source.anaf, mador: source.mador, room: source.roomId }),
        destination: { building: source.building, floor: source.floor, room: source.destinationRoom },
        items: isPersonal ? [] : selectedItems,
      })
      onComplete(response, draft)
    } catch (reason: unknown) { setError(errorMessage(reason)) } finally { setSubmitLoading(false) }
  }

  if (contextError) return <main className="packing-shell"><p className="packing-error" role="alert">{contextError}</p><button className="packing-secondary-button" onClick={onBack}>חזרה</button></main>
  if (!context) return <main className="packing-shell"><p className="packing-loading" role="status">טוען נתוני אריזה…</p></main>

  return <main className="packing-shell" dir="rtl">
    <header className="packing-header"><button className="packing-back" type="button" onClick={onBack} aria-label="חזרה">‹</button><h1>יחידת אריזה</h1><span aria-hidden="true" /></header>
    <form className="packing-form" onSubmit={handleSubmit}>
      <section className="packing-card" aria-labelledby="source-title"><h2 id="source-title">מאיפה אורזים?</h2><div className="packing-grid four-columns"><ScopeSelect label="יחידה" value={source.unit} options={unitOptions} onChange={selectUnit} /><ScopeSelect label="ענף" value={source.anaf} options={anafOptions} disabled={!source.unit} onChange={selectAnaf} /><ScopeSelect label="מדור" value={source.mador} options={madorOptions} disabled={!source.anaf} onChange={selectMador} /><label className="packing-field"><span>חדר</span><input list="source-rooms" value={source.roomId} disabled={!source.orgScopeId} placeholder={roomsLoading ? 'טוען חדרים…' : 'בחר או הזן חדר'} onChange={(event) => selectRoom(event.target.value)} /><datalist id="source-rooms">{rooms.map((room) => <option key={room.roomId} value={room.roomId} />)}</datalist></label></div>{mappingLoading && <p className="packing-loading" role="status">בודק את מצב המיפוי…</p>}{!mappingLoading && mapping && !mapping.completed && <p className="packing-warning" role="alert">*יש לסיים את המיפוי{isPersonal && <span> · קרטון אישי ניתן ליצור ללא מיפוי</span>}</p>}{mappingError && <p className="packing-error" role="alert">שגיאה בבדיקת המיפוי: {mappingError}</p>}</section>
      <section className="packing-card" aria-labelledby="type-title"><h2 id="type-title">בחר סוג אריזה</h2><div className="packing-type-list" role="radiogroup" aria-labelledby="type-title">{TYPE_OPTIONS.map((option) => <button key={option.value} className={`packing-type ${packingType === option.value ? 'selected' : ''}`} type="button" role="radio" aria-checked={packingType === option.value} onClick={() => toggleType(option.value)}>{option.label}</button>)}</div>{isPersonal && <p className="packing-hint">קרטון אישי אינו דורש בחירת פריטים.</p>}</section>
      {!isPersonal && <section className="packing-card" aria-labelledby="items-title"><div className="packing-section-heading"><h2 id="items-title">בחר פריטים לארוז</h2><span>{itemsLoading ? 'טוען…' : `${Object.keys(selected).length} נבחרו`}</span></div>{!source.roomId && <p className="packing-hint">בחר חדר מקור כדי לטעון פריטים זמינים.</p>}{!itemsLoading && source.roomId && items.length === 0 && <p className="packing-hint">אין פריטים זמינים בחדר שנבחר.</p>}<div className="packing-groups">{groupedItems.map(([groupName, group]) => { const selectedCount = group.filter((item) => item.id in selected).length; return <div className="packing-group" key={groupName}><div className="packing-group-header"><label><GroupCheckbox checked={selectedCount === group.length} indeterminate={selectedCount > 0 && selectedCount < group.length} onChange={(checked) => toggleGroup(group, checked)} /> <strong>{groupName}</strong></label><span>כמות: {group.reduce((sum, item) => sum + item.quantity, 0)}</span></div>{group.map((item) => <div className="packing-item" key={item.id}><label><input type="checkbox" checked={item.id in selected} onChange={(event) => toggleItem(item, event.target.checked)} /><span>{item.description}<small> מזהה: {item.id}</small></span></label>{item.id in selected && <label className="quantity-field"><span>כמות</span><input type="number" min="1" max={item.quantity} value={selected[item.id]} onChange={(event) => updateQuantity(item, event)} /><small>מתוך {item.quantity}</small></label>}</div>)}</div> })}</div></section>}
      <section className="packing-card" aria-labelledby="destination-title"><h2 id="destination-title">לאן שולחים?</h2><div className="packing-grid destination-grid"><label className="packing-field"><span>בניין</span><input value={source.building} onChange={(event) => setSource((value) => ({ ...value, building: event.target.value }))} /></label><label className="packing-field"><span>קומה</span><input value={source.floor} onChange={(event) => setSource((value) => ({ ...value, floor: event.target.value }))} /></label><label className="packing-field"><span>חדר יעד</span><input value={source.destinationRoom} onChange={(event) => setSource((value) => ({ ...value, destinationRoom: event.target.value }))} /></label></div></section>
      {error && <p className="packing-error packing-form-error" role="alert">{error}</p>}<button className="packing-submit" type="submit" disabled={submitLoading || mappingLoading}>{submitLoading ? 'שומר יחידת אריזה…' : 'סיום אריזה'}</button>
    </form>
  </main>
}

export function PackingSuccessScreen({ response, onContinue, onHome }: { response: PackingSuccessResponse; onContinue: () => void; onHome: () => void }) {
  const typeLabel = TYPE_OPTIONS.find((option) => option.value === response.packingUnit.type)?.label ?? 'יחידת אריזה'
  return <main className="packing-shell success-shell" dir="rtl"><section className="success-card" aria-labelledby="success-title" tabIndex={-1}><p className="success-eyebrow">{typeLabel}</p><h1 id="success-title">יחידת אריזה הושלמה!</h1><div className="success-serial"><span>מס׳ אריזה</span><strong>{response.packingUnit.displaySerial ?? 'לא הוגדר'}</strong></div><div className="success-grid"><div><span>נשלח מ:</span><strong>{[response.source.unit, response.source.anaf, response.source.mador, response.source.room].filter(Boolean).join(' · ') || 'לא הוגדר'}</strong></div><div><span>נשלח אל:</span><strong>{[response.destination.building, response.destination.floor, response.destination.room].filter(Boolean).join(' · ') || 'לא הוגדר'}</strong></div><div><span>אחראי מדור:</span><strong>{response.responsibilities.madorResponsible}</strong></div><div><span>אחראי חדר:</span><strong>{response.responsibilities.roomResponsible}</strong></div><div><span>אורז:</span><strong>{response.responsibilities.packer}</strong></div><div><span>פריטים:</span><strong>{response.packingUnit.itemCount}</strong></div></div><div className="success-actions"><p>האם להמשיך באריזה?</p><div><button className="packing-submit" type="button" onClick={onContinue}>כן</button><button className="packing-secondary-button" type="button" onClick={onHome}>לא</button></div></div></section></main>
}
