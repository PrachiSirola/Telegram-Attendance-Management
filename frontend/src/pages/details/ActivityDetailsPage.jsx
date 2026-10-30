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
import { format, formatDistanceToNow } from 'date-fns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TimelineIcon from '@mui/icons-material/Timeline';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PlaceIcon from '@mui/icons-material/Place';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import NotesIcon from '@mui/icons-material/Notes';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import InitialsAvatar from '../../components/InitialsAvatar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../../components/TableStates';
import { usePageSize } from '../../hooks/usePageSize';
import { brand, tintForString } from '../../theme/theme';
import { useOrgTz } from '../../hooks/useOrgTz';
import { activityMessage, earlyMinutes } from '../../utils/activityText';

const TYPES = {
  punch_in: { label: 'Punch in', icon: <LoginIcon fontSize="small" /> },
  punch_out: { label: 'Punch out', icon: <LogoutIcon fontSize="small" /> },
  break_start: { label: 'Break start', icon: <LocalCafeIcon fontSize="small" /> },
  break_end: { label: 'Break end', icon: <LocalCafeIcon fontSize="small" /> },
  location: { label: 'Location', icon: <PlaceIcon fontSize="small" /> },
  task_update: { label: 'Task update', icon: <EditNoteIcon fontSize="small" /> },
  selfie: { label: 'Selfie', icon: <PhotoCameraIcon fontSize="small" /> },
  leave_request: { label: 'Leave request', icon: <BeachAccessIcon fontSize="small" /> },
  other: { label: 'Other', icon: <NotesIcon fontSize="small" /> },
};

function buildTitle(params) {
  const type = params.get('type');
  if (type && TYPES[type]) return `${TYPES[type].label} activities`;
  return 'All activities';
}

export default function ActivityDetailsPage() {
  const { fz } = useOrgTz();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('activity-details', 10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = { page, limit: pageSize };
    if (params.get('type')) q.type = params.get('type');
    if (params.get('from')) q.from = params.get('from');
    if (params.get('to')) q.to = params.get('to');
    if (params.get('employeeId')) q.employeeId = params.get('employeeId');
    api
      .get('/activities', { params: q })
      .then((r) => {
        setRows(r.data.data.items);
        setTotal(r.data.data.total);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, params]);

  useEffect(() => {
    setPage(1);
  }, [params]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  const title = buildTitle(params);

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={`${total} activit${total !== 1 ? 'ies' : 'y'} found`}
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
                <TableCell>Time</TableCell>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>Type</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Location</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 6 : 5} />
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={isAllOrgs ? 6 : 5} icon={<TimelineIcon />} title="No activities found" />
              ) : (
                rows.map((r) => {
                  const t = TYPES[r.activityType] || TYPES.other;
                  const tint = tintForString(r.activityType || '');
                  return (
                    <TableRow key={r._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                          {r.timestamp ? fz(r.timestamp, 'dd MMM yyyy, hh:mm a', r) : '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.timestamp ? formatDistanceToNow(new Date(r.timestamp), { addSuffix: true }) : ''}
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
                          <Chip size="small" label={r.employeeId?.organizationId?.name || '—'} sx={{ bgcolor: brand.slate100, color: 'text.secondary' }} />
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          size="small"
                          icon={t.icon}
                          label={t.label}
                          sx={{
                            bgcolor: tint.bg,
                            color: tint.fg,
                            '& .MuiChip-icon': { color: `${tint.fg} !important`, fontSize: 15 },
                          }}
                        />
                        {earlyMinutes(r) > 0 && (
                          <Chip size="small" label={`Early ${earlyMinutes(r)}m`} sx={{ ml: 0.75, bgcolor: brand.redSoft, color: brand.red, height: 22 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Tooltip title={activityMessage(r) || ''}>
                          <Typography variant="body2" noWrap>
                            {activityMessage(r) || <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {r.location?.lat != null ? (
                          <Box
                            component="a"
                            href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', textDecoration: 'none' }}
                          >
                            <PlaceIcon sx={{ fontSize: 16 }} />
                            <Typography variant="caption" fontWeight={600}>Map</Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TableFooterBar
          page={page}
          pageSize={pageSize}
          total={total}
          noun="activities"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>
    </Box>
  );
}