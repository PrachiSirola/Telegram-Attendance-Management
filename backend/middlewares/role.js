function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      res.status(401);
      return next(new Error('Not authorized'));
    }
    if (!roles.includes(req.admin.role)) {
      res.status(403);
      return next(new Error('Forbidden'));
    }
    next();
  };
}

function requireOrgFeatureTogglePermission(req, res, next) {
  if (!req.admin) {
    res.status(401);
    return next(new Error('Not authorized'));
  }
  if (req.admin.role === 'super_admin') {
    return next();
  }
  const ownOrgId = req.admin.organizationId?._id || req.admin.organizationId;
  const sameOrg = ownOrgId && String(ownOrgId) === String(req.params.orgId);
  if (req.admin.role === 'admin' && req.admin.canEditOrgFeatureToggles && sameOrg) {
    return next();
  }
  res.status(403);
  return next(new Error('Forbidden'));
}

module.exports = { requireRole, requireOrgFeatureTogglePermission };
