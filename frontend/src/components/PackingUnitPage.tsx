import { useState, useRef } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Checkbox,
  Menu,
  MenuItem,
  Snackbar,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

interface PackingUnit {
  id: number
  name: string
  count: number
  expanded: boolean
  subItems: { id: string; checked: boolean }[]
}

const PACKAGING_TYPES = ['קרטון מקוטע', 'קרטון אחיד', 'פלסטיק', 'זולב', 'תולדות']
const BRANCHES = ['ענף א׳', 'ענף ב׳', 'ענף ג׳']
const ROOMS = ['חדר 1', 'חדר 2', 'חדר 3']
const WAREHOUSES = ['מחסן א׳', 'מחסן ב׳', 'מחסן ג׳']
const FLOORS = ['קומה 1', 'קומה 2', 'קומה 3']
const BUILDINGS = ['בניין א׳', 'בניין ב׳', 'בניין ג׳']

const INITIAL_ITEMS: PackingUnit[] = [
  {
    id: 1,
    name: 'מחשב',
    count: 4,
    expanded: true,
    subItems: [
      { id: 'id-001', checked: false },
      { id: 'id-002', checked: false },
    ],
  },
  {
    id: 2,
    name: 'מסך',
    count: 8,
    expanded: false,
    subItems: [
      { id: 'id-003', checked: false },
      { id: 'id-004', checked: false },
    ],
  },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontFamily: 'Heebo, sans-serif',
        fontWeight: 700,
        fontSize: '0.95rem',
        color: '#3d2008',
        textAlign: 'right',
        mb: 1,
      }}
    >
      {children}
    </Typography>
  )
}

interface CustomSelectProps {
  value: string
  placeholder: string
  options: string[]
  onChange: (val: string) => void
}

