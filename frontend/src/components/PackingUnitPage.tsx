import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError, packingApi as api, type AppContext, type CreatePackingUnitRequest, type Destination, type EligibleItem, type PackingSuccessResponse, type RoomMappingStatus, type SourceRoom, type SourceRoomDetails } from '../lib/api'

export interface PackingDraft {
  orgScopeId: string
  unit: string
  anaf: string
  mador: string
  team: string
  roomId: string
  building: string
  floor: string
  destinationRoom: string
  sourceDescription: string
  destinationDescription: string
  destinationMode: 'existing' | 'new'
  destinationId: string
  destinationCode: string
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

type HierarchyField = 'unit' | 'anaf' | 'mador' | 'team'

function scopeValue(scope: AppContext['scopes'][number], field: HierarchyField) {
  if (field === 'team' && scope.orgCode) return scope.orgCode
  const codeField = `${field}Code` as const
  return scope[codeField] ?? scope[field] ?? ''
}

function scopeOptions(scopes: AppContext['scopes'], field: HierarchyField) {
  const options = new Map<string, string>()
  for (const scope of scopes) {
    const value = scopeValue(scope, field)
    if (!value) continue
    const name = scope[field]
    options.set(value, scope.orgCode && name && name !== value ? `${value} · ${name}` : value)
  }
  return [...options].map(([value, label]) => ({ value, label }))
}

function GroupCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return <input ref={ref} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label="בחירת כל הפריטים בקבוצה" />
}

function ScopeSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; disabled?: boolean; onChange: (value: string) => void }) {
  return <label className="packing-field"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">בחר {label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

export default function PackingUnitPage({ onBack, initialDraft, authenticatedUserId, onComplete }: { onBack: () => void; initialDraft?: PackingDraft | null; authenticatedUserId: string; onComplete: (response: PackingSuccessResponse, draft: PackingDraft) => void }) {
  const [context, setContext] = useState<AppContext | null>(null)
  const [contextError, setContextError] = useState('')
  const [source, setSource] = useState<PackingDraft>({
    orgScopeId: initialDraft?.orgScopeId ?? '',
    unit: initialDraft?.unit ?? '',
    anaf: initialDraft?.anaf ?? '',
    mador: initialDraft?.mador ?? '',
    team: initialDraft?.team ?? '',
    roomId: initialDraft?.roomId ?? '',
    building: initialDraft?.building ?? '',
    floor: initialDraft?.floor ?? '',
    destinationRoom: initialDraft?.destinationRoom ?? '',
    sourceDescription: initialDraft?.sourceDescription ?? '',
    destinationDescription: initialDraft?.destinationDescription ?? '',
    destinationMode: initialDraft?.destinationMode ?? 'new',
    destinationId: initialDraft?.destinationId ?? '',
    destinationCode: initialDraft?.destinationCode ?? '',
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
  const [packingDescription, setPackingDescription] = useState('')
  const [packingDescriptionEdited, setPackingDescriptionEdited] = useState(false)
  const requestVersion = useRef(0)

  useEffect(() => {
    let active = true
    api.getContext(authenticatedUserId).then((value) => {
      if (!active) return
      setContext(value)
      setSource((current) => {
        if (!current.orgScopeId) return current
        const scope = value.scopes.find((candidate) => candidate.id === current.orgScopeId)
        if (!scope) return current
        const hierarchy = {
          unit: scopeValue(scope, 'unit'),
          anaf: scopeValue(scope, 'anaf'),
          mador: scopeValue(scope, 'mador'),
          team: scopeValue(scope, 'team'),
        }
        return current.unit === hierarchy.unit && current.anaf === hierarchy.anaf && current.mador === hierarchy.mador && current.team === hierarchy.team
          ? current
          : { ...current, ...hierarchy }
      })
    }).catch((reason: unknown) => { if (active) setContextError(errorMessage(reason)) })
    return () => { active = false }
  }, [authenticatedUserId])

  const userId = authenticatedUserId
  const scopes = context?.scopes ?? []
  const unitOptions = scopeOptions(scopes, 'unit')
  const anafOptions = scopeOptions(scopes.filter((scope) => scopeValue(scope, 'unit') === source.unit), 'anaf')
  const madorOptions = scopeOptions(scopes.filter((scope) => scopeValue(scope, 'unit') === source.unit && scopeValue(scope, 'anaf') === source.anaf), 'mador')
  const teamOptions = scopeOptions(scopes.filter((scope) => scopeValue(scope, 'unit') === source.unit && scopeValue(scope, 'anaf') === source.anaf && scopeValue(scope, 'mador') === source.mador), 'team')
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
    setSourceRoom(null)
    setSourceRoomError('')
    setMapping(null)
    setItems([])
    if (!userId || !source.orgScopeId || !source.roomId) return
    setMappingLoading(true)
    setItemsLoading(true)
    Promise.all([api.getSourceRoom(userId, source.orgScopeId, source.roomId), api.getEligibleItems(userId, source.orgScopeId, source.roomId)]).then(([roomResult, itemsResult]) => {
      if (version !== requestVersion.current) return
      setSourceRoom(roomResult)
      setMapping(roomResult.mappingStatus)
      setItems(itemsResult)
    }).catch((reason: unknown) => {
      if (version !== requestVersion.current) return
      setSourceRoomError(reason instanceof ApiError && reason.status === 404 ? 'החדר לא קיים' : 'לא ניתן לטעון כרגע את נתוני החדר')
    }).finally(() => {
      if (version === requestVersion.current) {
        setMappingLoading(false)
        setItemsLoading(false)
      }
    })
  }, [source.orgScopeId, source.roomId, userId])

  useEffect(() => {
    if (!userId || !source.orgScopeId || destinationMode !== 'existing') return
    let active = true
    const timeout = window.setTimeout(() => {
      setDestinationLoading(true)
      setDestinationError('')
      api.searchDestinations(userId, source.orgScopeId, destinationSearch).then((value) => {
        if (active) setDestinationResults(value)
      }).catch(() => {
        if (active) setDestinationError('לא ניתן לטעון יעדים כרגע')
      }).finally(() => {
        if (active) setDestinationLoading(false)
      })
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [destinationMode, destinationSearch, source.orgScopeId, userId])

  const clearOperationalSelection = () => {
    setSelected({})
    setItems([])
    setMapping(null)
    setMappingError('')
    setError('')
  }

  const selectUnit = (unit: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, unit, anaf: '', mador: '', team: '', orgScopeId: '', roomId: '' })) }
  const selectAnaf = (anaf: string) => { clearOperationalSelection(); setSource((value) => ({ ...value, anaf, mador: '', team: '', orgScopeId: '', roomId: '' })) }
  const selectMador = (mador: string) => {
    clearOperationalSelection()
    const scope = scopes.find((value) => scopeValue(value, 'unit') === source.unit && scopeValue(value, 'anaf') === source.anaf && scopeValue(value, 'mador') === mador && !scopeValue(value, 'team'))
    setSource((value) => ({ ...value, mador, team: '', orgScopeId: scope?.id ?? '', roomId: '' }))
  }
  const selectTeam = (team: string) => {
    clearOperationalSelection()
    const scope = scopes.find((value) => scopeValue(value, 'unit') === source.unit && scopeValue(value, 'anaf') === source.anaf && scopeValue(value, 'mador') === source.mador && scopeValue(value, 'team') === team)
    setSource((value) => ({ ...value, team, orgScopeId: scope?.id ?? '', roomId: '' }))
  }
  const defaultPackingDescription = (value: CreatePackingUnitRequest['packingUnitType'] | '', roomId: string) => `${TYPE_OPTIONS.find((option) => option.value === value)?.label ?? 'יחידת אריזה'} - ${roomId}`
  const selectRoom = (roomId: string) => {
    clearOperationalSelection()
    setSource((value) => ({ ...value, roomId }))
    if (!packingDescriptionEdited && packingType && packingType !== 'personal_carton') {
      setPackingDescription(defaultPackingDescription(packingType, roomId))
    }
  }
  const toggleType = (value: CreatePackingUnitRequest['packingUnitType']) => {
    setPackingType(value)
    setPackingDescriptionEdited(false)
    setPackingDescription(value === 'personal_carton' ? '' : defaultPackingDescription(value, source.roomId))
    setError('')
    if (value === 'personal_carton') setSelected({})
  }

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
    const description = packingDescription.trim() || (!isPersonal ? defaultPackingDescription(packingType, source.roomId) : '')
    const destination = destinationMode === 'existing'
      ? selectedDestination ? { mode: 'existing' as const, destinationId: selectedDestination.id } : null
      : source.destinationDescription.trim() && source.building && source.floor && source.destinationRoom
        ? { mode: 'new' as const, description: source.destinationDescription.trim(), building: source.building, floor: source.floor, room: source.destinationRoom }
        : null
    if (!userId || !selectedScope || !source.roomId || !packingType || !sourceRoom || !destination) {
      setError('יש להשלים את מקור האריזה, סוג האריזה והיעד.')
      return
    }
    if (!description) {
      setError('יש להזין פירוט יחידת האריזה.')
      return
    }
    if (!isPersonal && mappingError) { setError('לא ניתן לבדוק את המיפוי. נסה שוב.'); return }
    if (!isPersonal && (!mapping || !mapping.completed)) { setError('יש לסיים את המיפוי לפני אריזה שאינה אישית.'); return }
    const selectedItems = Object.entries(selected).map(([itemId, quantity]) => ({ itemId, quantity }))
    if (!isPersonal && selectedItems.length === 0) { setError('יש לבחור לפחות פריט אחד לאריזה'); return }
    const draft = {
      ...source,
      destinationMode,
      destinationId: selectedDestination?.id ?? '',
      destinationCode: selectedDestination?.destinationCode ?? '',
    }
    setSubmitLoading(true)
    try {
      const response = await api.createPackingUnit(userId, {
        idempotencyKey: crypto.randomUUID(),
        orgScopeId: selectedScope.id,
        description,
        packingUnitType: packingType,
        sourceRoomId: source.roomId,
        destination,
        items: isPersonal ? [] : selectedItems,
      })
      onComplete(response, draft)
    } catch (reason: unknown) { setError(errorMessage(reason)) } finally { setSubmitLoading(false) }
  }

  if (contextError) return <main className="packing-shell"><p className="packing-error" role="alert">{contextError}</p><button className="packing-secondary-button" onClick={onBack}>חזרה</button></main>
  if (!context) return <main className="packing-shell"><p className="packing-loading" role="status">טוען נתוני אריזה…</p></main>

  return <main className="packing-shell" dir="rtl">
    <header className="packing-header">
      <button className="packing-back" type="button" onClick={onBack} aria-label="חזרה">‹</button>
      <h1>יחידת אריזה</h1>
      <span aria-hidden="true" />
    </header>
    <form className="packing-form" onSubmit={handleSubmit}>
      <section className="packing-card" aria-labelledby="source-title">
        <h2 id="source-title">מאיפה אורזים?</h2>
        <div className="packing-grid four-columns">
          <ScopeSelect label="יחידה" value={source.unit} options={unitOptions} onChange={selectUnit} />
          <ScopeSelect label="ענף" value={source.anaf} options={anafOptions} disabled={!source.unit} onChange={selectAnaf} />
          <ScopeSelect label="מדור" value={source.mador} options={madorOptions} disabled={!source.anaf} onChange={selectMador} />
          <ScopeSelect label="צוות" value={source.team} options={teamOptions} disabled={!source.mador || teamOptions.length === 0} onChange={selectTeam} />
          <label className="packing-field">
            <span>חדר</span>
            <input list="source-rooms" value={source.roomId} disabled={!source.orgScopeId} placeholder={roomsLoading ? 'טוען חדרים…' : 'בחר או הזן חדר'} onChange={(event) => selectRoom(event.target.value)} />
            <datalist id="source-rooms">{rooms.map((room) => <option key={room.roomId} value={room.roomId}>{room.description ?? undefined}</option>)}</datalist>
          </label>
        </div>
        {mappingLoading && <p className="packing-loading" role="status">טוען פרטי חדר…</p>}
        {sourceRoom && <p className="packing-room-description"><strong>{sourceRoom.id}</strong>{sourceRoom.description && <span>{sourceRoom.description}</span>}</p>}
        {sourceRoomError && <p className="packing-error" role="alert">{sourceRoomError}</p>}
        {!mappingLoading && !sourceRoomError && mapping && !mapping.completed && <p className="packing-warning" role="alert">*יש לסיים את המיפוי{isPersonal && <span> · קרטון אישי ניתן ליצור ללא מיפוי</span>}</p>}
      </section>

      <section className="packing-card" aria-labelledby="type-title">
        <h2 id="type-title">בחר סוג אריזה</h2>
        <div className="packing-type-list" role="radiogroup" aria-labelledby="type-title">
          {TYPE_OPTIONS.map((option) => <button key={option.value} className={`packing-type ${packingType === option.value ? 'selected' : ''}`} type="button" role="radio" aria-checked={packingType === option.value} onClick={() => toggleType(option.value)}>{option.label}</button>)}
        </div>
        {isPersonal && <p className="packing-hint">קרטון אישי אינו דורש בחירת פריטים.</p>}
      </section>

      {!isPersonal && <section className="packing-card" aria-labelledby="items-title">
        <div className="packing-section-heading"><h2 id="items-title">בחר פריטים לארוז</h2><span>{itemsLoading ? 'טוען…' : `${Object.keys(selected).length} נבחרו`}</span></div>
        {!source.roomId && <p className="packing-hint">בחר חדר מקור כדי לטעון פריטים זמינים.</p>}
        {!itemsLoading && source.roomId && items.length === 0 && <p className="packing-hint">אין פריטים זמינים בחדר שנבחר.</p>}
        <div className="packing-groups">
          {groupedItems.map(([groupName, group]) => {
            const selectedCount = group.filter((item) => item.id in selected).length
            return <div className="packing-group" key={groupName}>
              <div className="packing-group-header">
                <label><GroupCheckbox checked={selectedCount === group.length} indeterminate={selectedCount > 0 && selectedCount < group.length} onChange={(checked) => toggleGroup(group, checked)} /> <strong>{groupName}</strong></label>
                <span>כמות: {group.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              {group.map((item) => <div className="packing-item" key={item.id}>
                <label><input type="checkbox" checked={item.id in selected} onChange={(event) => toggleItem(item, event.target.checked)} /><span>{item.description}<small> מזהה: {item.id}</small></span></label>
                {item.id in selected && <label className="quantity-field"><span>כמות</span><input type="number" min="1" max={item.quantity} value={selected[item.id]} onChange={(event) => updateQuantity(item, event)} /><small>מתוך {item.quantity}</small></label>}
              </div>)}
            </div>
          })}
        </div>
      </section>}

      <section className="packing-card" aria-labelledby="description-title">
        <h2 id="description-title">פירוט יחידת האריזה</h2>
        <label className="packing-field">
          <span>{isPersonal ? 'פירוט (חובה)' : 'פירוט'}</span>
          <textarea value={packingDescription} required={isPersonal} maxLength={300} rows={4} placeholder={isPersonal ? 'הזן פירוט עבור הקרטון האישי' : 'הפירוט נוצר אוטומטית וניתן לעריכה'} onChange={(event) => { setPackingDescriptionEdited(true); setPackingDescription(event.target.value) }} />
        </label>
      </section>

      <section className="packing-card" aria-labelledby="destination-title">
        <h2 id="destination-title">לאן שולחים?</h2>
        <div className="packing-destination-mode" role="radiogroup" aria-label="בחירת אופן יעד">
          <button type="button" className={destinationMode === 'existing' ? 'selected' : ''} onClick={() => setDestinationMode('existing')} role="radio" aria-checked={destinationMode === 'existing'}>יעד קיים</button>
          <button type="button" className={destinationMode === 'new' ? 'selected' : ''} onClick={() => setDestinationMode('new')} role="radio" aria-checked={destinationMode === 'new'}>יעד חדש</button>
        </div>
        {destinationMode === 'existing' ? <div className="packing-destination-search">
          <label className="packing-field"><span>חיפוש יעד</span><input value={destinationSearch} disabled={!source.orgScopeId} placeholder="מזהה או תיאור יעד" onChange={(event) => { setDestinationSearch(event.target.value); setSelectedDestination(null) }} /></label>
          {destinationLoading && <p className="packing-loading" role="status">טוען יעדים…</p>}
          {destinationError && <p className="packing-error" role="alert">{destinationError}</p>}
          {!destinationLoading && !destinationError && destinationSearch && destinationResults.length === 0 && <p className="packing-hint">לא נמצאו יעדים</p>}
          {destinationResults.length > 0 && <div className="packing-destination-results" role="listbox" aria-label="תוצאות חיפוש יעדים">
            {destinationResults.map((destination) => <button type="button" className={`packing-destination-result ${selectedDestination?.id === destination.id ? 'selected' : ''}`} key={destination.id} role="option" aria-selected={selectedDestination?.id === destination.id} onClick={() => {
              setSelectedDestination(destination)
              setDestinationSearch(destination.destinationCode)
              setSource((value) => ({ ...value, building: destination.building, floor: destination.floor, destinationRoom: destination.room, destinationDescription: destination.description, destinationId: destination.id, destinationCode: destination.destinationCode }))
            }}><strong>{destination.destinationCode}</strong><span>{destination.building} • קומה {destination.floor} • חדר {destination.room}</span><small>{destination.description}</small></button>)}
          </div>}
          {selectedDestination && <p className="packing-room-description"><strong>{selectedDestination.destinationCode}</strong><span>{selectedDestination.description}</span></p>}
        </div> : <div className="packing-grid destination-grid">
          <label className="packing-field destination-description-field"><span>תיאור היעד</span><textarea value={source.destinationDescription} maxLength={300} rows={3} onChange={(event) => setSource((value) => ({ ...value, destinationDescription: event.target.value }))} /></label>
          <label className="packing-field"><span>בניין</span><input value={source.building} onChange={(event) => setSource((value) => ({ ...value, building: event.target.value }))} /></label>
          <label className="packing-field"><span>קומה</span><input value={source.floor} onChange={(event) => setSource((value) => ({ ...value, floor: event.target.value }))} /></label>
          <label className="packing-field"><span>חדר יעד</span><input value={source.destinationRoom} onChange={(event) => setSource((value) => ({ ...value, destinationRoom: event.target.value }))} /></label>
        </div>}
      </section>

      {error && <p className="packing-error packing-form-error" role="alert">{error}</p>}
      <button className="packing-submit" type="submit" disabled={submitLoading || mappingLoading}>{submitLoading ? 'שומר יחידת אריזה…' : 'סיום אריזה'}</button>
    </form>
  </main>
}

export function PackingSuccessScreen({ response, onContinue, onHome }: { response: PackingSuccessResponse; onContinue: () => void; onHome: () => void }) {
  const typeLabel = TYPE_OPTIONS.find((option) => option.value === response.packingUnit.type)?.label ?? 'יחידת אריזה'
  const sourceDetails = [response.source.unit, response.source.anaf, response.source.mador, response.source.team, response.source.room].filter(Boolean).join(' · ') || 'לא הוגדר'
  const destinationDetails = [response.destination.code, response.destination.building, response.destination.floor, response.destination.room].filter(Boolean).join(' · ') || 'לא הוגדר'
  return <main className="packing-shell success-shell" dir="rtl"><section className="success-card" aria-labelledby="success-title" tabIndex={-1}><p className="success-eyebrow">{typeLabel}</p><h1 id="success-title">יחידת אריזה הושלמה!</h1><div className="success-serial"><span>מס׳ אריזה</span><strong>{response.packingUnit.displaySerial ?? 'לא הוגדר'}</strong></div><p className="success-description">{response.packingUnit.description}</p><div className="success-grid"><div><span>נשלח מ:</span><strong>{sourceDetails}</strong>{response.source.sourceDescription && <small>{response.source.sourceDescription}</small>}</div><div><span>נשלח אל:</span><strong>{destinationDetails}</strong><small>{response.destination.description}</small></div><div><span>אחראי מדור:</span><strong>{response.responsibilities.madorResponsible}</strong></div><div><span>אחראי חדר:</span><strong>{response.responsibilities.roomResponsible}</strong></div><div><span>אורז:</span><strong>{response.responsibilities.packer}</strong></div><div><span>פריטים:</span><strong>{response.packingUnit.itemCount}</strong></div></div><div className="success-actions"><p>האם להמשיך באריזה?</p><div><button className="packing-submit" type="button" onClick={onContinue}>כן</button><button className="packing-secondary-button" type="button" onClick={onHome}>לא</button></div></div></section></main>
}
