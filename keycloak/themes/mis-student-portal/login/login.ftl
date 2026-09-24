<#import "passkeys.ftl" as passkeys>
<!doctype html>
<html lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${msg("loginAccountTitle")}</title>
    <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body class="mis-login-page">
    <main class="login-shell">
        <section class="promo-panel" aria-label="MIS Executrain">
            <div class="promo-card">
                <div class="promo-icon" aria-hidden="true">
                    <svg class="promo-symbol is-active" data-promo-icon="0" viewBox="0 0 112 112" fill="none">
                        <path d="M25 25h62a7 7 0 0 1 7 7v48a7 7 0 0 1-7 7H25a7 7 0 0 1-7-7V32a7 7 0 0 1 7-7Z" fill="#FECACA"/>
                        <path d="M18 38h76M43 88l-7 12m33-12 7 12m-47 0h57" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
                        <path d="m40 57 9 9 22-22" stroke="#DE1641" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg class="promo-symbol" data-promo-icon="1" viewBox="0 0 112 112" fill="none" aria-hidden="true">
                        <path d="M56 13a28 28 0 0 0-17 50v12h34V63a28 28 0 0 0-17-50Z" fill="#FECACA"/>
                        <path d="M43 86h26m-22 9h18M56 2v6m39 9-5 5M17 17l5 5m67 27h7M9 49h7" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
                        <path d="M45 48h22m-18 10h14" stroke="#DE1641" stroke-width="5" stroke-linecap="round"/>
                    </svg>
                    <svg class="promo-symbol" data-promo-icon="2" viewBox="0 0 112 112" fill="none" aria-hidden="true">
                        <rect x="13" y="18" width="86" height="59" rx="8" fill="#FECACA"/>
                        <path d="M6 88h100l-9 10H15L6 88Z" fill="#fff"/>
                        <path d="M34 45h44M34 56h30" stroke="#DE1641" stroke-width="5" stroke-linecap="round"/>
                        <circle cx="80" cy="72" r="12" fill="#fff"/><path d="m75 72 4 4 7-8" stroke="#DE1641" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="promo-copy">
                    <h1>Your Partner In Tech Excellence</h1>
                    <p>Elevate your workforce with industry-leading expertise, bridging the skills gap to prepare you for the future of technology.</p>
                </div>
                <div class="promo-pagination" role="group" aria-label="Promo icons">
                    <button type="button" class="is-active" data-promo-slide="0" aria-label="Show first icon" aria-pressed="true"></button>
                    <button type="button" data-promo-slide="1" aria-label="Show second icon" aria-pressed="false"></button>
                    <button type="button" data-promo-slide="2" aria-label="Show third icon" aria-pressed="false"></button>
                </div>
            </div>
        </section>

        <section class="form-panel" aria-labelledby="login-title">
            <div class="login-form-wrap">
                <img class="brand-logo" src="${url.resourcesPath}/img/ExecuTrain_logo.png" alt="ExecuTrain" width="160" height="40">
                <h2 id="login-title">Login To The System</h2>

                <#if message?has_content && !messagesPerField.existsError('username','password')>
                    <div class="login-message login-message-${message.type}" role="alert">${kcSanitize(message.summary)?no_esc}</div>
                </#if>

                <#if realm.password>
                    <form id="kc-form-login" action="${url.loginAction}" method="post" onsubmit="login.disabled = true; return true;">
                        <#if !usernameHidden??>
                            <div class="field-group">
                                <label for="username">Email</label>
                                <input id="username" name="username" type="text" value="${(login.username!'')}" autocomplete="username" autofocus dir="ltr" aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" placeholder="your@mail.com">
                                <#if messagesPerField.existsError('username','password')>
                                    <span class="field-error" role="alert">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                                </#if>
                            </div>
                        </#if>

                        <div class="field-group">
                            <label for="password">${msg("password")}</label>
                            <div class="password-control">
                                <input id="password" name="password" type="password" autocomplete="current-password" aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" placeholder="Your Password">
                                <button class="password-toggle" type="button" data-password-toggle data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}" aria-label="${msg('showPassword')}" aria-controls="password" aria-pressed="false">
                                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s2.9-5 8-5 8 5 8 5-2.9 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2.5"/></svg>
                                </button>
                            </div>
                            <#if usernameHidden?? && messagesPerField.existsError('username','password')>
                                <span class="field-error" role="alert">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                            </#if>
                        </div>

                        <#if realm.rememberMe && !usernameHidden??>
                            <label class="remember-control"><input id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if>> <span>${msg("rememberMe")}</span></label>
                        </#if>

                        <div class="form-divider" aria-hidden="true"></div>
                        <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>>
                        <button id="kc-login" name="login" type="submit">
                            <span>${msg("doLogIn")}</span>
                            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4"/></svg>
                        </button>
                        <#if realm.resetPasswordAllowed>
                            <p class="forgot-password"><span>Forgot your password? </span><a href="${url.loginResetCredentialsUrl}">Click Here</a></p>
                        </#if>
                    </form>
                    <@passkeys.conditionalUIData />
                </#if>
            </div>
        </section>
    </main>
    <script src="${url.resourcesPath}/js/login.js?v=3" defer></script>
</body>
</html>
