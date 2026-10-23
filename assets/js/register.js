/* ==========================================================================
   THE UNKNOWN COFFEE — assets/js/register.js
   Handles the demo registration form on register.html.

   Registration always creates a CUSTOMER account. There is no role field
   and no way to become an administrator from this page.
   ========================================================================== */

(function () {
  "use strict";

  var form = null;
  var statusBox = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function clearErrors() {
    var ids = ["register-name", "register-username", "register-email"];
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
    }
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearErrors();

    var name = byId("register-name");
    var username = byId("register-username");
    var email = byId("register-email");

    var nameCheck = LutongValidate.fullName(name.value);
    var usernameCheck = LutongValidate.username(username.value);
    var emailCheck = LutongValidate.email(email.value);

    if (!nameCheck.ok) {
      showFieldError("register-name", nameCheck.message);
      LutongUI.setStatus(statusBox, "Please fix the highlighted fields and try again.", "error");
      name.focus();
      return;
    }
    if (!usernameCheck.ok) {
      showFieldError("register-username", usernameCheck.message);
      LutongUI.setStatus(statusBox, "Please fix the highlighted fields and try again.", "error");
      username.focus();
      return;
    }
    if (!emailCheck.ok) {
      showFieldError("register-email", emailCheck.message);
      LutongUI.setStatus(statusBox, "Please fix the highlighted fields and try again.", "error");
      email.focus();
      return;
    }

    var result = LutongAuth.register(nameCheck.value, usernameCheck.value, emailCheck.value);

    if (!result.ok) {
      showFieldError("register-" + result.field, result.message);
      LutongUI.setStatus(statusBox, result.message, "error");
      return;
    }

    LutongUI.setStatus(
      statusBox,
      "Your account is ready, " + result.user.displayName + ". Taking you to your dashboard...",
      "success"
    );

    window.setTimeout(function () {
      window.location.href = "dashboard.html";
    }, 700);
  }

  function init() {
    form = byId("register-form");
    statusBox = byId("register-status");

    if (!form) {
      return;
    }

    form.addEventListener("submit", handleSubmit);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
