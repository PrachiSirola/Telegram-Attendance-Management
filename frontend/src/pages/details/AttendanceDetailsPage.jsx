import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PlaceIcon from '@mui/icons-material/Place';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusChip from '../../components/StatusChip';
import InitialsAvatar from '../../components/InitialsAvatar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../../components/TableStates';
import { usePageSize } from '../../hooks/usePageSize';
import { brand } from '../../theme/theme';
import { useOrgTz } from '../../hooks/useOrgTz';

function buildTitle(params) {
  const category = params.get('category');
  if (category === 'present') return 'Present records';
  if (category === 'absent') return 'Absent records';
  if (category === 'late') return 'Late arrival records';
  if (category === 'earlyLeave') return 'Early punch-out records';
  if (category === 'onLeave') return 'On leave records';
  if (category === 'absentOrLeave') return 'Absent / On leave records';
  if (category === 'active') return 'Currently clocked in';
  return 'Attendance records';
}

export default function AttendanceDetailsPage() {
  const { fz } = useOrgTz();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);

  const [allRows, setAllRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('attendance-details', 10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const category = params.get('category') || 'present';
    const q = {};
    if (params.get('from')) q.from = params.get('from');
    if (params.get('to')) q.to = params.get('to');
    if (params.get('match')) q.match = params.get('match');
    if (params.get('employeeId')) q.employeeId = params.get('employeeId');
    api
      .get(`/dashboard/details/${category}`, { params: q })
      .then((r) => setAllRows(r.data.data.items || []))
      .catch(() => setAllRows([]))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    setPage(1);
  }, [params]);

  const total = allRows.length;
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize);
  const title = buildTitle(params);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(total / size))));
  }
  const rangeLabel =
    params.get('from') || params.get('to')
      ? `${params.get('from') || params.get('to')}${params.get('to') && params.get('to') !== params.get('from') ? ` – ${params.get('to')}` : ''}`
      : params.get('match') === 'counts'
        ? 'All dates'
        : 'Today';

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={`${total} record${total !== 1 ? 's' : ''} found · ${rangeLabel}`}
        actions={
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>In time</TableCell>
                <TableCell>Out time</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Late</TableCell>
                <TableCell>Early leave</TableCell>
                <TableCell>Overtime</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 10 : 9} />
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={isAllOrgs ? 10 : 9} icon={<EventAvailableIcon />} title="No records found" />
              ) : (
                rows.map((r) => (
                  <TableRow key={r._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                        {r.date ? fz(r.date, 'dd MMM yyyy', r) : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.date ? fz(r.date, 'EEEE', r) : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <InitialsAvatar name={r.employeeId?.name} size={34} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {r.employeeId?.name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {[r.employeeId?.employeeId, r.employeeId?.department].filter(Boolean).join(' · ') || '—'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    {isAllOrgs && (
                      <TableCell>
                        <Chip size="small" label={r.employeeId?.organizationId?.name || '—'} sx={{ bgcolor: brand.slate100, color: 'text.secondary' }} />
                      </TableCell>
                    )}
                    <TableCell>
                      {r.punchIn ? (
                        <Box>
                          <Typography variant="body2" whiteSpace="nowrap">
                            {fz(r.punchIn, 'hh:mm a', r)}
                          </Typography>
                          {r.punchInLocation && (
                            <Tooltip title={`${r.punchInLocation.lat.toFixed(5)}, ${r.punchInLocation.lng.toFixed(5)}`}>
                              <PlaceIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                            </Tooltip>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.punchOut ? (
                        <Typography variant="body2" whiteSpace="nowrap">
                          {fz(r.punchOut, 'hh:mm a', r)}
                        </Typography>
                      ) : r.punchIn ? (
                        <StatusChip status="yet_to_checkout" />
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {r.totalHours ? `${r.totalHours}h` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {r.lateMinutes > 0 ? (
                        <Chip size="small" label={`${r.lateMinutes}m`} sx={{ bgcolor: brand.orangeSoft, color: '#C9720A', height: 22 }} />
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.earlyLeaveMinutes > 0 ? (
                        <Chip size="small" label={`${r.earlyLeaveMinutes}m`} sx={{ bgcolor: brand.redSoft, color: brand.red, height: 22 }} />
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.overtime > 0 ? (
                        <Chip size="small" label={`${r.overtime}h`} sx={{ bgcolor: brand.purpleSoft, color: brand.purple, height: 22 }} />
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                      {r.status === 'on_leave' && r.notes && (
                        <Tooltip title={r.notes}>
                          <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ mt: 0.25, maxWidth: 160 }}>
                            {r.notes}
                          </Typography>
                        </Tooltip>
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
          noun="records"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>
    </Box>
  );
}