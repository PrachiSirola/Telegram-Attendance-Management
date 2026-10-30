const { signAccess, signRefresh } = require('./jwt');

function buildSession(admin, org) {
  const orgIdStr = org ? org._id.toString() : null;
  const accessToken = signAccess({
    sub: admin._id.toString(),
    type: 'admin',
    role: admin.role,
    organizationId: orgIdStr,
  });
  const refreshToken = signRefresh({
    sub: admin._id.toString(),
    type: 'admin',
    rv: admin.refreshTokenVersion,
    organizationId: orgIdStr,
  });
  return {
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      twoFactorEnabled: !!admin.twoFactorEnabled,
      canEditOrgFeatureToggles: !!admin.canEditOrgFeatureToggles,
    },
    organization: org
      ? {
          id: org._id,
          name: org.name,
          slug: org.slug,
          active: org.active,
        }
      : null,
    accessToken,
    refreshToken,
  };
}

module.exports = { buildSession };
