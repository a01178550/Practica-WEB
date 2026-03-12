/**
 * auth.js
 * ----------
 * Autenticación DEMO usando localStorage.
 * - isLoggedIn: "true" significa sesión activa
 * - userEmail: correo del usuario demo
 */

/**
 * Protege páginas privadas.
 * Si no hay sesión activa, redirige a Login.html
 */
function requireAuth() {
  if (localStorage.getItem("isLoggedIn") !== "true") {
    window.location.href = "Login.html";
  }
}

/**
 * Cierra sesión (borra flags de localStorage) y regresa al login.
 */
function logout() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("userEmail");
  window.location.href = "Login.html";
}

/**
 * Muestra el email guardado en localStorage dentro de un elemento.
 * @param {string} elementId - id del elemento donde se escribe el email
 */
function showUserEmail(elementId) {
  const email = localStorage.getItem("userEmail") || "";
  const el = document.getElementById(elementId);
  if (el) el.textContent = email;
}