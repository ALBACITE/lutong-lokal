/* ==========================================================================
   Lutong Lokal — assets/js/login.js
   Handles the demo sign-in form on login.html.
   ========================================================================== */

(function () {
  "use strict";

  var form = null;
  var statusBox = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function clearErrors() {
    var ids = ["login-username", "login-email", "login-passcode"];
    for (var i = 0; i < ids.length; i += 1) {
      var field = byId(ids[i]);
      var error = byId(ids[i] + "-error");
      if (field) {
        field.removeAttribute("aria-invalid");
      }
      if (error) {
        error.textContent = "";
        error.hidden = true;
      }
    }
  }

  function showFieldError(fieldId, message) {
    var field = byId(fieldId);
    var error = byId(fieldId + "-error");
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearErrors();

    var username = byId("login-username");
    var email = byId("login-email");
    var passcode = byId("login-passcode");

    var usernameCheck = LutongValidate.username(username.value);
    var emailCheck = LutongValidate.email(email.value);

    if (!usernameCheck.ok) {
      showFieldError("login-username", usernameCheck.message);
      LutongUI.setStatus(statusBox, "Please fix the highlighted fields and try again.", "error");
      return;
    }
    if (!emailCheck.ok) {
      showFieldError("login-email", emailCheck.message);
      LutongUI.setStatus(statusBox, "Please fix the highlighted fields and try again.", "error");
      return;
    }

    var result = LutongAuth.signIn(username.value, email.value, passcode.value);

    if (!result.ok) {
      showFieldError("login-" + result.field, result.message);
      LutongUI.setStatus(statusBox, result.message, "error");
      return;
    }

    var session = result.session;
    LutongUI.setStatus(
      statusBox,
      "Signed in as " + session.displayName + ". Taking you to your dashboard...",
      "success"
    );

    // A short delay so the success message is readable before the page changes.
    window.setTimeout(function () {
      window.location.href = session.role === "admin" ? "admin.html" : "dashboard.html";
    }, 600);
  }

  function fillDemo(role) {
    var account = LutongAuth.getDemoCredentials(role);
    if (!account) {
      return;
    }

    byId("login-username").value = account.username;
    byId("login-email").value = account.email;
    byId("login-passcode").value = account.passcode;
    clearErrors();

    LutongUI.setStatus(
      statusBox,
      "Demo " + (role === "admin" ? "administrator" : "customer") + " credentials filled in. Press Sign in.",
      "info"
    );
  }

  function init() {
    form = byId("login-form");
    statusBox = byId("login-status");

    if (!form) {
      return;
    }

    form.addEventListener("submit", handleSubmit);

    var customerButton = byId("fill-demo-customer");
    if (customerButton) {
      customerButton.addEventListener("click", function () { fillDemo("user"); });
    }

    var adminButton = byId("fill-demo-admin");
    if (adminButton) {
      adminButton.addEventListener("click", function () { fillDemo("admin"); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
