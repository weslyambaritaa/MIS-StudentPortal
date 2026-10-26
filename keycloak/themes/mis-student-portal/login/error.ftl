<!doctype html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Password reset link unavailable</title>
    <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body class="mis-login-page">
    <main class="login-shell">
        <section class="promo-panel" aria-label="Account security">
            <div class="promo-card">
                <div class="promo-copy">
                    <h1>Keep your account secure</h1>
                    <p>Password reset links are private and can only be used once in the browser where the request was made.</p>
                </div>
            </div>
        </section>
        <section class="form-panel" aria-labelledby="reset-link-title">
            <div class="login-form-wrap">
                <img class="brand-logo" src="${url.resourcesPath}/img/ExecuTrain_logo.png" alt="ExecuTrain" width="160" height="40">
                <h2 id="reset-link-title">Password reset link unavailable</h2>
                <div class="login-message login-message-error" role="alert">
                    This password reset link is no longer valid. It may have expired, already been used, or been opened in a different browser. Request a new link to continue.
                </div>
                <a class="back-to-login" href="${url.loginUrl}">Back to Login</a>
            </div>
        </section>
    </main>
</body>
</html>
