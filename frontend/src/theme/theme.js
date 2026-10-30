import { createTheme } from '@mui/material/styles';
export const brand = {
  blue800: '#0B2F9E',
  blue700: '#0F3FBF',
  blue600: '#1454E0',
  blue500: '#2563EB',
  blue400: '#3E7CFF',
  blueSoft: '#EAF0FF',
  blueSofter: '#F4F7FF',
  gradient: 'linear-gradient(92deg, #1A47D8 0%, #2B63EE 55%, #3F7BFA 100%)',
  headerGradient: 'linear-gradient(95deg, #1840CE 0%, #2459E6 46%, #3B7AF8 100%)',
  sidebarActive: '#E4EDFF',
  navText: '#0B1220',
  navIcon: '#334155',
  canvas: '#EEF2FD',
  pageGradient:
    'radial-gradient(900px 520px at 8% 6%, rgba(120,165,255,0.38), transparent 62%),' +
    'radial-gradient(900px 560px at 82% 0%, rgba(170,145,255,0.36), transparent 62%),' +
    'radial-gradient(1000px 640px at 96% 96%, rgba(196,172,255,0.38), transparent 62%),' +
    'radial-gradient(800px 520px at 4% 100%, rgba(140,185,255,0.30), transparent 62%),' +
    'linear-gradient(180deg, #E6EEFF 0%, #ECEBFF 52%, #F1ECFF 100%)',
  cardBorder: 'rgba(96, 115, 170, 0.18)',
  surface: '#FFFFFF',
  slate100: '#F3F6FC',
  slate200: '#E4E9F4',
  slate300: '#D3DBEC',
  slate400: '#8A99B2',
  slate500: '#56657F',
  slate700: '#2B3A55',
  ink: '#0C1530',

  green: '#16A34A',
  greenSoft: '#E8F8EE',
  orange: '#E58A00',
  orangeSoft: '#FFF4E2',
  red: '#E03B3B',
  redSoft: '#FDECEC',
  purple: '#7C4DFF',
  purpleSoft: '#F1ECFF',
  teal: '#0E9BA8',
  tealSoft: '#E3F6F8',
  pink: '#DB3F76',
  pinkSoft: '#FCE9F0',
};

export const shadow = {
  xs: '0 1px 2px rgba(30, 41, 100, 0.05)',
  sm: '0 1px 2px rgba(30, 41, 100, 0.05), 0 8px 20px -10px rgba(40, 55, 120, 0.16)',
  md: '0 6px 16px -6px rgba(40, 55, 120, 0.18)',
  lg: '0 16px 36px -10px rgba(30, 41, 100, 0.28)',
  brand: '0 10px 24px -10px rgba(20, 84, 224, 0.55)',
};
export const tintPalette = [
  { bg: '#EAF0FF', fg: '#1454E0' },
  { bg: '#F1ECFF', fg: '#6A3DE8' },
  { bg: '#FFF4E2', fg: '#C9720A' },
  { bg: '#E8F8EE', fg: '#178A43' },
  { bg: '#FCE9F0', fg: '#C22A63' },
  { bg: '#E3F6F8', fg: '#0E7C90' },
  { bg: '#FDECEC', fg: '#C62F2F' },
  { bg: '#EEF3E4', fg: '#5A7A1A' },
];

export function tintForString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return tintPalette[Math.abs(hash) % tintPalette.length];
}
const waveSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 460' preserveAspectRatio='none'>" +
  "<defs>" +
  "<linearGradient id='a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.62'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>" +
  "<linearGradient id='b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.48'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>" +
  "</defs>" +
  "<path d='M-60 460 C 160 400 330 150 600 128 C 830 108 930 270 1130 340 C 1290 396 1470 372 1660 300 L1660 460 Z' fill='url(#a)'/>" +
  "<path d='M620 460 C 880 330 1110 196 1340 176 C 1490 164 1590 196 1660 224 L1660 460 Z' fill='url(#b)'/>" +
  "<path d='M-60 460 C 160 400 330 150 600 128 C 830 108 930 270 1130 340 C 1290 396 1470 372 1660 300' fill='none' stroke='#fff' stroke-opacity='.55' stroke-width='1.5'/>" +
  "</svg>";
const waveBg = `url("data:image/svg+xml,${encodeURIComponent(waveSvg)}")`;

