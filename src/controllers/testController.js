const testService = require('../services/testService');

exports.testDatabaseConnection = async (req, res) => {
  try {
    const data = await testService.checkDatabaseStatus();
    res.status(200).json({
      success: true,
      message: 'Database connection successful!',
      data: data
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
};
