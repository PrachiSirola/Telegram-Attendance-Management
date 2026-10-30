require('dotenv').config();
const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

const als = new AsyncLocalStorage();
const enabled = process.env.PERF_TRACE === '1';

const QUERY_OPS = [
  'find', 'findOne', 'countDocuments', 'estimatedDocumentCount', 'distinct',
  'findOneAndUpdate', 'findOneAndDelete', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
];

const now = () => Number(process.hrtime.bigint()) / 1e6;

function record(label, startedAt) {
  const s = als.getStore();
  if (!s || startedAt == null) return;
  s.n += 1;
  s.ms += now() - startedAt;
  s.ops.push(label);
}
function install() {
  if (!enabled) return;
  mongoose.plugin((schema) => {
    QUERY_OPS.forEach((op) => {
      schema.pre(op, function () {
        this.__perfT = now();
      });
      schema.post(op, function () {
        record(`${this.model?.modelName || '?'}.${op}`, this.__perfT);
      });
    });
    schema.pre('aggregate', function () {
      this.__perfT = now();
    });
    schema.post('aggregate', function () {
      record(`${this._model?.modelName || '?'}.aggregate`, this.__perfT);
    });
    schema.pre('save', function () {
      this.$locals.__perfT = now();
    });
    schema.post('save', function () {
      record(`${this.constructor?.modelName || '?'}.save`, this.$locals.__perfT);
    });
  });
}

function middleware(req, res, next) {
  if (!enabled) return next();
  const store = { n: 0, ms: 0, ops: [] };
  const t0 = now();
  const writeHead = res.writeHead;
  res.writeHead = function patched(...args) {
    if (!res.headersSent) {
      res.setHeader(
        'Server-Timing',
        `db;dur=${store.ms.toFixed(1)};desc="${store.n} queries", total;dur=${(now() - t0).toFixed(1)}`
      );
    }
    return writeHead.apply(this, args);
  };
  res.on('finish', () => {
    console.log(
      `[perf] ${(now() - t0).toFixed(0)}ms ${req.method} ${req.originalUrl} | db ${store.n} queries ${store.ms.toFixed(0)}ms | ${store.ops.join(', ')}`
    );
  });
  als.run(store, next);
}

module.exports = { install, middleware, enabled };