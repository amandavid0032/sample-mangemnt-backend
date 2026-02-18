module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/jpg'],

  // NEW Lifecycle: COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
  lifecycleStatuses: ['COLLECTED', 'FIELD_TESTED', 'LAB_TESTED', 'PUBLISHED', 'ARCHIVED'],

  // Test locations - which parameters are tested where
  testLocations: ['FIELD', 'LAB'],

  userRoles: ['ADMIN', 'TEAM_MEMBER'],
  parameterStatuses: ['ACCEPTABLE', 'PERMISSIBLE', 'NOT_ACCEPTABLE'],
  parameterTypes: ['RANGE', 'MAX', 'ENUM', 'TEXT'],
  standardVersion: 'IS10500-2012'
};
