const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: {
      values: [
        // Sample lifecycle actions (FIELD + LAB workflow)
        'SAMPLE_CREATED',
        'SAMPLE_CREATED_WITH_FIELD_TEST',
        'SAMPLE_FIELD_TESTED',
        'SAMPLE_LAB_TESTED',
        'SAMPLE_LAB_TESTED_AND_PUBLISHED',
        'SAMPLE_PUBLISHED',
        'SAMPLE_ARCHIVED',
        'SAMPLE_RESTORED',
        'SAMPLE_PDF_DOWNLOADED',
        // User actions
        'USER_CREATED',
        'USER_UPDATED',
        'USER_STATUS_CHANGED',
        'USER_DELETED',
        'USER_LOGIN',
        'USER_LOGOUT',
        'PROFILE_UPDATED',
        // Other actions
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
