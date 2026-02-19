// auth.js

function requireAuth() {
  if (localStorage.getItem("isLoggedIn") !== "true") {
    window.location.href = "Login.html";
  }
}

function logout() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("userEmail");
  window.location.href = "Login.html";
}

function showUserEmail(elementId) {
  const email = localStorage.getItem("userEmail") || "";
  const el = document.getElementById(elementId);
  if (el) el.textContent = email;
}
