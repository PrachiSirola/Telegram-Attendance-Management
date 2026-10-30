import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { DEFAULT_TZ, formatInTz, wallStringToIso, dayStringInTz } from '../utils/tz';
export function useOrgTz() {
  const byId = useSelector((s) => s.tz.byId);
  const override = useSelector((s) => s.auth.orgOverride);
  const ownOrg = useSelector((s) => s.auth.organization);

  const idOf = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'string') return ref;
    if (ref.organizationId) return idOf(ref.organizationId);
    return ref._id || ref.id || null;
  };

  const ctxTz =
    (override && !override.allOrgs && byId[String(override.id)]) ||
    (ownOrg && byId[String(ownOrg.id || ownOrg._id)]) ||
    ownOrg?.timezone ||
    DEFAULT_TZ;

  const tzFor = useCallback(
    (ref) => {
      const id = idOf(ref);
      return (id && byId[String(id)]) || ctxTz;
    },
    [byId, ctxTz]
  );

  const fz = useCallback((date, pattern, ref) => formatInTz(date, pattern, tzFor(ref)), [tzFor]);
  const fd = useCallback((date, pattern) => formatInTz(date, pattern, 'UTC'), []);
  const toIso = useCallback((wall, ref) => wallStringToIso(wall, tzFor(ref)), [tzFor]);
  const todayIn = useCallback((ref) => dayStringInTz(new Date(), tzFor(ref)), [tzFor]);

  return { fz, fd, tzFor, toIso, todayIn, ctxTz };
}
