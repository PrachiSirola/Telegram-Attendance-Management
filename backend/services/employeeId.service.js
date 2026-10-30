const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');
const EmployeeIdCounter = require('../models/employeeIdCounter.model');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MIN_DIGITS = 3;


function lettersOf(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function* prefixCandidates(name) {
  let letters = lettersOf(name);
  while (letters.length < 3) letters += 'X';
  const base = letters.slice(0, 3);
  const seen = new Set([base]);
  yield base;
  for (const ch of [...letters.slice(3), ...LETTERS]) {
    const c = base.slice(0, 2) + ch;
    if (!seen.has(c)) {
      seen.add(c);
      yield c;
    }
  }
  for (const b of LETTERS) {
    for (const ch of LETTERS) {
      const c = base[0] + b + ch;
      if (!seen.has(c)) {
        seen.add(c);
        yield c;
      }
    }
  }
}

const pad = (n) => String(n).padStart(MIN_DIGITS, '0');

async function highestExistingNumber(organizationId) {
  const rows = await Employee.find({ organizationId }).select('employeeId').lean();
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)\s*$/.exec(String(r.employeeId || ''));
    if (m && m[1].length <= 6) max = Math.max(max, Number(m[1]));
  }
  return max;
}

const isDuplicateKey = (e) => e && (e.code === 11000 || /E11000|duplicate key/i.test(String(e.message)));

async function getOrCreateCounter(organizationId) {
  const existing = await EmployeeIdCounter.findOne({ organizationId });
  if (existing) return existing;

  const org = await Organization.findById(organizationId).select('name');
  if (!org) {
    const e = new Error('Organization not found');
    e.statusCode = 404;
    throw e;
  }
  const seq = await highestExistingNumber(organizationId);
  for (const prefix of prefixCandidates(org.name)) {
    const used = await Employee.exists({
      organizationId: { $ne: organizationId },
      employeeId: new RegExp(`^${prefix}\\d+$`),
    });
    if (used) continue;
    try {
      return await EmployeeIdCounter.create({ organizationId, prefix, seq });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      const mine = await EmployeeIdCounter.findOne({ organizationId });
      if (mine) return mine;
    }
  }
  throw new Error('No free employee ID prefix is available');
}

async function nextEmployeeId(organizationId) {
  await getOrCreateCounter(organizationId);
  const c = await EmployeeIdCounter.findOneAndUpdate(
    { organizationId },
    { $inc: { seq: 1 } },
    { new: true }
  );
  if (!c) throw new Error('Employee ID counter is unavailable');
  return `${c.prefix}${pad(c.seq)}`;
}


async function peekNextEmployeeId(organizationId) {
  const c = await getOrCreateCounter(organizationId);
  return `${c.prefix}${pad(c.seq + 1)}`;
}

async function initEmployeeIdCounters() {
  const orgs = await Organization.find({}).select('_id').sort({ createdAt: 1 }).lean();
  let created = 0;
  for (const o of orgs) {
    const had = await EmployeeIdCounter.exists({ organizationId: o._id });
    if (!had) {
      await getOrCreateCounter(o._id);
      created += 1;
    }
  }
  return created;
}

module.exports = {
  nextEmployeeId,
  peekNextEmployeeId,
  initEmployeeIdCounters,
  prefixCandidates,
  getOrCreateCounter,
};
