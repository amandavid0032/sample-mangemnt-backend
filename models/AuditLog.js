const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: {
      values: [
        'SAMPLE_CREATED',
        'SAMPLE_UPDATED',
        'SAMPLE_STATUS_CHANGED',
        'SAMPLE_ACCEPTED',
        'SAMPLE_SUBMITTED',
        'SAMPLE_ANALYSED',
        'SAMPLE_PUBLISHED',
        'SAMPLE_ARCHIVED',
        'SAMPLE_RESTORED',
        'USER_CREATED',
        'USER_UPDATED',
        'USER_STATUS_CHANGED',
        'USER_LOGIN',
        'REPORT_GENERATED'
      ],
      message: 'Invalid action type'
    }
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Performer information is required']
  },
  sampleRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sample',
    default: null
  },
  userRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

auditLogSchema.index({ action: 1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ sampleRef: 1 });
auditLogSchema.index({ createdAt: -1 });

auditLogSchema.statics.logAction = async function(data) {
  return await this.create(data);
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
