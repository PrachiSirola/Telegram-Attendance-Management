import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import api from '../services/api';
import PageHeader from '../components/PageHeader';
import InitialsAvatar from '../components/InitialsAvatar';
import FilterBar from '../components/FilterBar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { usePageSize } from '../hooks/usePageSize';
import { brand } from '../theme/theme';
import { formatBalance } from '../utils/leave';

export default function EmployeeLeaveBalancePage() {
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('employee-leave-balance', 10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: pageSize, active: true };
    if (search.trim()) params.q = search.trim();
    api
      .get('/employees', { params })
      .then((r) => {
        setRows(r.data.data.items);
        setTotal(r.data.data.total);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  return (
    <Box>
      <PageHeader
        title="Leave Balance"
        subtitle="Look up any employee's Casual Leave and Sick Leave balance"
      />

      <FilterBar>
        <TextField
          size="small"
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      </FilterBar>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>Casual Leave</TableCell>
                <TableCell>Sick Leave</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 4 : 3} />
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={isAllOrgs ? 4 : 3}
                  icon={<AccountBalanceWalletIcon />}
                  title="No employees found."
                  hint={search ? 'Try a different search term.' : 'No employees on the roster yet.'}
                />
              ) : (
                rows.map((e) => (
                  <TableRow key={e._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <InitialsAvatar name={e.name} size={32} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {e.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {[e.employeeId, e.department].filter(Boolean).join(' · ') || '—'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    {isAllOrgs && (
                      <TableCell>
                        <Chip
                          size="small"
                          label={e.organizationId?.name || '—'}
                          sx={{ bgcolor: brand.slate100, color: 'text.secondary' }}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                        {formatBalance(e.clBalance, e.clTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                        {formatBalance(e.slBalance, e.slTotal)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TableFooterBar page={page} pageSize={pageSize} total={total} noun="employees" onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
      </Paper>
    </Box>
  );
}