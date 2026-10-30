const jwt = require('jsonwebtoken');
const {
  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpires,
  jwtRefreshExpires,
} = require('../config/env');

function signAccess(payload) {
  return jwt.sign(payload, jwtAccessSecret, { expiresIn: jwtAccessExpires });
}

function signRefresh(payload) {
  return jwt.sign(payload, jwtRefreshSecret, { expiresIn: jwtRefreshExpires });
}

function verifyAccess(token) {
  return jwt.verify(token, jwtAccessSecret);
}

function verifyRefresh(token) {
  return jwt.verify(token, jwtRefreshSecret);
}

module.exports = {
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
};
