/* ==========================================================================
   THE UNKNOWN COFFEE — assets/js/validate.js
   Shared form validation helpers.

   Every rule lives here so the menu order form, the contact form, the
   register form and the admin forms all behave the same way.

   Each rule returns an object: { ok: true } or { ok: false, message: "..." }
   ========================================================================== */

var LutongValidate = (function () {
  "use strict";

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  var NAME_PATTERN = /^[A-Za-zÀ-ÿ' .\-]+$/;
  var USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
  var PHONE_PATTERN = /^[0-9+()\- ]+$/;

  function text(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  /* A small helper so every failed rule looks the same. */
  function fail(message) {
    return { ok: false, message: message };
  }

  function required(value, label) {
    if (text(value) === "") {
      return fail(label + " is required.");
    }
    return { ok: true, value: text(value) };
  }

  function fullName(value) {
    var base = required(value, "Full name");
    if (!base.ok) {
      return base;
    }

    var name = base.value;

    if (name.length < 2) {
      return fail("Full name must be at least 2 characters long.");
    }
    if (name.length > 60) {
      return fail("Full name must be 60 characters or fewer.");
    }
    if (!NAME_PATTERN.test(name)) {
      return fail("Full name may only contain letters, spaces, apostrophes, periods and hyphens.");
    }

    return { ok: true, value: name };
  }

  function username(value) {
    var base = required(value, "Username");
    if (!base.ok) {
      return base;
    }

    var name = base.value;

    if (name.length < 3) {
      return fail("Username must be at least 3 characters long.");
    }
    if (name.length > 30) {
      return fail("Username must be 30 characters or fewer.");
    }
    if (!USERNAME_PATTERN.test(name)) {
      return fail("Username may only contain letters, numbers, dots, underscores and hyphens.");
    }

    return { ok: true, value: name };
  }

  function email(value) {
    var base = required(value, "Email address");
    if (!base.ok) {
      return base;
    }

    var address = base.value;

    if (address.length > 120) {
      return fail("Email address must be 120 characters or fewer.");
    }
    if (!EMAIL_PATTERN.test(address)) {
      return fail("Enter a valid email address, for example demo@lutonglokal.test.");
    }

    return { ok: true, value: address };
  }

  /* Phone is optional for the prototype, but must look like a phone number
     when it is filled in. */
  function phone(value, label) {
    var name = label || "Phone number";
    var raw = text(value);

    if (raw === "") {
      return { ok: true, value: "" };
    }
    if (raw.length > 20) {
      return fail(name + " must be 20 characters or fewer.");
    }
    if (!PHONE_PATTERN.test(raw)) {
      return fail(name + " may only contain numbers, spaces and the symbols + ( ) -.");
    }

    return { ok: true, value: raw };
  }

  function message(value, label, minLength) {
    var name = label || "Message";
    var minimum = typeof minLength === "number" ? minLength : 10;
    var base = required(value, name);
    if (!base.ok) {
      return base;
    }

    var body = base.value;

    if (body.length < minimum) {
      return fail(name + " must be at least " + minimum + " characters long.");
    }
    if (body.length > 1000) {
      return fail(name + " must be 1000 characters or fewer.");
    }

    return { ok: true, value: body };
  }

  function price(value) {
    var amount = Number(value);

    if (text(value) === "" || !isFinite(amount)) {
      return fail("Price must be a number.");
    }
    if (amount < 0) {
      return fail("Price cannot be negative.");
    }
    if (amount > 100000) {
      return fail("Price is too large. Use a value below 100000.");
    }

    return { ok: true, value: Math.round(amount * 100) / 100 };
  }

  function quantity(value, max) {
    var amount = Math.floor(Number(value));
    var limit = typeof max === "number" ? max : 99;

    if (text(value) === "" || !isFinite(amount)) {
      return fail("Quantity must be a whole number.");
    }
    if (amount < 1) {
      return fail("Quantity must be at least 1.");
    }
    if (amount > limit) {
      return fail("Quantity must be " + limit + " or fewer.");
    }

    return { ok: true, value: amount };
  }

  /* ------------------------------------------------------------------
     DOM helpers
     ------------------------------------------------------------------ */
  function setFieldError(field, errorElement, message) {
    if (field) {
      field.setAttribute("aria-invalid", "true");
    }
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.hidden = false;
    }
  }

  function clearFieldError(field, errorElement) {
    if (field) {
      field.removeAttribute("aria-invalid");
    }
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.hidden = true;
    }
  }

  /* Runs a rule and paints the result onto the page. */
  function applyRule(rule, field, errorElement) {
    var result = rule();

    if (result.ok) {
      clearFieldError(field, errorElement);
    } else {
      setFieldError(field, errorElement, result.message);
    }

    return result;
  }

  return {
    required: required,
    fullName: fullName,
    username: username,
    email: email,
    phone: phone,
    message: message,
    price: price,
    quantity: quantity,
    setFieldError: setFieldError,
    clearFieldError: clearFieldError,
    applyRule: applyRule
  };
})();
