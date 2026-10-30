function requireActiveOrg(req, res, next) {
  if (req.method === 'GET') return next();
  if (req.allOrgs) {
    res.status(403);
    return next(
      new Error('Select a single organization to make changes. The All Companies view is read-only.')
    );
  }
  if (req.organizationActive === false) {
    res.status(403);
    return next(
      new Error('This organization is inactive. Editing is disabled until it is reactivated.')
    );
  }
  next();
}

module.exports = requireActiveOrg;