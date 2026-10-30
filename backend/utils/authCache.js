const mongoose = require('mongoose');
const TTL_MS = 30 * 1000;
const admins = new Map();
const orgs = new Map(); 
const pending = new Map(); 
let allOrgs = null; 

const fresh = (e) => e && Date.now() - e.at < TTL_MS;

function dedupe(key, load) {
  if (pending.has(key)) return pending.get(key);
  const p = load().finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

function clear() {
  admins.clear();
  orgs.clear();
  allOrgs = null;
}

async function getAdmin(id) {
  const Admin = require('../models/admin.model');
  const key = String(id);
  let hit = admins.get(key);
  if (!fresh(hit)) {
    const v = await dedupe(`a:${key}`, () => Admin.findById(key).select('-password').lean());
    if (!v) return null; 
    hit = { v, at: Date.now() };
    admins.set(key, hit);
  }
  return Admin.hydrate({ ...hit.v });
}

async function getOrg(id) {
  const Organization = require('../models/organization.model');
  const key = String(id);
  let hit = orgs.get(key);
  if (!fresh(hit)) {
    const v = await dedupe(`o:${key}`, () => Organization.findById(key).lean());
    if (!v) return null;
    hit = { v, at: Date.now() };
    orgs.set(key, hit);
  }
  return Organization.hydrate({ ...hit.v });
}
async function getAllOrgs() {
  const Organization = require('../models/organization.model');
  if (!fresh(allOrgs)) {
    const v = await dedupe('all', () => Organization.find({}, '_id timezone name slug').lean());
    allOrgs = { v, at: Date.now() };
  }
  return allOrgs.v;
}

const WRITE_OPS = [
  'save', 'updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne',
  'findOneAndDelete', 'findOneAndRemove', 'deleteOne', 'deleteMany',
];

function install() {
  mongoose.plugin((schema) => {
    const bust = function bust() {
      const Model = this.model && this.model.modelName ? this.model : this.constructor;
      const name = Model?.modelName;
      if (name === 'Admin' || name === 'Organization') clear();
    };
    WRITE_OPS.forEach((op) => {
      if (op === 'save') {
        schema.post('save', bust);
      } else if (op === 'deleteOne' || op === 'updateOne') {
        schema.post(op, { query: true, document: false }, bust);
      } else {
        schema.post(op, bust);
      }
    });
  });
}

module.exports = { install, getAdmin, getOrg, getAllOrgs, clear };