package com.executrain.keycloak.st01;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

import jakarta.ws.rs.core.UriBuilder;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.actiontoken.resetcred.ResetCredentialsActionToken;
import org.keycloak.authentication.authenticators.browser.AbstractUsernameFormAuthenticator;
import org.keycloak.authentication.authenticators.resetcred.ResetCredentialEmail;
import org.keycloak.common.util.Time;
import org.keycloak.email.EmailException;
import org.keycloak.email.EmailTemplateProvider;
import org.keycloak.events.Details;
import org.keycloak.events.Errors;
import org.keycloak.events.EventType;
import org.keycloak.models.DefaultActionTokenKey;
import org.keycloak.models.AuthenticatorConfigModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.utils.FormMessage;
import org.keycloak.services.ServicesLogger;
import org.keycloak.services.managers.AuthenticationManager;
import org.keycloak.services.messages.Messages;
import org.keycloak.sessions.AuthenticationSessionCompoundId;
import org.keycloak.sessions.AuthenticationSessionModel;
import org.keycloak.storage.StorageId;

/** Sends the built-in Keycloak reset email while recording the newest token ID. */
public final class BrowserBoundResetCredentialEmail extends ResetCredentialEmail {
    public static final String LATEST_TOKEN_ATTRIBUTE = "mis_latest_reset_token_id";

    @Override
    public int order() {
        return 100;
    }

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        UserModel user = context.getUser();
        AuthenticationSessionModel authenticationSession = context.getAuthenticationSession();
        String username = authenticationSession.getAuthNote(AbstractUsernameFormAuthenticator.ATTEMPTED_USERNAME);
        if (user == null) {
            context.forkWithSuccessMessage(new FormMessage(Messages.EMAIL_SENT));
            return;
        }

        String actionTokenUserId = authenticationSession.getAuthNote(DefaultActionTokenKey.ACTION_TOKEN_USER_ID);
        if (actionTokenUserId != null && Objects.equals(user.getId(), actionTokenUserId)) {
            if (shouldForceLogin(context.getAuthenticatorConfig(), user)) {
                authenticationSession.setAuthNote(AuthenticationManager.END_AFTER_REQUIRED_ACTIONS, "true");
            }
            context.success();
            return;
        }

        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            context.getEvent().user(user).detail(Details.USERNAME, username).error(Errors.INVALID_EMAIL);
            context.forkWithSuccessMessage(new FormMessage(Messages.EMAIL_SENT));
            return;
        }

        int validityInSecs = context.getRealm().getActionTokenGeneratedByUserLifespan(ResetCredentialsActionToken.TOKEN_TYPE);
        int absoluteExpirationInSecs = Time.currentTime() + validityInSecs;
        String encodedSessionId = AuthenticationSessionCompoundId.fromAuthSession(authenticationSession).getEncodedId();
        ResetCredentialsActionToken token = new ResetCredentialsActionToken(
            user.getId(), user.getEmail(), absoluteExpirationInSecs, encodedSessionId,
            authenticationSession.getClient().getClientId()
        );
        String link = UriBuilder.fromUri(context.getActionTokenUrl(
            token.serialize(context.getSession(), context.getRealm(), context.getUriInfo())
        )).build().toString();

        // Saving before sending ensures a newly requested link immediately supersedes older links.
        user.setSingleAttribute(LATEST_TOKEN_ATTRIBUTE, token.getId());
        long expirationInMinutes = TimeUnit.SECONDS.toMinutes(validityInSecs);
        try {
            context.getSession().getProvider(EmailTemplateProvider.class)
                .setRealm(context.getRealm()).setUser(user).setAuthenticationSession(authenticationSession)
                .sendPasswordReset(link, expirationInMinutes);
            context.getEvent().clone().event(EventType.SEND_RESET_PASSWORD).user(user)
                .detail(Details.USERNAME, username).detail(Details.EMAIL, user.getEmail())
                .detail(Details.CODE_ID, authenticationSession.getParentSession().getId()).success();
            context.forkWithSuccessMessage(new FormMessage(Messages.EMAIL_SENT));
        } catch (EmailException error) {
            ServicesLogger.LOGGER.failedToSendPwdResetEmail(error);
            context.getEvent().clone().event(EventType.SEND_RESET_PASSWORD).user(user)
                .detail(Details.REASON, error.getMessage()).detail(Details.USERNAME, username)
                .error(Errors.EMAIL_SEND_FAILED);
            context.forkWithSuccessMessage(new FormMessage(Messages.EMAIL_SENT));
        }
    }

    private boolean shouldForceLogin(AuthenticatorConfigModel config, UserModel user) {
        String forceLogin = config != null ? config.getConfig().get(FORCE_LOGIN) : null;
        if (forceLogin == null || FEDERATED_OPTION.equalsIgnoreCase(forceLogin)) {
            return !StorageId.isLocalStorage(user.getId()) || user.isFederated();
        }
        if (Boolean.TRUE.toString().equalsIgnoreCase(forceLogin)) return true;
        if (Boolean.FALSE.toString().equalsIgnoreCase(forceLogin)) return false;
        throw new IllegalStateException("Invalid reset credential force-login setting");
    }
}
