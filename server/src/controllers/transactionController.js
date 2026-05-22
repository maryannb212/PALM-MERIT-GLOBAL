export const flutterwaveWebhook = async (req, res) => {
  const secret = getFlutterwaveSecret();

  try {
    // =====================================================
    // GET WEBHOOK DATA
    // =====================================================

    const signature = req.headers['verif-hash'];

    const payload = req.body;

    console.log('============== FLUTTERWAVE WEBHOOK ==============');
    console.log(JSON.stringify(payload, null, 2));

    // =====================================================
    // VERIFY SIGNATURE
    // =====================================================

    if (
      !isMockMode() &&
      process.env.FLUTTERWAVE_WEBHOOK_HASH &&
      signature !== process.env.FLUTTERWAVE_WEBHOOK_HASH
    ) {
      console.warn('[Flutterwave Webhook] Invalid signature');

      await logWebhookEvent({
        source: 'flutterwave',
        reference: null,
        eventType: payload.event || 'webhook',
        payload,
        signatureOk: false,
        status: 'rejected',
        note: 'Invalid webhook signature'
      });

      return res.status(401).send('Unauthorized');
    }

    // =====================================================
    // EXTRACT PAYMENT DETAILS
    // =====================================================

    const transactionId =
      payload.id ||
      payload.data?.id;

    const status =
      payload.status ||
      payload.data?.status;

    const amount =
      Number(payload.amount) ||
      Number(payload.data?.amount) ||
      0;

    const email =
      payload.customer?.email ||
      payload.data?.customer?.email ||
      null;

    const flwRef =
      payload.flw_ref ||
      payload.data?.flw_ref ||
      null;

    const txRef =
      payload.tx_ref ||
      payload.data?.tx_ref ||
      null;

    const reference =
      txRef ||
      flwRef ||
      `FLW-${Date.now()}`;

    console.log('REFERENCE:', reference);
    console.log('TRANSACTION ID:', transactionId);
    console.log('EMAIL:', email);
    console.log('STATUS:', status);
    console.log('AMOUNT:', amount);

    // =====================================================
    // ONLY PROCESS SUCCESSFUL PAYMENTS
    // =====================================================

    if (status !== 'successful') {
      console.log('[Flutterwave Webhook] Ignored non-successful payment');

      await logWebhookEvent({
        source: 'flutterwave',
        reference,
        eventType: payload.event || 'webhook',
        payload,
        signatureOk: true,
        status: 'ignored',
        note: `Transaction status: ${status}`
      });

      return res.status(200).send('Ignored');
    }

    // =====================================================
    // VERIFY PAYMENT WITH FLUTTERWAVE
    // =====================================================

    let verifiedAmount = amount;
    let gatewayRef = flwRef;

    if (!isMockMode()) {
      const verified = await verifyWithFlutterwave(
        transactionId,
        secret
      );

      verifiedAmount = Number(verified.amount);
      gatewayRef = verified.gatewayRef || flwRef;
    }

    console.log('VERIFIED AMOUNT:', verifiedAmount);

    // =====================================================
    // CHECK DUPLICATE TRANSACTION
    // =====================================================

    const { rows: existingTx } = await query(
      `
        SELECT *
        FROM transactions
        WHERE reference = $1
      `,
      [reference]
    );

    if (existingTx.length > 0) {
      console.log('[Flutterwave Webhook] Duplicate transaction');

      await logWebhookEvent({
        source: 'flutterwave',
        reference,
        eventType: payload.event || 'charge.completed',
        payload,
        signatureOk: true,
        status: 'duplicate',
        note: 'Duplicate transaction ignored'
      });

      return res.status(200).send('Duplicate transaction');
    }

    // =====================================================
    // FIND USER
    // =====================================================

    let userId = null;

    // -----------------------------------------
    // FIND FROM VA REFERENCE
    // Example: VA-12-1727272727
    // -----------------------------------------

    if (txRef && txRef.startsWith('VA-')) {
      const parts = txRef.split('-');

      if (parts.length >= 2) {
        userId = parts[1];
      }
    }

    // -----------------------------------------
    // FALLBACK TO EMAIL
    // -----------------------------------------

    if (!userId && email) {
      const { rows: userRows } = await query(
        `
          SELECT id
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email]
      );

      if (userRows.length > 0) {
        userId = userRows[0].id;
      }
    }

    // =====================================================
    // USER NOT FOUND
    // =====================================================

    if (!userId) {
      console.error('[Flutterwave Webhook] User not found');

      await logWebhookEvent({
        source: 'flutterwave',
        reference,
        eventType: payload.event || 'charge.completed',
        payload,
        signatureOk: true,
        status: 'error',
        note: 'User not found'
      });

      return res.status(200).send('User not found');
    }

    console.log('USER ID:', userId);

    // =====================================================
    // CREATE TRANSACTION
    // =====================================================

    const transaction = await createTransaction(
      userId,
      null,
      'wallet_topup',
      verifiedAmount,
      reference,
      'flutterwave'
    );

    console.log('[Flutterwave Webhook] Transaction created');

    // =====================================================
    // CREDIT USER WALLET
    // =====================================================

    await processCompletedPayment(
      reference,
      verifiedAmount,
      gatewayRef,
      'flutterwave'
    );

    console.log('[Flutterwave Webhook] Wallet credited');

    // =====================================================
    // CREATE NOTIFICATION
    // =====================================================

    await createNotification(
      userId,
      'PAYMENT',
      'Payment Successful',
      `Your Flutterwave payment of ₦${Number(
        verifiedAmount
      ).toLocaleString()} was successful.`
    ).catch(() => {});

    // =====================================================
    // LOG SUCCESS
    // =====================================================

    await logWebhookEvent({
      source: 'flutterwave',
      reference,
      eventType: payload.event || 'charge.completed',
      payload,
      signatureOk: true,
      status: 'processed',
      note: `Wallet credited with ₦${verifiedAmount}`
    });

    return res.status(200).send('Webhook processed');

  } catch (error) {

    console.error('[Flutterwave Webhook] ERROR:', error);

    await logWebhookEvent({
      source: 'flutterwave',
      reference: req.body?.tx_ref || req.body?.data?.tx_ref || null,
      eventType: req.body?.event || 'charge.completed',
      payload: req.body,
      signatureOk: true,
      status: 'error',
      note: error.message
    });

    return res.status(500).send('Webhook error');
  }
};
