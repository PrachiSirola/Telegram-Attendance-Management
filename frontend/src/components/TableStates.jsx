import {
  Box,
  CircularProgress,
  FormControl,
  MenuItem,
  Pagination,
  Select,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { PAGE_SIZE_OPTIONS } from '../hooks/usePageSize';
import EmptyState from './EmptyState';

export function TableSpinner({ colSpan, minHeight = 220 }) {
  return (
    <TableRow sx={{ '&:hover': { bgcolor: 'transparent !important' } }}>
      <TableCell colSpan={colSpan} sx={{ borderBottom: 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight }}>
          <CircularProgress size={32} />
        </Box>
      </TableCell>
    </TableRow>
  );
}

export function TableEmpty({ colSpan, icon, title, hint }) {
  return (
    <TableRow sx={{ '&:hover': { bgcolor: 'transparent !important' } }}>
      <TableCell colSpan={colSpan} sx={{ borderBottom: 'none' }}>
        <EmptyState icon={icon} title={title} hint={hint} />
      </TableCell>
    </TableRow>
  );
}

export function TableFooterBar({
  page,
  pageSize,
  total,
  noun = 'records',
  onPageChange,
  onPageSizeChange,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        px: 2,
        py: 1.5,
        gap: 1,
        flexWrap: 'wrap',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {onPageSizeChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
              Rows per page
            </Typography>
            <FormControl size="small">
              <Select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                sx={{ minWidth: 72, height: 32 }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Typography variant="body2" color="text.secondary">
          {total === 0 ? `No ${noun} found` : `Showing ${from} to ${to} of ${total} ${noun}`}
        </Typography>
      </Box>
      <Pagination
        count={pageCount}
        page={page}
        onChange={(_e, p) => onPageChange(p)}
        shape="rounded"
        color="primary"
        size="small"
        siblingCount={0}
      />
    </Box>
  );
}