<!doctype html>
<html lang="${lang!"en"}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${msg("misActionUnavailableTitle")}</title>
    <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body class="mis-login-page">
    <main class="login-shell">
        <section class="promo-panel" aria-label="Account security">
            <div class="promo-card">
                <div class="promo-copy">
                    <h1>Keep your account secure</h1>
                    <p>Account activation and password reset links are private. Follow the instructions below to continue safely.</p>
                </div>
            </div>
        </section>
        <section class="form-panel" aria-labelledby="reset-link-title">
            <div class="login-form-wrap">
                <img class="brand-logo" src="${url.resourcesPath}/img/ExecuTrain_logo.png" alt="ExecuTrain" width="160" height="40">
                <h2 id="reset-link-title">${msg("misActionUnavailableTitle")}</h2>
                <div class="login-message login-message-error" role="alert">
                    <#if message?? && message.summary?has_content>
                        ${kcSanitize(message.summary)?no_esc}
                    <#else>
                        ${msg("misActionUnavailableMessage")}
                    </#if>
                </div>
                <#if !(skipLink??) && (url.loginUrl)?has_content>
                    <a class="back-to-login" href="${url.loginUrl}">Back to Login</a>
                </#if>
            </div>
        </section>
    </main>
</body>
</html>
