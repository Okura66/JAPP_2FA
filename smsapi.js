// smsapi.js

/**
 * Envoie un code 2FA via l’API SMSAPI
 */
export async function envoyerCode2FA(token, phoneNumber, sender = null, content = null, fast = 1) {
  const url = 'https://api.smsapi.com/mfa/codes';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const payload = { phone_number: phoneNumber, fast: String(fast) };
  if (sender) payload.from = sender;
  if (content) payload.content = content;

  console.log('[smsapi.js] Envoi du code 2FA - payload:', payload);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    console.log('[smsapi.js] Réponse status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('[smsapi.js] Code envoyé - ID:', data.id);
      return { id: data.id || null };
    }
  } catch (e) {
    console.error('[smsapi.js] Erreur lors de l\'envoi du code 2FA :', e);
  }
  return { id: null };
}

/**
 * Vérifie un code 2FA via l’API SMSAPI
 */
export async function verifierCode2FA(token, codeId, code) {
  const url = 'https://api.smsapi.com/mfa/codes/verifications';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const payload = { id: codeId, code };

  console.log('[smsapi.js] Vérification du code - payload:', payload);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    console.log('[smsapi.js] Réponse vérification:', response.status);

    if (response.status === 204) return 'valid';
    if (response.status === 404) return 'wrong';
    if (response.status === 408) return 'expired';
  } catch (e) {
    console.error('[smsapi.js] Erreur lors de la vérification du code :', e);
  }

  return null;
}
