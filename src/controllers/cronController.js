const { generateMonthlyInvoices } = require('../workers/billingCron');

const triggerBilling = async (req, res, next) => {
    try {
        const result = await generateMonthlyInvoices();
        
        if (result.success) {
            res.status(200).json({
                message: result.message,
                generatedCount: result.generatedCount
            });
        } else {
            res.status(500).json({
                message: 'Failed to generate monthly invoices',
                error: result.error
            });
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    triggerBilling
};
