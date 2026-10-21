-- Permite retos de contraseña con el mismo mecanismo de códigos.
ALTER TABLE email_challenges DROP CONSTRAINT IF EXISTS email_challenges_purpose_check;
ALTER TABLE email_challenges
  ADD CONSTRAINT email_challenges_purpose_check
  CHECK (purpose IN ('verify_email', 'login_2fa', 'password_reset'));
