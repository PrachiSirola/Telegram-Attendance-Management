import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../services/api';
import PageHeader from '../components/PageHeader';
import InitialsAvatar from '../components/InitialsAvatar';
import FilterBar from '../components/FilterBar';
import { DateRangeFilter } from '../components/DatePickers';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { brand } from '../theme/theme';
import { exportRowsToCsv } from '../utils/exportCsv';
import { useOrgTz } from '../hooks/useOrgTz';
import { usePageSize } from '../hooks/usePageSize';

const PAGE_SIZE = 8;
const emptyFilters = { from: '', to: '', employeeId: '' };

export default function TaskUpdatesPage() {
  const { fz, todayIn } = useOrgTz();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('task-updates', PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState([]);
  const todayStr = todayIn();
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, from: todayStr, to: todayStr }));
  const defaultDay = useRef(todayStr);
  useEffect(() => {
    if (defaultDay.current === todayStr) return;
    const prev = defaultDay.current;
    defaultDay.current = todayStr;
    setFilters((f) => (f.from === prev && f.to === prev ? { ...f, from: todayStr, to: todayStr } : f));
  }, [todayStr]);
  const [full, setFull] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: pageSize, type: 'task_update' };
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.employeeId) params.employeeId = filters.employeeId;
      const { data } = await api.get('/activities', { params });
      setRows(data.data.items);
      setTotal(data.data.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get('/employees', { params: { limit: 1000, active: true, fields: 'name,employeeId' } })
      .then((r) => setEmployees(r.data.data.items))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    load();
  }, [page, pageSize, filters]);

  useEffect(() => {
    setPage(1);
  }, [filters.from, filters.to, filters.employeeId]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  const isTodayOnly = filters.from === todayStr && filters.to === todayStr;
  const filtersActive = !(isTodayOnly && !filters.employeeId);

  function exportCsv() {
    exportRowsToCsv(
      `task-updates-page-${page}.csv`,
      [
        { label: 'Date', value: (r) => (r.timestamp ? fz(r.timestamp, 'yyyy-MM-dd', r) : '') },
        { label: 'Time', value: (r) => (r.timestamp ? fz(r.timestamp, 'HH:mm', r) : '') },
        { label: 'Employee', value: (r) => r.employeeId?.name },
        { label: 'Task', value: (r) => r.message },
      ],
      rows
    );
  }

  return (
    <Box>
      <PageHeader
        title="Task updates"
        subtitle="What employees have logged through the Telegram bot"
        actions={
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={rows.length === 0}>
            Export
          </Button>
        }
      />

      <FilterBar>
        <DateRangeFilter
          from={filters.from}
          to={filters.to}
          onChange={({ from, to }) => setFilters({ ...filters, from, to })}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          options={employees}
          getOptionLabel={(e) => e.name || ''}
          isOptionEqualToValue={(a, b) => a._id === b._id}
          value={employees.find((e) => e._id === filters.employeeId) || null}
          onChange={(_, value) => setFilters({ ...filters, employeeId: value?._id || '' })}
          renderInput={(params) => <TextField {...params} label="Employee" placeholder="Search employees…" />}
        />
        {filtersActive && (
          <Button size="small" startIcon={<RestartAltIcon />} onClick={() => setFilters({ ...emptyFilters, from: todayStr, to: todayStr })}>
            Reset
          </Button>
        )}
      </FilterBar>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>Time</TableCell>
                <TableCell>Task</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 5 : 4} />
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={isAllOrgs ? 5 : 4}
                  icon={<AssignmentIcon />}
                  title="No task updates found."
                  hint="Try a different date range, or clear the employee filter."
                />
              ) : (
                rows.map((r) => (
                  <TableRow key={r._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                        {r.timestamp ? fz(r.timestamp, 'dd MMM yyyy', r) : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                        {r.timestamp ? fz(r.timestamp, 'EEEE', r) : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <InitialsAvatar name={r.employeeId?.name} size={32} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {r.employeeId?.name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {r.employeeId?.employeeId || ''}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    {isAllOrgs && (
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.employeeId?.organizationId?.name || '—'}
                          sx={{ bgcolor: brand.slate100, color: 'text.secondary' }}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" whiteSpace="nowrap">
                        {r.timestamp ? fz(r.timestamp, 'hh:mm a', r) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      {r.message ? (
                        <Typography
                          variant="body2"
                          noWrap
                          onClick={() => setFull(r)}
                          sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {r.message}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TableFooterBar
          page={page}
          pageSize={pageSize}
          total={total}
          noun="task updates"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>

      <Dialog open={!!full} onClose={() => setFull(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {full?.employeeId?.name || 'Unknown'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {full?.timestamp ? fz(full.timestamp, 'dd MMM yyyy, hh:mm a', full) : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setFull(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {full?.message}
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}