const base = createTheme();

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brand.blue600,
      dark: brand.blue700,
      light: brand.blue400,
      contrastText: '#fff',
    },
    secondary: { main: brand.purple },
    success: { main: brand.green },
    warning: { main: brand.orange },
    error: { main: brand.red },
    background: { default: brand.canvas, paper: brand.surface },
    text: { primary: brand.ink, secondary: brand.slate500, disabled: brand.slate400 },
    divider: brand.slate200,
    action: { hover: brand.slate100 },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"DM Sans", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600 },
    body1: { fontWeight: 500 },
    body2: { fontSize: '0.875rem', fontWeight: 500 },
    caption: { fontSize: '0.75rem' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  shadows: Object.assign([...base.shadows], {
    1: shadow.xs,
    2: shadow.sm,
    3: shadow.md,
    4: shadow.lg,
  }),
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          backgroundColor: brand.canvas,
          backgroundImage: brand.pageGradient,
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
        },
        body: {
          backgroundColor: 'transparent',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
          color: brand.ink,
        },
        'body::before': {
          content: '""',
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          backgroundImage: waveBg,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top center',
          backgroundSize: '100% min(460px, 55vh)',
        },
        '*::-webkit-scrollbar': { width: 9, height: 9 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: brand.slate300,
          borderRadius: 8,
          border: '2px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': { backgroundColor: brand.slate400 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${brand.cardBorder}`,
          backgroundColor: '#fff',
          backgroundImage: 'none',
          minWidth: 0,
        },
        elevation1: { boxShadow: shadow.sm },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingLeft: 16,
          paddingRight: 16,
          minHeight: 40,
          transition: 'background-color .15s ease, box-shadow .15s ease, border-color .15s ease',
        },
        sizeSmall: {
          minHeight: 32,
          paddingLeft: 12,
          paddingRight: 12,
          '@media (pointer: coarse)': { minHeight: 40 },
        },
        containedPrimary: {
          background: brand.gradient,
          boxShadow: shadow.brand,
          '&:hover': { background: brand.blue700, boxShadow: shadow.brand },
        },
        outlined: {
          borderColor: brand.slate300,
          color: brand.slate700,
          backgroundColor: '#fff',
          '&:hover': { borderColor: brand.blue400, backgroundColor: brand.blueSofter },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          // Touch devices only: comfortable hit area; desktop untouched.
          '@media (pointer: coarse)': { minWidth: 40, minHeight: 40 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600, height: 26 },
        sizeSmall: { fontSize: '0.72rem', height: 24 },
        label: { paddingLeft: 9, paddingRight: 9 },
      },
    },
    MuiTable: {
      styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#F4F7FE',
          color: brand.slate500,
          fontWeight: 700,
          fontSize: '0.71rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          borderBottom: `1px solid ${brand.slate200}`,
          paddingTop: 12,
          paddingBottom: 12,
        },
        root: {
          borderBottom: `1px solid ${brand.slate200}`,
          paddingTop: 11,
          paddingBottom: 11,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color .12s ease',
          '&:last-of-type td': { borderBottom: 'none' },
          '&.MuiTableRow-hover:hover': { backgroundColor: brand.blueSofter },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#fff',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: brand.slate300 },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: brand.slate400 },
        },
        input: { '&::placeholder': { color: brand.slate400, opacity: 1 } },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.9rem' } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 18,
          boxShadow: shadow.lg,
          [theme.breakpoints.down('sm')]: {
            margin: 12,
            width: 'calc(100% - 24px)',
            maxWidth: 'calc(100% - 24px)',
            maxHeight: 'calc(100% - 24px)',
          },
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 700, fontSize: '1.05rem', paddingBottom: 8 } },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: '12px 24px 20px',
          flexWrap: 'wrap',
          rowGap: 8,
          [theme.breakpoints.down('sm')]: { padding: '12px 16px 16px' },
        }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12, boxShadow: shadow.lg, marginTop: 6, maxWidth: 'calc(100vw - 16px)' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: brand.ink,
          fontSize: '0.75rem',
          borderRadius: 8,
          padding: '6px 10px',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          '@media (pointer: coarse)': { minWidth: 40, height: 40 },
        },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 12 },
      },
    },
    MuiAvatar: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 999, height: 6 } },
    },
  },
});