function CustomSelect({ value, placeholder, options, onChange }: CustomSelectProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  return (
    <>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          backgroundColor: 'rgba(246, 230, 195, 0.85)',
          border: '1px solid rgba(200, 160, 100, 0.4)',
          borderRadius: '12px',
          px: '14px',
          py: '10px',
          fontFamily: 'Heebo, sans-serif',
          fontSize: '0.9rem',
          color: value ? '#3d2008' : '#b08060',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <ChevronDown size={16} color="#8B5E3C" style={{ flexShrink: 0 }} />
        <span style={{ textAlign: 'right', flex: 1 }}>{value || placeholder}</span>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: '4px',
              borderRadius: '12px',
              backgroundColor: 'rgba(246, 230, 195, 0.97)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              border: '1px solid rgba(200, 160, 100, 0.4)',
              minWidth: 140,
              overflow: 'hidden',
            },
          },
        }}
      >
        {options.map((opt) => (
          <MenuItem
            key={opt}
            onClick={() => {
              onChange(opt)
              setAnchorEl(null)
            }}
            selected={opt === value}
            sx={{
              fontFamily: 'Heebo, sans-serif',
              fontSize: '0.9rem',
              color: '#3d2008',
              justifyContent: 'flex-end',
              direction: 'rtl',
              py: '10px',
              px: '16px',
              '&.Mui-selected': {
                backgroundColor: 'rgba(139, 94, 60, 0.15)',
                fontWeight: 700,
              },
              '&:hover': { backgroundColor: 'rgba(139, 94, 60, 0.1)' },
            }}
          >
            {opt}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export interface PackingUnitPageProps {
  onBack: () => void
}

export default function PackingUnitPage({ onBack }: PackingUnitPageProps) {
  const [packagingType, setPackagingType] = useState('קרטון מקוטע')
  const [items, setItems] = useState<PackingUnit[]>(INITIAL_ITEMS)
  const [sourceText, setSourceText] = useState('')
  const [branch, setBranch] = useState('')
  const [room, setRoom] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [destText, setDestText] = useState('')
  const [floor, setFloor] = useState('')
  const [building, setBuilding] = useState('')
  const [toastOpen, setToastOpen] = useState(false)

  const anyItemChecked = items.some((item) => item.subItems.some((s) => s.checked))
  const allFilled = branch && room && warehouse && floor && building && anyItemChecked

  const toggleItem = (id: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, expanded: !item.expanded } : item))
    )
  }

  const toggleSubItem = (itemId: number, subId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              subItems: item.subItems.map((s) =>
                s.id === subId ? { ...s, checked: !s.checked } : s
              ),
            }
          : item
      )
    )
  }

  const toggleAllSubItems = (itemId: number, checkAll: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, subItems: item.subItems.map((s) => ({ ...s, checked: checkAll })) }
          : item
      )
    )
  }

  const handleFinish = () => {
    if (!allFilled) {
      setToastOpen(true)
    }
  }

  const sectionCardSx = {
    backgroundColor: 'rgba(240, 210, 155, 0.65)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '18px',
    p: 2,
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.1)',
  }

  const inputSx = {
    backgroundColor: 'rgba(246, 230, 195, 0.85)',
    border: '1px solid rgba(200, 160, 100, 0.4)',
    borderRadius: '12px',
    padding: '10px 14px',
    fontFamily: 'Heebo, sans-serif',
    fontSize: '0.9rem',
    color: '#3d2008',
    outline: 'none',
    width: '100%',
    direction: 'rtl' as const,
  }

  return (
    <ThemeProvider theme={theme}>
      <Box
        dir="rtl"
        sx={{
          width: '100vw',
          height: '100dvh',
          position: 'relative',
          backgroundImage: 'url(/desert-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 25%, transparent 50%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Header */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pt: '5vh',
            pb: '1.5vh',
            px: '5vw',
            flexShrink: 0,
          }}
        >
          <IconButton
            onClick={onBack}
            sx={{ position: 'absolute', right: '4vw', color: 'white', p: 0.5 }}
          >
            <ChevronRight size={28} strokeWidth={2.5} />
          </IconButton>
          <Typography
            sx={{
              fontFamily: 'Heebo, sans-serif',
              fontWeight: 800,
              fontSize: '1.6rem',
              color: 'white',
              textShadow: '0 2px 8px rgba(0,0,0,0.45)',
              letterSpacing: 0.5,
            }}
          >
            יחידת אריזה
          </Typography>
        </Box>

        {/* Scrollable form */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            overflowY: 'auto',
            px: '5vw',
            pt: 1,
            pb: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {/* מאיפה אורזים */}
          <Box sx={sectionCardSx}>
            <SectionLabel>מאיפה אורזים?</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={sourceText}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSourceText(e.target.value)
                  }
                  placeholder="ו"
                  sx={inputSx}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <CustomSelect
                  value={branch}
                  placeholder="בחר ענף"
                  options={BRANCHES}
                  onChange={setBranch}
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <CustomSelect
                  value={warehouse}
                  placeholder="בחר מחסן"
                  options={WAREHOUSES}
                  onChange={setWarehouse}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <CustomSelect
                  value={room}
                  placeholder="בחר מחדר"
                  options={ROOMS}
                  onChange={setRoom}
                />
              </Box>
            </Box>
          </Box>

          {/* בחר סוג אריזה */}
          <Box sx={sectionCardSx}>
            <SectionLabel>בחר סוג אריזה</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {PACKAGING_TYPES.map((type) => {
                const selected = packagingType === type
                return (
                  <Box
                    key={type}
                    onClick={() => setPackagingType(type)}
                    sx={{
                      px: 2,
                      py: '6px',
                      borderRadius: '999px',
                      backgroundColor: selected ? '#8B5E3C' : 'rgba(246, 230, 195, 0.85)',
                      color: selected ? 'white' : '#6e4e37',
                      fontFamily: 'Heebo, sans-serif',
                      fontWeight: selected ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                      border: selected
                        ? '1px solid rgba(255,255,255,0.2)'
                        : '1px solid rgba(200, 160, 100, 0.4)',
                      boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {type}
                  </Box>
                )
              })}
            </Box>
          </Box>

          {/* בחר פריטים לארוז */}
          <Box sx={sectionCardSx}>
            <SectionLabel>בחר פריטים לארוז</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map((item) => (
                <Box key={item.id}>
                  <Box
                    onClick={() => toggleItem(item.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(246, 230, 195, 0.85)',
                      borderRadius: item.expanded ? '12px 12px 0 0' : '12px',
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      userSelect: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      border: '1px solid rgba(200, 160, 100, 0.3)',
                      borderBottom: item.expanded
                        ? '1px solid rgba(200, 160, 100, 0.15)'
                        : '1px solid rgba(200, 160, 100, 0.3)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {item.expanded ? (
                        <ChevronUp size={18} color="#8B5E3C" />
                      ) : (
                        <ChevronDown size={18} color="#8B5E3C" />
                      )}
                      <Typography
                        sx={{
                          fontFamily: 'Heebo, sans-serif',
                          fontSize: '0.85rem',
                          color: '#6e4e37',
                          fontWeight: 500,
                        }}
                      >
                        כמות: {item.count}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        sx={{
                          fontFamily: 'Heebo, sans-serif',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: '#3d2008',
                        }}
                      >
                        {item.name}
                      </Typography>
                      <Checkbox
                        size="small"
                        checked={item.subItems.every((s) => s.checked)}
                        indeterminate={
                          item.subItems.some((s) => s.checked) &&
                          !item.subItems.every((s) => s.checked)
                        }
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleAllSubItems(item.id, e.target.checked)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                          p: 0,
                          color: '#8B5E3C',
                          '&.Mui-checked': { color: '#8B5E3C' },
                          '&.MuiCheckbox-indeterminate': { color: '#8B5E3C' },
                        }}
                      />
                    </Box>
                  </Box>

                  {item.expanded && (
                    <Box
                      sx={{
                        backgroundColor: 'rgba(250, 238, 210, 0.75)',
                        borderRadius: '0 0 12px 12px',
                        border: '1px solid rgba(200, 160, 100, 0.3)',
                        borderTop: 'none',
                        overflow: 'hidden',
                      }}
                    >
                      {item.subItems.map((sub, sIdx) => (
                        <Box
                          key={sub.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 1.5,
                            py: '8px',
                            borderBottom:
                              sIdx < item.subItems.length - 1
                                ? '1px solid rgba(200, 160, 100, 0.2)'
                                : 'none',
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={sub.checked}
                            onChange={() => toggleSubItem(item.id, sub.id)}
                            sx={{ p: 0, color: '#8B5E3C', '&.Mui-checked': { color: '#8B5E3C' } }}
                          />
                          <Typography
                            sx={{
                              fontFamily: 'Heebo, sans-serif',
                              fontSize: '0.85rem',
                              color: '#6e4e37',
                            }}
                          >
                            {item.name} ={sub.id}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>

          {/* לאן שולחים */}
          <Box sx={sectionCardSx}>
            <SectionLabel>לאן שולחים?</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={destText}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDestText(e.target.value)
                  }
                  placeholder="ו"
                  sx={inputSx}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <CustomSelect
                  value={floor}
                  placeholder="בחר קומה"
                  options={FLOORS}
                  onChange={setFloor}
                />
              </Box>
            </Box>
            <CustomSelect
              value={building}
              placeholder="בחר בניין"
              options={BUILDINGS}
              onChange={setBuilding}
            />
          </Box>
        </Box>

        {/* Fixed bottom button */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            flexShrink: 0,
            px: '5vw',
            pt: 1.5,
            pb: 'max(env(safe-area-inset-bottom), 20px)',
            backgroundColor: 'transparent',
          }}
        >
          <Box
            onClick={handleFinish}
            sx={{
              width: '100%',
              py: '14px',
              borderRadius: '999px',
              backgroundColor: allFilled ? '#8B5E3C' : 'rgba(139, 94, 60, 0.4)',
              color: allFilled ? 'white' : 'rgba(255,255,255,0.6)',
              fontFamily: 'Heebo, sans-serif',
              fontWeight: 700,
              fontSize: '1.05rem',
              textAlign: 'center',
              cursor: allFilled ? 'pointer' : 'default',
              boxShadow: allFilled ? '0 4px 16px rgba(0,0,0,0.25)' : 'none',
              letterSpacing: 0.5,
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              ...(allFilled && {
                '&:active': {
                  transform: 'scale(0.97)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                },
              }),
            }}
          >
            סיים אריזה
          </Box>
        </Box>

        {/* Toast */}
        <Snackbar
          open={toastOpen}
          autoHideDuration={2500}
          onClose={() => setToastOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          message="לא כל השדות הנדרשים מולאו"
          slotProps={{
            content: {
              sx: {
                backgroundColor: '#5a3010',
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.9rem',
                borderRadius: '12px',
                direction: 'rtl',
              },
            },
          }}
        />
      </Box>
    </ThemeProvider>
  )
}
