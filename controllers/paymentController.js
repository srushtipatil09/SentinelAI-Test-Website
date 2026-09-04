const processPayment = (sdk) => async (req, res, next) => {
  try {
    const { amount = 299.99, currency = 'USD', paymentMethod = 'credit_card' } = req.body;

    // Requirement: Generate "Payment Initiated" log
    sdk.captureLog('INFO', 'Payment Initiated', {
      amount,
      currency,
      paymentMethod,
      timestamp: new Date().toISOString()
    });

    // Run payment service within a trace child span
    const paymentResult = await sdk.startSpan(
      'payment.service.gateway_charge',
      async () => {
        // Simulate network processing delay (100-300ms)
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Requirement: Randomly return 500 Internal Server Error 30% of the time
        const isFailure = Math.random() < 0.3;

        if (isFailure) {
          const paymentError = new Error('Payment Gateway Processing Error: Card Authorization Declined');
          // Requirement: Generate "Payment Failed" log
          sdk.captureLog('ERROR', 'Payment Failed', {
            amount,
            currency,
            reason: paymentError.message,
            errorCode: 'GATEWAY_DECLINED'
          });
          throw paymentError;
        }

        return {
          transactionId: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          status: 'completed',
          chargedAmount: amount
        };
      },
      req.sentinel ? req.sentinel.traceId : (req.observeAi ? req.observeAi.traceId : null)
    );

    return res.status(200).json({
      message: 'Payment processed successfully',
      payment: paymentResult
    });
  } catch (err) {
    // Exception capture
    sdk.captureException(err, false, {
      component: 'paymentGateway',
      amount: req.body.amount
    });

    return res.status(500).json({
      error: 'Payment Processing Failed',
      message: err.message
    });
  }
};

module.exports = { processPayment };
