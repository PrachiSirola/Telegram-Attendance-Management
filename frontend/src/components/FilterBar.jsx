import { Box, Paper } from '@mui/material';
export default function FilterBar({ children, sx }) {
  return (
    <Paper
      sx={{
        p: 1.75,
        mb: 2,
        display: 'flex',
        gap: 1.25,
        flexWrap: 'wrap',
        alignItems: 'center',
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
export function FilterSpacer() {
  return <Box sx={{ flex: 1, minWidth: 0 }} />;
}