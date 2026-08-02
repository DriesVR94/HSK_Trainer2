let client;

document.addEventListener("DOMContentLoaded", function () {
    client = google.accounts.oauth2.initTokenClient({
        client_id: "365777418021-krre441oq3u1rjv89vis4qkj592io06t.apps.googleusercontent.com",
        scope: "email profile openid",
        callback: async (response) => {
            console.log("Access token:", response.access_token);

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
                alert("Google login failed");
            }
        }
    });

    document.getElementById("googleLoginBtn")
        .addEventListener("click", function () {
            client.requestAccessToken();
        });
});
    