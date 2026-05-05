import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Send SMS using Termii API
 * @param {string} to - Destination phone number (e.g., 2348012345678)
 * @param {string} sms - Message content
 * @returns {Promise<Object>} API Response
 */
export const sendTermiiSMS = async (to, sms) => {
  try {
    const apiKey = process.env.TERMII_API_KEY;
    const baseUrl = process.env.TERMII_BASE_URL || 'https://v3.api.termii.com';
    const from = process.env.TERMII_SENDER_ID || 'N-Alert';

    if (!apiKey) {
      console.warn('[Termii] API key not found. SMS not sent.');
      return null;
    }

    // Ensure phone number starts with country code for Termii (usually requires e.g. 234...)
    // If the number starts with '0', replace it with '234'
    let formattedPhone = to.replace(/[-()\s]/g, ''); // strip formatting
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '234' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    const payload = {
      to: formattedPhone,
      from: from,
      sms: sms,
      type: 'plain',
      channel: 'generic',
      api_key: apiKey,
    };

    const response = await axios.post(`${baseUrl}/api/sms/send`, payload);
    
    console.log(`[Termii SMS] Sent successfully to ${formattedPhone}. Message ID: ${response.data.message_id}`);
    return response.data;
  } catch (error) {
    console.error('[Termii SMS] Failed to send SMS:', error.response?.data || error.message);
    throw new Error('Failed to send SMS via Termii');
  }
};
