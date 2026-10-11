
document.addEventListener("DOMContentLoaded", () => {
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Change password
  changePasswordBtn.addEventListener("click", () => {
    window.location.href = "/change-password";
  });

  // Delete account
  deleteAccountBtn.addEventListener("click", () => {
    const confirmed = confirm(
      "Are you sure you want to delete your account? This action may be permanent."
    );

    if (confirmed) {
      // TODO: Call your backend's account deletion endpoint.
      alert("Account deletion is not connected yet.");
    }
  });

  // Log out
  logoutBtn.addEventListener("click", () => {
    const confirmed = confirm("Are you sure you want to log out?");

    if (confirmed) {
      // TODO: Invalidate the user's session on the server.
      window.location.href = "/login";
    }
  });
});
