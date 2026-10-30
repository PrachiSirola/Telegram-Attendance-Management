const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const {
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  emailFrom,
  frontendUrl,
} = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!smtpHost || !smtpUser || !smtpPass) return null;
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  });
  return transporter;
}
async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    logger.error(`Email not sent (SMTP not configured): "${subject}" to ${to}`);
    return false;
  }
  try {
    await t.sendMail({ from: emailFrom, to, subject, html, text: text || html.replace(/<[^>]+>/g, ' ') });
    return true;
  } catch (err) {
    logger.error(`Email send failed: "${subject}" to ${to}`, err.message);
    return false;
  }
}
const BRAND_BLUE = '#1454E0';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
function layout({ icon = '🔔', iconBg = '#EEF2FF', bodyHtml }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#F3F5FA;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5FA;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;height:36px;background:${BRAND_BLUE};border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:36px;">👥</td>
                    <td style="padding-left:10px;font-size:16px;font-weight:bold;color:${TEXT_DARK};">Attendance System</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:64px;height:64px;background:${iconBg};border-radius:50%;text-align:center;vertical-align:middle;font-size:30px;line-height:64px;">${icon}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;color:${TEXT_DARK};font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px 32px;">
                <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 16px 0;" />
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:26px;vertical-align:top;font-size:16px;">🛟</td>
                    <td style="padding-left:8px;font-size:13px;color:${TEXT_MUTED};">
                      <strong style="color:${TEXT_DARK};">Need help?</strong><br />
                      If you have any questions, feel free to reach out to your administrator.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background:${BRAND_BLUE};border-radius:10px;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}
function highlightBox(value) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:2px dashed #C7D2FE;border-radius:12px;background:#F5F7FF;">
    <tr>
      <td style="padding:20px;text-align:center;">
        <span style="font-size:24px;font-weight:bold;color:${BRAND_BLUE};letter-spacing:0.5px;font-family:'Courier New',monospace;">${value}</span>
      </td>
    </tr>
  </table>`;
}
function tipBox(text, tone = 'info') {
  const palette = {
    info: { bg: '#EFF6FF', border: '#93C5FD', icon: 'ℹ️' },
    success: { bg: '#ECFDF5', border: '#6EE7B7', icon: '✅' },
    warning: { bg: '#FEF2F2', border: '#FCA5A5', icon: '⚠️' },
  }[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:${palette.bg};border:1px solid ${palette.border};border-radius:10px;">
    <tr>
      <td style="padding:12px 16px;font-size:13px;color:#374151;">
        ${palette.icon}&nbsp; ${text}
      </td>
    </tr>
  </table>`;
}
function infoCard(rows) {
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;font-size:13px;color:${TEXT_MUTED};">${label}</td></tr>
         <tr><td style="padding:0 0 10px 0;font-size:15px;font-weight:bold;color:${TEXT_DARK};">${value}</td></tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#F9FAFB;border-radius:10px;">
    <tr><td style="padding:14px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
    </td></tr>
  </table>`;
}

async function sendPasswordResetEmail(admin, plainToken) {
  if (!frontendUrl) {
    logger.error('Cannot send password reset email: FRONTEND_URL is not set.');
    return false;
  }
  const link = `${frontendUrl.replace(/\/$/, '')}/reset-password/${plainToken}`;
  return sendEmail({
    to: admin.email,
    subject: 'Reset your password',
    html: layout({
      icon: '🔒',
      bodyHtml: `
        <p style="font-size:20px;font-weight:bold;margin:0 0 8px 0;">Hi ${admin.name},</p>
        <p style="margin:0;">We received a request to reset your password. This link is valid for <strong>30 minutes</strong> and can only be used once.</p>
        ${button(link, '🔒 Reset password')}
        ${tipBox("If you didn't request this, you can safely ignore this email — your password won't change.", 'info')}
      `,
    }),
  });
}

async function sendSlugEmail(admin, orgName, slug) {
  return sendEmail({
    to: admin.email,
    subject: 'Your organization slug',
    html: layout({
      icon: '🏢',
      bodyHtml: `
        <p style="font-size:20px;font-weight:bold;margin:0 0 8px 0;">Hi ${admin.name},</p>
        <p style="margin:0;">Here's the login slug for <strong>${orgName}</strong>:</p>
        ${highlightBox(slug)}
        ${tipBox('Use this on the login screen along with your email and password.', 'success')}
      `,
    }),
  });
}
function excludeSmtpSender(admins) {
  logger.info(
    `excludeSmtpSender check: smtpUser="${smtpUser}", recipients=[${admins.map((a) => a.email).join(', ')}]`
  );
  if (!smtpUser) return admins;
  const filtered = admins.filter((a) => (a.email || '').trim().toLowerCase() !== smtpUser.toLowerCase());
  if (filtered.length !== admins.length) {
    logger.info(`excludeSmtpSender: filtered out SMTP account (${smtpUser}) from ${admins.length} recipient(s)`);
  }
  return filtered;
}
async function sendAdminSelfResetNotifyToSuperAdmins(superAdmins, admin, orgName, newPlainPassword) {
  const recipients = excludeSmtpSender(superAdmins);
  if (!recipients.length) return;
  const subject = `${admin.name} (${orgName}) reset their password`;
  const html = layout({
    icon: '🔑',
    iconBg: '#FEF3C7',
    bodyHtml: `
      <p style="font-size:20px;font-weight:bold;margin:0 0 8px 0;">Hi,</p>
      <p style="margin:0;"><strong>${admin.name}</strong>, an Admin of <strong>${orgName}</strong>, has just reset their own password using the forgot-password link.</p>
      ${infoCard([
        ['New password', newPlainPassword],
        ['Email', admin.email],
      ])}
    `,
  });
  await Promise.all(recipients.map((sa) => sendEmail({ to: sa.email, subject, html })));
}
async function sendAdminSlugRecoveryNotifyToSuperAdmins(superAdmins, admin, orgName) {
  const recipients = excludeSmtpSender(superAdmins);
  if (!recipients.length) return;
  const subject = `${admin.name} (${orgName}) recovered their organization slug`;
  const html = layout({
    icon: '🏢',
    bodyHtml: `
      <p style="font-size:20px;font-weight:bold;margin:0 0 8px 0;">Hi,</p>
      <p style="margin:0;"><strong>${admin.name}</strong> (${admin.email}), an Admin of <strong>${orgName}</strong>, just requested and was sent their organization's login slug.</p>
    `,
  });
  await Promise.all(recipients.map((sa) => sendEmail({ to: sa.email, subject, html })));
}
async function sendPasswordChangedBySuperAdminNotify(admin) {
  return sendEmail({
    to: admin.email,
    subject: 'Your password has been changed',
    html: layout({
      icon: '⚠️',
      iconBg: '#FEE2E2',
      bodyHtml: `
        <p style="font-size:20px;font-weight:bold;margin:0 0 8px 0;">Hi ${admin.name},</p>
        <p style="margin:0;">Your password has been changed by the Super Admin.</p>
        ${tipBox('Please contact the Super Admin to get your new password.', 'warning')}
      `,
    }),
  });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendSlugEmail,
  sendAdminSelfResetNotifyToSuperAdmins,
  sendAdminSlugRecoveryNotifyToSuperAdmins,
  sendPasswordChangedBySuperAdminNotify,
};