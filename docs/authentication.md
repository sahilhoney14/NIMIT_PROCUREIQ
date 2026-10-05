# Authentication Architecture

## Overview
ProcureIQ uses cookie-backed secure sessions managed by `express-session` with bcrypt salted hashing for credentials.

## Authentication Lifecycle
1. **User Login (`POST /login`)**:
   - Accepts `{ username, password }`.
   - Validates user existence and `is_active` flag.
   - Compares supplied password against `password_hash` using `bcrypt.compare`.
   - On success: Records `login_logs` entry with status `'SUCCESS'`, initializes session `req.session.user`, and returns appropriate redirect URL:
     - `ADMIN` -> `/admin`
     - `PROCUREMENT_MANAGER` -> `/procurement-manager`
     - `PROCUREMENT` -> `/procurement`
2. **Session Persistence**:
   - Transmitted via `httpOnly` secure cookie `login_session`.
   - Rolling expiration set to 1 hour with active touch on each interaction.
3. **Logout (`POST /logout`)**:
   - Destroys active session on server and clears `login_session` cookie.
   - Returns `{ success: true, redirect_url: "/" }`.
