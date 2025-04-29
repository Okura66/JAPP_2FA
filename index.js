<!DOCTYPE html>
<html lang="fr">

<head>
    <meta charset="UTF-8">
    <title>Widget Téléphone 2FA</title>
    <!-- Charger l'API Custom Widget de JotForm -->
    <script src="//js.jotform.com/JotFormCustomWidget.min.js"></script>

    <!-- Charger intl-tel-input CSS et JS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@24.7.0/build/css/intlTelInput.css">
    <script src="https://cdn.jsdelivr.net/npm/intl-tel-input@24.7.0/build/js/intlTelInput.min.js"></script>

    <!-- Styles personnalisés -->
    <style>
        .error-message {
            color: red;
            font-size: 0.9em;
            margin-top: 5px;
        }
        #phoneInput {
            width: 100%;
            height: 40px;
            border: 1px solid #d3d3d3;
        }
        .iti__search-input {
            width: 100%;
            border-width: 0;
            border-radius: 3px;
            height: 35px;
        }
        #code2faSection {
            margin-top: 15px;
            display: none;
        }
        #code2faInput {
            width: 120px;
            margin-right: 10px;
        }
        #code2faError {
            color: red;
            font-size: 0.9em;
            margin-top: 5px;
        }
        #code2faSuccess {
            color: green;
            font-size: 0.9em;
            margin-top: 5px;
        }
    </style>
</head>

