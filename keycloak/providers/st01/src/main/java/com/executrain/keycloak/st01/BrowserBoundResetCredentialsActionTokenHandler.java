package com.executrain.keycloak.st01;

import java.util.Arrays;
import java.util.Objects;

import org.keycloak.TokenVerifier.Predicate;
import org.keycloak.authentication.actiontoken.ActionTokenContext;
import org.keycloak.authentication.actiontoken.ExplainedTokenVerificationException;
import org.keycloak.authentication.actiontoken.TokenUtils;
import org.keycloak.authentication.actiontoken.resetcred.ResetCredentialsActionToken;
import org.keycloak.authentication.actiontoken.resetcred.ResetCredentialsActionTokenHandler;
import org.keycloak.events.Errors;
import org.keycloak.models.UserModel;
import org.keycloak.services.messages.Messages;
import org.keycloak.sessions.AuthenticationSessionModel;

/** Enforces newest-token and originating-browser checks for password reset links. */
public final class BrowserBoundResetCredentialsActionTokenHandler extends ResetCredentialsActionTokenHandler {
    @Override
    public int order() {
        return 100;
    }

    @Override
    public Predicate<? super ResetCredentialsActionToken>[] getVerifiers(
        ActionTokenContext<ResetCredentialsActionToken> context
    ) {
        Predicate<? super ResetCredentialsActionToken>[] inherited = super.getVerifiers(context);
        Predicate<ResetCredentialsActionToken> latestToken = TokenUtils.checkThat(token -> {
            UserModel user = context.getAuthenticationSession().getAuthenticatedUser();
            return user != null && Objects.equals(
                token.getId(), user.getFirstAttribute(BrowserBoundResetCredentialEmail.LATEST_TOKEN_ATTRIBUTE)
            );
        }, Errors.NOT_ALLOWED, "invalidResetLink");

        @SuppressWarnings("unchecked")
        Predicate<? super ResetCredentialsActionToken>[] combined = Arrays.copyOf(inherited, inherited.length + 1);
        combined[inherited.length] = latestToken;
        return combined;
    }

    @Override
    public AuthenticationSessionModel startFreshAuthenticationSession(
        ResetCredentialsActionToken token,
        ActionTokenContext<ResetCredentialsActionToken> context
    ) {
        sneakyThrow(new ExplainedTokenVerificationException(token, Errors.NOT_ALLOWED, "invalidResetLink"));
        return null;
    }

    @SuppressWarnings("unchecked")
    private static <T extends Throwable> void sneakyThrow(Throwable error) throws T {
        throw (T) error;
    }
}
