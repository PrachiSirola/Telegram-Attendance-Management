import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Avatar,
  AvatarGroup,
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
import ApartmentIcon from '@mui/icons-material/Apartment';
import GroupIcon from '@mui/icons-material/Group';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusChip from '../../components/StatusChip';
import InitialsAvatar from '../../components/InitialsAvatar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../../components/TableStates';
import { usePageSize } from '../../hooks/usePageSize';
import { brand, tintForString } from '../../theme/theme';
import { useOrgTz } from '../../hooks/useOrgTz';

function buildTitle(params) {
  const filter = params.get('filter');
  if (filter === 'active') return 'Active organizations';
  if (filter === 'inactive') return 'Inactive organizations';
  if (filter === 'admins') return 'All admin accounts';
  return 'All organizations';
}

export default function OrganizationDetailsPage() {
  const { fz } = useOrgTz();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const filter = params.get('filter') || 'all';

  const [orgs, setOrgs] = useState([]);
  const [adminsByOrg, setAdminsByOrg] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('organization-details', 10);

  useEffect(() => {
    setLoading(true);
    api
      .get('/organizations')
      .then(async (r) => {
        const items = r.data.data || [];
        setOrgs(items);
        const results = await Promise.all(
          items.map((o) =>
            api.get(`/organizations/${o._id}/admins`).then((res) => [o._id, res.data.data || []]).catch(() => [o._id, []])
          )
        );
        setAdminsByOrg(Object.fromEntries(results));
      })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter]);
  const allAdmins = useMemo(() => {
    if (filter !== 'admins') return [];
    return Object.entries(adminsByOrg).flatMap(([orgId, admins]) => {
      const org = orgs.find((o) => o._id === orgId);
      return admins.map((a) => ({ ...a, orgName: org?.name || '—', orgSlug: org?.slug || '—' }));
    });
  }, [filter, adminsByOrg, orgs]);

  const filtered = useMemo(() => {
    if (filter === 'admins') return [];
    return orgs.filter((o) => {
      if (filter === 'active') return o.active;
      if (filter === 'inactive') return !o.active;
      return true;
    });
  }, [orgs, filter]);

  const items = filter === 'admins' ? allAdmins : filtered;
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  const title = buildTitle(params);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(items.length / size))));
  }

  if (filter === 'admins') {
    return (
      <Box>
        <PageHeader
          title={title}
          subtitle={`${items.length} admin${items.length !== 1 ? 's' : ''} across all organizations`}
          actions={<Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>}
        />
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Admin</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableSpinner colSpan={5} />
                ) : pageItems.length === 0 ? (
                  <TableEmpty colSpan={5} icon={<GroupIcon />} title="No admin accounts found" />
                ) : (
                  pageItems.map((a) => (
                    <TableRow key={a._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <InitialsAvatar name={a.name} size={34} />
                          <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{a.email}</Typography></TableCell>
                      <TableCell>
                        <Chip size="small" label={`${a.orgName} (${a.orgSlug})`} sx={{ bgcolor: brand.blueSoft, color: brand.blue600 }} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={a.role === 'super_admin' ? 'Super admin' : 'Admin'} sx={{ bgcolor: a.role === 'super_admin' ? brand.purpleSoft : brand.blueSoft, color: a.role === 'super_admin' ? brand.purple : brand.blue600 }} />
                      </TableCell>
                      <TableCell><StatusChip status={a.active ? 'active' : 'inactive'} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TableFooterBar
            page={page}
            pageSize={pageSize}
            total={items.length}
            noun="admins"
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={`${items.length} organization${items.length !== 1 ? 's' : ''} found`}
        actions={<Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>}
      />
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Organization</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Admins</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={5} />
              ) : pageItems.length === 0 ? (
                <TableEmpty colSpan={5} icon={<ApartmentIcon />} title="No organizations found" />
              ) : (
                pageItems.map((o) => {
                  const tint = tintForString(o.name || '');
                  const admins = adminsByOrg[o._id] || [];
                  return (
                    <TableRow key={o._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box sx={{ width: 38, height: 38, borderRadius: '11px', bgcolor: tint.bg, color: tint.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <ApartmentIcon fontSize="small" />
                          </Box>
                          <Typography variant="body2" fontWeight={600}>{o.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={o.slug || '—'} sx={{ bgcolor: brand.slate100, color: 'text.secondary', fontFamily: 'monospace' }} />
                      </TableCell>
                      <TableCell>
                        {admins.length > 0 ? (
                          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.7rem', borderColor: '#fff' } }}>
                            {admins.map((a) => (
                              <Tooltip key={a._id} title={a.name}>
                                <Avatar sx={{ bgcolor: tintForString(a.name).bg, color: tintForString(a.name).fg, fontSize: '0.7rem' }}>
                                  {a.name?.slice(0, 2).toUpperCase()}
                                </Avatar>
                              </Tooltip>
                            ))}
                          </AvatarGroup>
                        ) : (
                          <Typography variant="body2" color="text.disabled">None</Typography>
                        )}
                      </TableCell>
                      <TableCell><StatusChip status={o.active ? 'active' : 'inactive'} /></TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                          {o.createdAt ? fz(o.createdAt, 'dd MMM yyyy', o) : '—'}
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
          total={items.length}
          noun="organizations"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>
    </Box>
  );
}