import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import ApartmentIcon from '@mui/icons-material/Apartment';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import InitialsAvatar from '../../components/InitialsAvatar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../../components/TableStates';
import { usePageSize } from '../../hooks/usePageSize';
import { tintForString } from '../../theme/theme';

export default function DepartmentDetailsPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('department-details', 10);

  useEffect(() => {
    api
      .get('/employees', { params: { limit: 1000 } })
      .then((r) => setEmployees(r.data.data.items || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => {
      const dept = e.department || 'Unassigned';
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(e);
    });
    return [...map.entries()]
      .map(([name, members]) => ({
        name,
        total: members.length,
        active: members.filter((m) => m.active).length,
        members,
      }))
      .sort((a, b) => b.total - a.total);
  }, [employees]);

  const pageItems = departments.slice((page - 1) * pageSize, page * pageSize);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(departments.length / size))));
  }

  return (
    <Box>
      <PageHeader
        title="Departments"
        subtitle={`${departments.length} department${departments.length !== 1 ? 's' : ''} across ${employees.length} employees`}
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
                <TableCell>Department</TableCell>
                <TableCell>Total employees</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Members</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={4} />
              ) : pageItems.length === 0 ? (
                <TableEmpty colSpan={4} icon={<ApartmentIcon />} title="No departments found" />
              ) : (
                pageItems.map((d) => {
                  const tint = tintForString(d.name);
                  return (
                    <TableRow key={d.name} hover>
                      <TableCell>
                        <Chip size="small" label={d.name} sx={{ bgcolor: tint.bg, color: tint.fg }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{d.total}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="success.main" fontWeight={600}>{d.active}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          {d.members.slice(0, 6).map((m) => (
                            <Box key={m._id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <InitialsAvatar name={m.name} size={24} />
                              <Typography variant="caption" noWrap>{m.name}</Typography>
                            </Box>
                          ))}
                          {d.members.length > 6 && (
                            <Typography variant="caption" color="text.secondary">
                              +{d.members.length - 6} more
                            </Typography>
                          )}
                        </Box>
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
          total={departments.length}
          noun="departments"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>
    </Box>
  );
}