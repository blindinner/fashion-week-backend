import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

router.post('/checkout/payment/success', async (req, res) => {
  try {
    const {
      bookingId,
      processId,
      growinConfirmationCode,
      payment_sum,
      payment_method,
      full_name,
      raw_payload,
    } = req.body || {};

    if (!growinConfirmationCode) {
      return res.status(400).json({ ok: false, error: 'Missing confirmation code' });
    }

    const row = {
      confirmation_number: String(growinConfirmationCode),
      booking_id: bookingId ?? null,
      process_id: processId ?? null,
      payment_sum: payment_sum != null ? Number(payment_sum) : null,
      payment_method: payment_method ?? null,
      full_name: full_name ?? null,
      raw_payload: raw_payload ?? null,
    };

    const { data, error } = await supabase
      .from('transactions')
      .upsert(row, { onConflict: 'confirmation_number' })
      .select()
      .single();

    if (error) throw error;

    return res.json({ ok: true, id: data.id });
  } catch (e) {
    console.error('[payment/success] failed:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;