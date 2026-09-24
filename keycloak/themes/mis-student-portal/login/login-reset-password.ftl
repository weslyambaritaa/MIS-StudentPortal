<!doctype html>
<html lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}</#if>>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${msg("emailForgotTitle")}</title>
    <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body class="mis-login-page">
    <main class="login-shell forgot-password-shell">
        <section class="promo-panel forgot-promo-panel" aria-label="Password recovery">
            <div class="promo-card">
                <svg class="forgot-promo-icon" viewBox="0 0 112 112" fill="none" aria-hidden="true">
                    <rect x="14" y="14" width="84" height="62" rx="8" fill="#E5E7EB"/>
                    <path d="M14 24h84" stroke="#3F3F46" stroke-width="8"/>
                    <circle cx="26" cy="19" r="2" fill="#F97316"/><circle cx="34" cy="19" r="2" fill="#E11D48"/><circle cx="42" cy="19" r="2" fill="#0D9488"/>
                    <path d="M48 47v-4a8 8 0 0 1 16 0v4" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
                    <rect x="44" y="47" width="24" height="21" rx="4" fill="#E11D48" stroke="#fff" stroke-width="2"/>
                    <path d="M56 55v5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
                    <path d="M32 86h48l7 10H25l7-10Z" fill="#38BDF8" stroke="#fff" stroke-width="2"/>
                    <path d="M45 91h22" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
                <div class="promo-copy">
                    <h1>Forgot your password?</h1>
                    <p>Don't worry, it happens. Enter your email address and we'll send you a link to securely reset your password and get you back on track.</p>
                </div>
            </div>
        </section>

        <section class="form-panel" aria-labelledby="reset-title">
            <div class="login-form-wrap reset-form-wrap">
                <img class="brand-logo" src="${url.resourcesPath}/img/ExecuTrain_logo.png" alt="ExecuTrain" width="160" height="40">
                <div class="reset-heading">
                    <h2 id="reset-title">Forgot your password</h2>
                    <p>Please enter the email address you'd like your password reset information sent to</p>
                </div>

                <#if message?has_content && !messagesPerField.existsError('username')>
                    <div class="login-message login-message-${message.type}" role="alert">${kcSanitize(message.summary)?no_esc}</div>
                </#if>

                <form id="kc-reset-password-form" class="reset-form" action="${url.loginAction}" method="post">
                    <div class="field-group">
                        <label for="username"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
                        <input id="username" name="username" type="text" value="${(auth.attemptedUsername!'')}" autocomplete="username" autofocus dir="ltr" aria-invalid="<#if messagesPerField.existsError('username')>true</#if>" placeholder="<#if !realm.loginWithEmailAllowed>${msg('username')}<#elseif !realm.registrationEmailAsUsername>${msg('usernameOrEmail')}<#else>${msg('email')}</#if>">
                        <#if messagesPerField.existsError('username')>
                            <span class="field-error" role="alert">${kcSanitize(messagesPerField.getFirstError('username'))?no_esc}</span>
                        </#if>
                    </div>
                    <div class="form-divider" aria-hidden="true"></div>
                    <button id="kc-reset-submit" class="reset-submit" type="submit">
                        <span>Request Reset Link</span>
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4"/></svg>
                    </button>
                    <a class="back-to-login" href="${url.loginUrl}">Back to Login</a>
                </form>
            </div>
        </section>
    </main>
</body>
</html>
