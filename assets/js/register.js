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
    var ids = ["register-name", "register-username", "register-email", "register-password", "register-confirm-password"];
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

  function applyPasswordStrength() {
    var passwordField = byId("register-password");
    var requirements = document.querySelectorAll("#register-password-requirements [data-requirement]");
    var strengthBox = byId("register-password-strength");
    var meter = byId("register-password-meter");
    var label = byId("register-password-label");
    var hint = byId("register-password-hint");

    if (!passwordField || !strengthBox || !meter || !label || !hint) {
      return;
    }

    var result = LutongValidate.passwordStrength(passwordField.value);
    var percent = result.score === 0 ? 0 : (result.score / 5) * 100;
    meter.style.width = percent + "%";
    strengthBox.setAttribute("data-level", result.level);
    label.textContent = result.label;
    hint.textContent = result.hint;

    for (var i = 0; i < requirements.length; i += 1) {
      var item = requirements[i];
      var key = item.getAttribute("data-requirement");
      var matched = result.requirements.some(function (entry) {
        return entry.key === key && entry.met;
      });
      item.classList.toggle("is-met", matched);
    }
  }

  function updateConfirmPasswordState() {
    var confirmField = byId("register-confirm-password");
    var confirmError = byId("register-confirm-password-error");
    if (!confirmField) {
      return;
    }
    if (!confirmField.value) {
      if (confirmError) {
        confirmError.hidden = true;
        confirmError.textContent = "";
      }
      return;
    }

    var passwordField = byId("register-password");
    var match = LutongValidate.confirmPassword(confirmField.value, passwordField ? passwordField.value : "");
    if (match.ok) {
      confirmField.removeAttribute("aria-invalid");
      if (confirmError) {
        confirmError.hidden = true;
        confirmError.textContent = "";
      }
    } else {
      confirmField.setAttribute("aria-invalid", "true");
      if (confirmError) {
        confirmError.textContent = match.message;
        confirmError.hidden = false;
      }
    }
  }

  function attachPasswordToggle(buttonId) {
    var trigger = byId(buttonId);
    if (!trigger) {
      return;
    }

    trigger.addEventListener("click", function () {
      var targetId = trigger.getAttribute("data-toggle-password");
      var field = byId(targetId);
      if (!field) {
        return;
      }
      var isPassword = field.type === "password";
      field.type = isPassword ? "text" : "password";
      trigger.textContent = isPassword ? "Hide" : "Show";
      trigger.setAttribute("aria-label", (isPassword ? "Hide" : "Show") + " " + (targetId.indexOf("confirm") !== -1 ? "confirm password" : "password"));
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearErrors();

    var name = byId("register-name");
    var username = byId("register-username");
    var email = byId("register-email");
    var password = byId("register-password");
    var confirmPassword = byId("register-confirm-password");

    var nameCheck = LutongValidate.fullName(name.value);
    var usernameCheck = LutongValidate.username(username.value);
    var emailCheck = LutongValidate.email(email.value);
    var passwordCheck = LutongValidate.password(password.value);
    var confirmPasswordCheck = LutongValidate.confirmPassword(confirmPassword.value, password.value);

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
    if (!passwordCheck.ok) {
      showFieldError("register-password", passwordCheck.message);
      LutongUI.setStatus(statusBox, "Please choose a stronger password and try again.", "error");
      password.focus();
      return;
    }
    if (!confirmPasswordCheck.ok) {
      showFieldError("register-confirm-password", confirmPasswordCheck.message);
      LutongUI.setStatus(statusBox, "Please confirm your password matches.", "error");
      confirmPassword.focus();
      return;
    }

    var result = LutongAuth.register(nameCheck.value, usernameCheck.value, emailCheck.value, passwordCheck.value);

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

    attachPasswordToggle("register-password-toggle");
    attachPasswordToggle("register-confirm-password-toggle");

    var passwordField = byId("register-password");
    if (passwordField) {
      passwordField.addEventListener("input", applyPasswordStrength);
      passwordField.addEventListener("blur", applyPasswordStrength);
    }

    var confirmField = byId("register-confirm-password");
    if (confirmField) {
      confirmField.addEventListener("input", updateConfirmPasswordState);
      confirmField.addEventListener("blur", updateConfirmPasswordState);
    }

    form.addEventListener("submit", handleSubmit);
    applyPasswordStrength();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
