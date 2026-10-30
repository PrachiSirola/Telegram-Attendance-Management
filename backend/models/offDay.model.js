const mongoose = require('mongoose');
const offDaySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    date: { type: Date, required: true, index: true },
    type: { type: String, enum: ['weekly_off', 'festival', 'other'], required: true },
    label: { type: String, trim: true, default: '' },
    scope: { type: String, enum: ['org', 'department', 'employee'], required: true, default: 'org' },
    departments: [{ type: String, trim: true }], 
    employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }], 
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

offDaySchema.index({ organizationId: 1, date: 1 });

const DEFAULT_LABELS = { weekly_off: 'Weekly Off', festival: 'Festival Leave', other: 'Other' };
offDaySchema.methods.displayLabel = function () {
  return this.label?.trim() || DEFAULT_LABELS[this.type] || 'Day Off';
};
offDaySchema.methods.coversEmployee = function (employee) {
  if (this.scope === 'org') return true;
  if (this.scope === 'department') return this.departments.includes(employee.department);
  if (this.scope === 'employee') {
    return this.employeeIds.some((id) => String(id) === String(employee._id));
  }
  return false;
};

module.exports = mongoose.model('OffDay', offDaySchema);