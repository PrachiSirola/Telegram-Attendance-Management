import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { format } from 'date-fns';
import api from '../services/api';
import PageHeader from '../components/PageHeader';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { usePageSize } from '../hooks/usePageSize';
import { brand } from '../theme/theme';
import { useOrgTz } from '../hooks/useOrgTz';

const TYPE_LABELS = { weekly_off: 'Weekly Off', festival: 'Festival Leave', other: 'Other' };
const TYPE_COLORS = { weekly_off: brand.blue600, festival: '#C9720A', other: brand.purple };

const emptyForm = { date: '', type: 'weekly_off', label: '', scope: 'org', departments: [], employeeIds: [] };

export default function SetLeavesPage() {
  const { fz } = useOrgTz();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('set-leaves', 10);
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/off-days');
      setRows(data.data.items);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api
      .get('/employees', { params: { limit: 1000, active: true, fields: 'name,employeeId,department' } })
      .then((r) => {
        const items = r.data.data.items;
        setEmployees(items);
        setDepartments([...new Set(items.map((e) => e.department).filter(Boolean))].sort());
      })
      .catch(() => {});
  }, []);

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(total / size))));
  }

  const canSubmit =
    !!form.date &&
    !!form.type &&
    (form.scope !== 'department' || form.departments.length > 0) &&
    (form.scope !== 'employee' || form.employeeIds.length > 0);

  async function submit() {
    setSaving(true);
    setFormError('');
    try {
      const payload = { date: form.date, type: form.type, label: form.label, scope: form.scope };
      if (form.scope === 'department') payload.departments = form.departments;
      if (form.scope === 'employee') payload.employeeIds = form.employeeIds;
      const { data } = await api.post('/off-days', payload);
      setForm(emptyForm);
      const reclassified = data.data.reclassifiedCount || 0;
      setToast(
        reclassified > 0
          ? `Marked as off day. ${reclassified} existing Absent record${reclassified > 1 ? 's were' : ' was'} corrected.`
          : 'Marked as off day.'
      );
      await load();
      setPage(1);
    } catch (e) {
      setFormError(e.response?.data?.message || e.message || 'Could not save this off day');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/off-days/${confirmDelete._id}`);
      setToast('Off day removed');
      setConfirmDelete(null);
      await load();
    } catch {
    } finally {
      setDeleting(false);
    }
  }

  function scopeLabel(row) {
    if (row.scope === 'org') return 'Whole organization';
    if (row.scope === 'department') return row.departments?.join(', ') || 'Department';
    if (row.scope === 'employee') return row.employees?.map((e) => e.name).join(', ') || 'Employees';
    return row.scope;
  }

  return (
    <Box>
      <PageHeader
        title="Set Leaves"
        subtitle="Mark weekly offs, festival holidays, and ad-hoc non-working days — no employee is marked Absent on these dates"
      />

      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Mark a day off
        </Typography>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>
            {formError}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <MenuItem value="weekly_off">Weekly Off</MenuItem>
              <MenuItem value="festival">Festival Leave</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Applies to</InputLabel>
            <Select
              label="Applies to"
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value, departments: [], employeeIds: [] })}
            >
              <MenuItem value="org">Whole organization</MenuItem>
              <MenuItem value="department">Specific department(s)</MenuItem>
              <MenuItem value="employee">Specific employee(s)</MenuItem>
            </Select>
          </FormControl>

          {form.scope === 'department' && (
            <Autocomplete
              multiple
              size="small"
              options={departments}
              value={form.departments}
              onChange={(_, val) => setForm({ ...form, departments: val })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
              renderInput={(params) => <TextField {...params} label="Departments" placeholder="Select departments…" />}
            />
          )}
          {form.scope === 'employee' && (
            <Autocomplete
              multiple
              size="small"
              options={employees}
              getOptionLabel={(e) => e.name || ''}
              isOptionEqualToValue={(a, b) => a._id === b._id}
              value={employees.filter((e) => form.employeeIds.includes(e._id))}
              onChange={(_, val) => setForm({ ...form, employeeIds: val.map((e) => e._id) })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
              renderInput={(params) => <TextField {...params} label="Employees" placeholder="Select employees…" />}
            />
          )}

          <TextField
            label="Label (optional)"
            size="small"
            placeholder={TYPE_LABELS[form.type]}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
        </Box>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            disabled={!canSubmit || saving}
            onClick={submit}
            sx={{ color: '#fff', '&.Mui-disabled': { color: '#fff' } }}
          >
            {saving ? 'Saving…' : 'Mark as Off Day'}
          </Button>
        </Box>
      </Paper>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Applies to</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={4} />
              ) : pageRows.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  icon={<EventBusyIcon />}
                  title="No off days set yet."
                  hint="Use the form above to mark a weekly off, festival holiday, or any other day off."
                />
              ) : (
                pageRows.map((row) => (
                  <TableRow key={row._id} hover sx={row.isAuto ? { opacity: 0.7 } : undefined}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                        {fz(row.date, 'dd MMM yyyy', row)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                        {fz(row.date, 'EEEE', row)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={row.label}
                          sx={{ bgcolor: `${TYPE_COLORS[row.type]}1A`, color: TYPE_COLORS[row.type], fontWeight: 600 }}
                        />
                        {row.isAuto && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label="Auto · Org setting"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 320 }}>
                        {scopeLabel(row)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.isAuto ? (
                        <Typography variant="caption" color="text.secondary">
                          Set from Organization's Sunday Off toggle
                        </Typography>
                      ) : (
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => setConfirmDelete(row)}
                        >
                          Remove
                        </Button>
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
          noun="off days"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove this off day?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmDelete && (
              <>
                {fz(confirmDelete.date, 'dd MMM yyyy', confirmDelete)} — {confirmDelete.label}. Employees covered by
                this entry will go back to normal attendance rules for this date (future absences on this date will
                be marked normally; existing day-off records already saved will not be changed).
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={doDelete}>
            {deleting ? 'Removing…' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToast('')} sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
