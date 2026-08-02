(function(){
    let googleClient;
    const form = document.getElementById('signinForm');
    const email = document.getElementById('email');
    const pwd = document.getElementById('password');
    const toggle = document.getElementById('togglePwd');
    const emailError = document.getElementById('emailError');
    const pwdError = document.getElementById('pwdError');

    toggle.addEventListener('click', ()=>{
        const isPwd = pwd.type === 'password';
        pwd.type = isPwd ? 'text' : 'password';
        toggle.textContent = isPwd ? 'Hide' : 'Show';
        toggle.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
    });

    googleClient = google.accounts.oauth2.initTokenClient({
        client_id: "365777418021-krre441oq3u1rjv89vis4qkj592io06t.apps.googleusercontent.com",

        scope: "email profile openid",

        callback: async (response) => {

        try {

            const res = await fetch("/auth/google", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(response)
            });

            const data = await res.json();

            if (data.success) {
            window.location.href = "/home_page";
            } else {
            alert("Google sign in failed");
            }

        } catch (err) {
            alert("Google sign in failed");
        }
        }
    });

    document
        .getElementById("googleLoginBtn")
        .addEventListener("click", function () {
        googleClient.requestAccessToken();
        });

    function validateEmail(value){
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function showError(el, msg){ el.textContent = msg; el.style.display = 'block'; }
    function hideError(el){ el.textContent=''; el.style.display='none'; }

    // ✅ Updated login flow
    form.addEventListener('submit', async function(ev){
        ev.preventDefault();
        hideError(emailError); hideError(pwdError);

        if(!validateEmail(email.value.trim())){ showError(emailError,'Please enter a valid email address.'); return; }
        if(pwd.value.length < 8){ showError(pwdError,'Password must be at least 8 characters.'); return; }

        const payload = {
        email: email.value.trim(),
        password: pwd.value,
        remember: document.getElementById('remember').checked
        };

        const btn = form.querySelector('.btn');
        btn.disabled = true; btn.textContent = 'Signing in...';

        try {
        const res = await fetch('/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            // ✅ Redirect to home page
            window.location.href = '/home_page';
        } else {
            showError(pwdError, data.message || 'Invalid credentials');
        }
        } catch (err) {
        showError(pwdError, 'Network error. Please try again.');
        } finally {
        btn.disabled = false; btn.textContent = 'Sign in';
        }
    });

    email.addEventListener('input', ()=>{ if(email.value.length && !validateEmail(email.value)) showError(emailError,'Invalid email'); else hideError(emailError); });
    pwd.addEventListener('input', ()=>{ if(pwd.value.length && pwd.value.length < 8) showError(pwdError,'Too short'); else hideError(pwdError); });
    })();