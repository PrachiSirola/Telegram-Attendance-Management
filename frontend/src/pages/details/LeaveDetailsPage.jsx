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
import { differenceInCalendarDays, format } from 'date-fns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import api from '../../services/api';
import { formatBalance } from '../../utils/leave';
import PageHeader from '../../components/PageHeader';
import StatusChip from '../../components/StatusChip';
import InitialsAvatar from '../../components/InitialsAvatar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../../components/TableStates';
import { usePageSize } from '../../hooks/usePageSize';
import { brand } from '../../theme/theme';
import { useOrgTz } from '../../hooks/useOrgTz';

function buildTitle(params) {
  const status = params.get('status');
  if (status === 'pending') return 'Pending leave requests';
  if (status === 'approved') return 'Approved leave requests';
  if (status === 'rejected') return 'Rejected leave requests';
  return 'All leave requests';
}

export default function LeaveDetailsPage() {
  const { fz, fd } = useOrgTz();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('leave-details', 10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = { page, limit: pageSize };
    if (params.get('status')) q.status = params.get('status');
    if (params.get('employeeId')) q.employeeId = params.get('employeeId');
    api
      .get('/leaves', { params: q })
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
        subtitle={`${total} request${total !== 1 ? 's' : ''} found`}
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
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Days</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Casual Leave</TableCell>
                <TableCell>Sick Leave</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Applied on</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 9 : 8} />
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={isAllOrgs ? 9 : 8} icon={<BeachAccessIcon />} title="No leave requests found" />
              ) : (
                rows.map((r) => {
                  const days = differenceInCalendarDays(new Date(r.endDate), new Date(r.startDate)) + 1;
                  return (
                    <TableRow key={r._id} hover>
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
                        <Typography variant="body2" whiteSpace="nowrap">
                          {fd(r.startDate, 'dd MMM yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" whiteSpace="nowrap">
                          {fd(r.endDate, 'dd MMM yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={`${days}d`} sx={{ bgcolor: brand.blueSoft, color: brand.blue600 }} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Tooltip title={r.reason || ''}>
                          <Typography variant="body2" noWrap>
                            {r.reason || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {formatBalance(r.employeeId?.clBalance, r.employeeId?.clTotal)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {formatBalance(r.employeeId?.slBalance, r.employeeId?.slTotal)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={r.status} />
                        {r.status === 'approved' && r.approvalType && r.approvalType !== 'normal' && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {r.approvalType === 'unpaid' ? 'Unpaid' : 'Override – Paid'}
                            {r.overrideByName ? ` · by ${r.overrideByName}` : ''}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                          {r.createdAt ? fz(r.createdAt, 'dd MMM yyyy', r) : '—'}
                        </Typography>
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
          noun="requests"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>
    </Box>
  );
}