<body>
    <div id="main">
        <input type="tel" id="phoneInput" />
        <div id="errorMsg" class="error-message"></div>

        <div id="code2faSection">
            <label for="code2faInput">Code 2FA :</label>
            <input type="text" id="code2faInput" maxlength="8" autocomplete="one-time-code" />
            <button type="button" id="verify2faBtn">Vérifier</button>
            <div id="code2faError" class="error-message"></div>
            <div id="code2faSuccess"></div>
        </div>
    </div>

    <script type="module">
    import * as i18n from './i18n.js';

    // Envoie un code 2FA via SMSAPI
    async function envoyerCode2FA(token, phoneNumber, sender = null, content = null, fast = 1) {
        const url = 'https://api.smsapi.com/mfa/codes';
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const payload = { phone_number: phoneNumber, fast: String(fast) };
        if (sender) payload.from = sender;
        if (content) payload.content = content;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            if (response.status === 200 || response.status === 201) {
                const data = await response.json();
                return { id: data.id || null };
            }
        } catch (e) {
            console.error('Erreur lors de l\'envoi du code 2FA :', e);
        }
        return { id: null };
    }

    // Vérifie un code 2FA via SMSAPI
    async function verifierCode2FA(token, codeId, code) {
        const url = 'https://api.smsapi.com/mfa/codes/verifications';
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const payload = { id: codeId, code };
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            if (response.status === 204) return 'valid';
            if (response.status === 404) return 'wrong';
            if (response.status === 408) return 'expired';
        } catch (e) {
            console.error('Erreur lors de la vérification du code 2FA :', e);
        }
        return null;
    }

    JFCustomWidget.subscribe('ready', () => {
        const phoneInput      = document.getElementById('phoneInput');
        const errorMsg        = document.getElementById('errorMsg');
        const code2faSection  = document.getElementById('code2faSection');
        const code2faInput    = document.getElementById('code2faInput');
        const verify2faBtn    = document.getElementById('verify2faBtn');
        const code2faError    = document.getElementById('code2faError');
        const code2faSuccess  = document.getElementById('code2faSuccess');

        // Paramètres du widget
        const initialCountry    = JFCustomWidget.getWidgetSetting('InitialCountry') || 'auto';
        const countrySearch     = JFCustomWidget.getWidgetSetting('CountrySearch') === 'true';
        const customErrorMessage = JFCustomWidget.getWidgetSetting('ErrorMessage') || 'Veuillez saisir un numéro de téléphone valide.';
        const language          = JFCustomWidget.getWidgetSetting('Language') || 'fr';
        const countryOrder      = (JFCustomWidget.getWidgetSetting('CountryOrder') || '').split(',').filter(Boolean);
        const smsapiToken       = JFCustomWidget.getWidgetSetting('SMSAPIToken') || '';
        const smsapiSender      = JFCustomWidget.getWidgetSetting('SMSAPISender') || null;
        const smsapiContent     = JFCustomWidget.getWidgetSetting('SMSAPIContent') || null;

        // Initialisation intl-tel-input
        const iti = window.intlTelInput(phoneInput, {
            utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@24.7.0/build/js/utils.js',
            initialCountry,
            useFullscreenPopup: false,
            countrySearch,
            fixDropdownWidth: true,
            strictMode: true,
            countryOrder,
            validationNumberType: 'MOBILE',
            dropdownContainer: document.body,
            i18n: i18n[language] || {}
        });

        let last2faId       = null;
        let last2faPhone    = '';
        let twoFAValidated  = false;

        function resetErrors() {
            errorMsg.textContent = '';
            code2faError.textContent = '';
            code2faSuccess.textContent = '';
        }
        function hide2FASection() {
            code2faSection.style.display = 'none';
            code2faInput.value = '';
        }
        function sendData(valid, value = '') {
            JFCustomWidget.sendData({ valid, value });
        }

        // Ajuster la taille du widget
        JFCustomWidget.requestFrameResize({ height: 120 });
        phoneInput.addEventListener('open:countrydropdown', () => JFCustomWidget.requestFrameResize({ height: 350 }));
        phoneInput.addEventListener('close:countrydropdown', () => JFCustomWidget.requestFrameResize({ height: 120 }));
        ['change','keyup','focus'].forEach(evt => phoneInput.addEventListener(evt, resetErrors));

        // Gestion du flux 2FA
        phoneInput.addEventListener('input', async () => {
            resetErrors();
            const fullNumber = iti.getNumber();

            if (!iti.isValidNumber()) {
                hide2FASection();
                twoFAValidated = false;
                sendData(false);
                return;
            }

            if (!smsapiToken) {
                hide2FASection();
                twoFAValidated = true;
                sendData(true, fullNumber);
                return;
            }

            if (fullNumber !== last2faPhone) {
                hide2FASection();
                twoFAValidated = false;
                last2faPhone = fullNumber;

                const { id } = await envoyerCode2FA(smsapiToken, fullNumber, smsapiSender, smsapiContent);
                if (id) {
                    last2faId = id;
                    code2faSection.style.display = 'block';
                    code2faSuccess.textContent = 'Un code 2FA a été envoyé par SMS.';
                    JFCustomWidget.requestFrameResize({ height: 200 });
                } else {
                    errorMsg.textContent = 'Erreur lors de l\'envoi du code 2FA.';
                    sendData(false);
                }
            }
        });

        // Vérification du code 2FA
        verify2faBtn.addEventListener('click', async () => {
            code2faError.textContent   = '';
            code2faSuccess.textContent = '';
            const code = code2faInput.value.trim();
            if (!code) {
                code2faError.textContent = 'Veuillez saisir le code reçu.';
                return;
            }
            verify2faBtn.disabled = true;
            code2faInput.disabled = true;

            const result = await verifierCode2FA(smsapiToken, last2faId, code);
            if (result === 'valid') {
                code2faSuccess.textContent = 'Téléphone authentifié.';
                twoFAValidated = true;
                sendData(true, last2faPhone);
            } else if (result === 'wrong') {
                code2faError.textContent = 'Code incorrect.';
                sendData(false);
            } else if (result === 'expired') {
                code2faError.textContent = 'Code expiré.';
                hide2FASection();
                last2faPhone = '';
                twoFAValidated = false;
                sendData(false);
            } else {
                code2faError.textContent = 'Erreur de vérification.';
                sendData(false);
            }

            verify2faBtn.disabled = false;
            code2faInput.disabled = false;
        });

        // Soumission du widget
        JFCustomWidget.subscribe('submit', () => {
            const fullNumber = iti.getNumber();
            if (!iti.isValidNumber()) {
                errorMsg.textContent = customErrorMessage;
                return JFCustomWidget.sendSubmit({ valid: false, value: '' });
            }
            if (smsapiToken && !twoFAValidated) {
                errorMsg.textContent = 'Veuillez valider le code 2FA.';
                return JFCustomWidget.sendSubmit({ valid: false, value: '' });
            }
            JFCustomWidget.sendSubmit({ valid: true, value: fullNumber });
        });
    });
    </script>
</body>

</html>