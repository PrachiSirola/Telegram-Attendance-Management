import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import api from '../../services/api';
import { setOrgOverride } from '../../redux/slices/authSlice';
import PageHeader from '../../components/PageHeader';
import StatusChip from '../../components/StatusChip';
import InitialsAvatar from '../../components/InitialsAvatar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../../components/TableStates';
import { usePageSize } from '../../hooks/usePageSize';
import { brand, tintForString } from '../../theme/theme';
import { formatShiftTiming } from '../../utils/time';
import { useOrgTz } from '../../hooks/useOrgTz';

const TITLES = {
  all: 'All employees',
  active: 'Active employees',
  inactive: 'Inactive employees',
};

export default function EmployeeDetailsPage() {
  const { fz } = useOrgTz();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);
  const filter = params.get('filter') || 'all';

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('employee-details', 10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = { page, limit: pageSize };
    if (filter === 'active') q.active = true;
    if (filter === 'inactive') q.active = false;
    api
      .get('/employees', { params: q })
      .then((r) => {
        setRows(r.data.data.items);
        setTotal(r.data.data.total);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, filter]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  return (
    <Box>
      <PageHeader
        title={TITLES[filter] || 'Employees'}
        subtitle={`${total} employee${total !== 1 ? 's' : ''} found`}
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
                <TableCell>Code</TableCell>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>Department</TableCell>
                <TableCell>Shift</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 8 : 7} />
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={isAllOrgs ? 8 : 7} icon={<PeopleAltIcon />} title="No employees found" />
              ) : (
                rows.map((r) => {
                  const tint = tintForString(r.department || '');
                  return (
                    <TableRow
                      key={r._id}
                      hover
                      onClick={() => {
                        if (isAllOrgs && r.organizationId?._id) {
                          dispatch(
                            setOrgOverride({
                              id: r.organizationId._id,
                              name: r.organizationId.name,
                              slug: r.organizationId.slug,
                              active: true,
                            })
                          );
                        }
                        navigate(`/employees/${r._id}`, { state: { fromAllOrgs: isAllOrgs } });
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Chip size="small" label={r.employeeId} sx={{ bgcolor: brand.blueSoft, color: brand.blue600 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <InitialsAvatar name={r.name} src={r.profilePhoto} size={36} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {r.email || r.phone || '—'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      {isAllOrgs && (
                        <TableCell>
                          <Chip size="small" label={r.organizationId?.name || '—'} sx={{ bgcolor: brand.slate100, color: 'text.secondary' }} />
                        </TableCell>
                      )}
                      <TableCell>
                        {r.department ? (
                          <Chip size="small" label={r.department} sx={{ bgcolor: tint.bg, color: tint.fg }} />
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" whiteSpace="nowrap">
                          {formatShiftTiming(r.shiftTiming) || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{r.role || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={r.active ? 'active' : 'inactive'} />
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
          noun="employees"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>
    </Box>
  );
}