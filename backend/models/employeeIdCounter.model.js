const mongoose = require('mongoose');
const employeeIdCounterSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    prefix: { type: String, required: true, unique: true, uppercase: true, trim: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeIdCounter', employeeIdCounterSchema);
