export const processCompletedPayment = async (
  reference,
  verifiedAmount = null,
  gatewayRef = null,
  provider = null
) => {

  const client = await getClient();

  try {

    await client.query('BEGIN');

    console.log('====================================');
    console.log('[PAYMENT PROCESSING STARTED]');
    console.log('REFERENCE:', reference);
    console.log('AMOUNT:', verifiedAmount);
    console.log('====================================');

    // =====================================================
    // LOCK TRANSACTION ROW
    // =====================================================

    const { rows: lockRows } = await client.query(
      `
        SELECT *
        FROM transactions
        WHERE reference = $1
        FOR UPDATE
      `,
      [reference]
    );

    if (lockRows.length === 0) {

      await client.query('ROLLBACK');

      throw new Error(
        `REFERENCE_NOT_FOUND: ${reference}`
      );
    }

    const transaction = lockRows[0];

    console.log(
      '[TRANSACTION FOUND]',
      transaction.id
    );

    // =====================================================
    // IDEMPOTENCY CHECK
    // =====================================================

    if (transaction.status === 'completed') {

      await client.query('ROLLBACK');

      console.warn(
        '[DUPLICATE PAYMENT BLOCKED]',
        reference
      );

      return {
        isDuplicate: true,
        transaction
      };
    }

    // =====================================================
    // VERIFY AMOUNT
    // =====================================================

    if (verifiedAmount !== null) {

      const storedAmount = parseFloat(
        transaction.amount
      );

      const diff = Math.abs(
        storedAmount - verifiedAmount
      );

      if (diff > 0.01) {

        await client.query('ROLLBACK');

        throw new Error(
          `AMOUNT_MISMATCH: Expected ${storedAmount} but got ${verifiedAmount}`
        );
      }
    }

    // =====================================================
    // MARK TRANSACTION COMPLETED
    // =====================================================

    const { rows: updatedTxRows } = await client.query(
      `
        UPDATE transactions
        SET
          status = 'completed',
          provider_reference = COALESCE($1, provider_reference),
          gateway_reference = COALESCE($1, gateway_reference),
          payment_provider = COALESCE($2, payment_provider),
          updated_at = CURRENT_TIMESTAMP
        WHERE reference = $3
        RETURNING *
      `,
      [
        gatewayRef,
        provider,
        reference
      ]
    );

    const completedTx = updatedTxRows[0];

    console.log(
      '[TRANSACTION COMPLETED]',
      completedTx.reference
    );

    // =====================================================
    // HANDLE TRANSACTION TYPES
    // =====================================================

    if (
      completedTx.type === 'deposit' ||
      completedTx.type === 'wallet_topup' ||
      completedTx.type === 'contribution'
    ) {

      // =========================================
      // SAVINGS PLAN CONTRIBUTION
      // =========================================

      if (completedTx.plan_id) {

        await client.query(
          `
            UPDATE savings_plans
            SET
              current_amount =
                COALESCE(current_amount, 0) + $1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `,
          [
            completedTx.amount,
            completedTx.plan_id
          ]
        );

        console.log(
          '[PLAN UPDATED]',
          completedTx.plan_id
        );

      } else {

        // =========================================
        // WALLET FUNDING
        // =========================================

        await client.query(
          `
            UPDATE users
            SET
              available_balance =
                COALESCE(available_balance, 0) + $1,

              wallet_balance =
                COALESCE(wallet_balance, 0) + $1

            WHERE id = $2
          `,
          [
            completedTx.amount,
            completedTx.user_id
          ]
        );

        console.log(
          `[WALLET CREDITED] USER ${completedTx.user_id} +₦${completedTx.amount}`
        );

        // =========================================
        // FETCH UPDATED BALANCE
        // =========================================

        const { rows: updatedUser } =
          await client.query(
            `
              SELECT
                wallet_balance,
                available_balance
              FROM users
              WHERE id = $1
            `,
            [completedTx.user_id]
          );

        console.log(
          '[UPDATED USER BALANCE]',
          updatedUser[0]
        );

        // =========================================
        // CREATE LEDGER ENTRY
        // =========================================

        await createWalletLedgerEntry(
          client,
          completedTx.user_id,
          'credit',
          completedTx.amount,
          reference,
          'Wallet Top-up'
        );
      }

    } else if (
      completedTx.type === 'membership'
    ) {

      await client.query(
        `
          UPDATE users
          SET has_paid_membership = TRUE
          WHERE id = $1
        `,
        [completedTx.user_id]
      );

      console.log(
        '[MEMBERSHIP ACTIVATED]'
      );

    } else if (
      completedTx.type === 'clearance'
    ) {

      const { rows: planRows } =
        await client.query(
          `
            SELECT *
            FROM savings_plans
            WHERE id = $1
          `,
          [completedTx.plan_id]
        );

      if (planRows.length > 0) {

        const plan = planRows[0];

        const payoutDate = new Date(
          Date.now() + (7 * 24 * 60 * 60 * 1000)
        );

        await client.query(
          `
            UPDATE savings_plans
            SET
              status = 'pending_settlement',
              clearance_paid = TRUE,
              clearance_date = CURRENT_TIMESTAMP,
              payout_date = $1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `,
          [
            payoutDate,
            completedTx.plan_id
          ]
        );

        const expectedAmount =
          plan.plan_name === 'CREST'
            ? 96000
            : plan.plan_name === 'SILVER'
            ? 150000
            : plan.target_amount;

        const { rows: payoutRows } =
          await client.query(
            `
              SELECT *
              FROM payouts
              WHERE plan_id = $1
            `,
            [completedTx.plan_id]
          );

        if (payoutRows.length === 0) {

          await client.query(
            `
              INSERT INTO payouts
              (
                user_id,
                plan_id,
                amount,
                payout_type,
                status
              )
              VALUES
              (
                $1,
                $2,
                $3,
                'cash',
                'pending'
              )
            `,
            [
              completedTx.user_id,
              completedTx.plan_id,
              expectedAmount
            ]
          );
        }

        console.log(
          '[CLEARANCE PAYMENT PROCESSED]'
        );
      }
    }

    // =====================================================
    // COMMIT
    // =====================================================

    await client.query('COMMIT');

    console.log(
      '[PAYMENT PROCESS COMPLETED SUCCESSFULLY]'
    );

    return {
      isDuplicate: false,
      transaction: completedTx
    };

  } catch (error) {

    await client.query('ROLLBACK');

    console.error(
      '[processCompletedPayment ERROR]',
      error
    );

    throw error;

  } finally {

    client.release();
  }
};
