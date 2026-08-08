(function () {
    let googleClient;

    const form = document.getElementById('signinForm');
    const email = document.getElementById('email');
    const pwd = document.getElementById('password');
    const toggle = document.getElementById('togglePwd');
    const emailError = document.getElementById('emailError');
    const pwdError = document.getElementById('pwdError');
    const googleLoginBtn = document.getElementById('googleLoginBtn');


    // --------------------------------------------------
    // Password visibility toggle
    // --------------------------------------------------

    if (toggle && pwd) {
        toggle.addEventListener('click', () => {
            const isPwd = pwd.type === 'password';

            pwd.type = isPwd ? 'text' : 'password';
            toggle.textContent = isPwd ? 'Hide' : 'Show';

            toggle.setAttribute(
                'aria-label',
                isPwd ? 'Hide password' : 'Show password'
            );
        });
    }


    // --------------------------------------------------
    // Error helpers
    // --------------------------------------------------

    function showError(el, msg) {
        if (!el) return;

        el.textContent = msg;
        el.style.display = 'block';
    }


    function hideError(el) {
        if (!el) return;

        el.textContent = '';
        el.style.display = 'none';
    }


    function validateEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }


    // --------------------------------------------------
    // Safe server response parser
    // --------------------------------------------------

    async function parseServerResponse(res) {
        const raw = await res.text();

        console.log(
            `Server response (${res.status}) from ${res.url}:`,
            raw
        );

        if (!raw) {
            return {
                success: false,
                message: `Server returned HTTP ${res.status} with an empty response`
            };
        }

        try {
            return JSON.parse(raw);
        } catch (err) {
            console.error(
                'Server did not return valid JSON:',
                raw
            );

            return {
                success: false,
                message: `Server error (${res.status})`
            };
        }
    }


    // --------------------------------------------------
    // Google sign in
    // --------------------------------------------------

    function initGoogleLogin() {
        if (
            typeof google === 'undefined' ||
            !google.accounts ||
            !google.accounts.oauth2
        ) {
            console.error(
                'Google Identity Services library is not loaded.'
            );

            return;
        }


        googleClient =
            google.accounts.oauth2.initTokenClient({

                client_id:
                    '365777418021-krre441oq3u1rjv89vis4qkj592io06t.apps.googleusercontent.com',

                scope:
                    'openid email profile',

                callback: async (response) => {

                    console.log(
                        'Google OAuth response:',
                        response
                    );


                    // Google itself returned an OAuth error
                    if (response.error) {

                        console.error(
                            'Google OAuth error:',
                            response
                        );

                        alert(
                            response.error_description ||
                            'Google sign in failed'
                        );

                        return;
                    }


                    if (!response.access_token) {

                        console.error(
                            'Google response did not contain access_token:',
                            response
                        );

                        alert(
                            'Google did not return an access token.'
                        );

                        return;
                    }


                    try {

                        const res = await fetch(
                            '/auth/google',
                            {
                                method: 'POST',

                                headers: {
                                    'Content-Type':
                                        'application/json'
                                },

                                body: JSON.stringify({
                                    access_token:
                                        response.access_token,

                                    token_type:
                                        response.token_type,

                                    expires_in:
                                        response.expires_in,

                                    scope:
                                        response.scope
                                })
                            }
                        );


                        const data =
                            await parseServerResponse(res);


                        if (res.ok && data.success) {

                            window.location.href =
                                '/home_page';

                            return;
                        }


                        console.error(
                            'Google authentication failed:',
                            {
                                status: res.status,
                                data: data
                            }
                        );


                        alert(
                            data.message ||
                            `Google sign in failed (${res.status})`
                        );

                    }

                    catch (err) {

                        console.error(
                            'Google authentication request failed:',
                            err
                        );

                        alert(
                            'Unable to contact the server. Please try again.'
                        );
                    }
                }
            });
    }


    // Initialize Google OAuth
    initGoogleLogin();


    // Google button
    if (googleLoginBtn) {

        googleLoginBtn.addEventListener(
            'click',
            function (event) {

                event.preventDefault();


                if (!googleClient) {

                    console.error(
                        'Google OAuth client has not initialized.'
                    );

                    alert(
                        'Google sign in is currently unavailable.'
                    );

                    return;
                }


                googleClient.requestAccessToken({
                    prompt: 'select_account'
                });
            }
        );
    }


    // --------------------------------------------------
    // Normal email/password sign in
    // --------------------------------------------------

    if (form) {

        form.addEventListener(
            'submit',
            async function (ev) {

                ev.preventDefault();


                hideError(emailError);
                hideError(pwdError);


                // Validate email
                if (
                    !email ||
                    !validateEmail(email.value.trim())
                ) {

                    showError(
                        emailError,
                        'Please enter a valid email address.'
                    );

                    return;
                }


                // Validate password
                if (
                    !pwd ||
                    pwd.value.length < 8
                ) {

                    showError(
                        pwdError,
                        'Password must be at least 8 characters.'
                    );

                    return;
                }


                const rememberElement =
                    document.getElementById('remember');


                const payload = {
                    email:
                        email.value.trim(),

                    password:
                        pwd.value,

                    remember:
                        rememberElement
                            ? rememberElement.checked
                            : false
                };


                const btn =
                    form.querySelector('.btn');


                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Signing in...';
                }


                try {

                    const res = await fetch(
                        '/signin',
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify(payload)
                        }
                    );


                    const data =
                        await parseServerResponse(res);


                    if (
                        res.ok &&
                        data.success
                    ) {

                        window.location.href =
                            '/home_page';

                        return;
                    }


                    console.error(
                        'Sign-in failed:',
                        {
                            status: res.status,
                            data: data
                        }
                    );


                    showError(
                        pwdError,
                        data.message ||
                        `Sign in failed (${res.status})`
                    );

                }

                catch (err) {

                    console.error(
                        'Sign-in request error:',
                        err
                    );


                    showError(
                        pwdError,
                        'Network error. Please try again.'
                    );
                }

                finally {

                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Sign in';
                    }
                }
            }
        );
    }


    // --------------------------------------------------
    // Live validation
    // --------------------------------------------------

    if (email) {

        email.addEventListener(
            'input',
            () => {

                const value =
                    email.value.trim();


                if (
                    value.length &&
                    !validateEmail(value)
                ) {

                    showError(
                        emailError,
                        'Invalid email'
                    );

                } else {

                    hideError(emailError);
                }
            }
        );
    }


    if (pwd) {

        pwd.addEventListener(
            'input',
            () => {

                if (
                    pwd.value.length &&
                    pwd.value.length < 8
                ) {

                    showError(
                        pwdError,
                        'Too short'
                    );

                } else {

                    hideError(pwdError);
                }
            }
        );
    }

})();