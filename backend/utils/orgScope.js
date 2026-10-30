function orgScope(req) {
  if (req.allOrgs) {
    return { $in: req.organizationIds || [] };
  }
  return req.organizationId;
}

module.exports = orgScope;