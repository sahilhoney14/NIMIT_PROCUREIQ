document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginButton = document.getElementById("loginButton");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const togglePasswordBtn = document.getElementById("togglePassword");
    const eyeIcon = document.getElementById("eyeIcon");
    const eyeOffIcon = document.getElementById("eyeOffIcon");
    const rememberMeCheckbox = document.getElementById("rememberMe");
    const message = document.getElementById("message");

    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    const forgotModal = document.getElementById("forgotModal");
    const closeModalBtn = document.getElementById("closeModalBtn");

    // Handle reason banner from route guard
    const urlParams = new URLSearchParams(window.location.search);
    const reason = urlParams.get("reason");
    if (reason === "session_expired") {
        showMessage("Your session has expired. Please sign in again.", "info");
    } else if (reason === "unauthenticated") {
        showMessage("Please sign in to access the protected dashboard.", "info");
    }

    // Check if user is already authenticated and redirect
    const existingToken = localStorage.getItem("auth_token");
    if (existingToken) {
        fetch("/verify", {
            headers: { "Authorization": `Bearer ${existingToken}` },
            credentials: "include"
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.authenticated) {
                const target = data.role === "ADMIN" ? "/admin" :
                              (data.role === "PROCUREMENT_MANAGER" ? "/procurement-manager" : "/procurement");
                window.location.replace(target);
            } else {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("auth_user");
            }
        })
        .catch(() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
        });
    }

    // Load saved username if Remember Me was previously selected
    const savedUsername = localStorage.getItem("procureiq_remembered_username");
    if (savedUsername) {
        usernameInput.value = savedUsername;
        rememberMeCheckbox.checked = true;
        passwordInput.focus();
    } else {
        usernameInput.focus();
    }

    // Toggle Password Visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener("click", () => {
            const isPassword = passwordInput.getAttribute("type") === "password";
            if (isPassword) {
                passwordInput.setAttribute("type", "text");
                eyeIcon.style.display = "none";
                eyeOffIcon.style.display = "block";
                togglePasswordBtn.setAttribute("aria-label", "Hide password");
            } else {
                passwordInput.setAttribute("type", "password");
                eyeIcon.style.display = "block";
                eyeOffIcon.style.display = "none";
                togglePasswordBtn.setAttribute("aria-label", "Show password");
            }
        });
    }

    // Forgot Password Modal
    if (forgotPasswordBtn && forgotModal && closeModalBtn) {
        forgotPasswordBtn.addEventListener("click", () => {
            forgotModal.classList.add("active");
            forgotModal.setAttribute("aria-hidden", "false");
        });

        closeModalBtn.addEventListener("click", () => {
            forgotModal.classList.remove("active");
            forgotModal.setAttribute("aria-hidden", "true");
        });

        forgotModal.addEventListener("click", (e) => {
            if (e.target === forgotModal) {
                forgotModal.classList.remove("active");
                forgotModal.setAttribute("aria-hidden", "true");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && forgotModal.classList.contains("active")) {
                forgotModal.classList.remove("active");
                forgotModal.setAttribute("aria-hidden", "true");
            }
        });
    }

    // Helper: Show Message
    function showMessage(text, type) {
        message.textContent = text;
        message.className = `message ${type}`;
        message.style.display = "flex";
    }

    function clearMessage() {
        message.textContent = "";
        message.className = "message";
        message.style.display = "none";
    }

    // Submit handler
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username) {
            showMessage("Please enter your username or email", "error");
            usernameInput.focus();
            return;
        }

        if (!password) {
            showMessage("Please enter your password", "error");
            passwordInput.focus();
            return;
        }

        clearMessage();
        loginButton.disabled = true;
        const originalContent = loginButton.innerHTML;
        loginButton.innerHTML = `
            <span>Signing in...</span>
        `;

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage(data.message || "Invalid username or password", "error");
                loginButton.disabled = false;
                loginButton.innerHTML = originalContent;
                return;
            }

            // Remember Me preference handling
            if (rememberMeCheckbox.checked) {
                localStorage.setItem("procureiq_remembered_username", username);
            } else {
                localStorage.removeItem("procureiq_remembered_username");
            }

            // Store token / session
            if (data.token) {
                localStorage.setItem("auth_token", data.token);
                if (data.user) {
                    localStorage.setItem("auth_user", JSON.stringify(data.user));
                }
            }

            showMessage("Login successful! Redirecting...", "success");

            setTimeout(() => {
                window.location.href = data.redirect_url || "/";
            }, 500);

        } catch (error) {
            console.error("Login request failed:", error);
            showMessage("Unable to connect to the authentication service. Please check your network.", "error");
            loginButton.disabled = false;
            loginButton.innerHTML = originalContent;
        }
    });
});