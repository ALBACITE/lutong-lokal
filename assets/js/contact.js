/* ==========================================================================
   Lutong Lokal — assets/js/contact.js
   Validation and handling for the Contact page form.

   IMPORTANT: this prototype has no mail server and no email service. The
   message is validated and stored locally in the browser so the demo can
   show it in the admin area. Nothing is ever sent to a real person.
   ========================================================================== */

(function () {
  "use strict";

  var SUBJECT_OPTIONS = [
    "General enquiry",
    "Feedback about a meal",
    "Large order enquiry",
    "Report a problem"
  ];

  var form = null;
  var statusBox = null;
  var submittedOnce = false;

  function byId(id) {
    return document.getElementById(id);
  }

  /* Reads the form and validates every field. Returns the cleaned values
     or null when something is wrong. */
  function validateForm(showAll) {
    var nameField = byId("contact-name");
    var emailField = byId("contact-email");
    var subjectField = byId("contact-subject");
    var messageField = byId("contact-message");

    var nameResult = LutongValidate.applyRule(
      function () { return LutongValidate.fullName(nameField.value); },
      nameField,
      byId("contact-name-error")
    );

    var emailResult = LutongValidate.applyRule(
      function () { return LutongValidate.email(emailField.value); },
      emailField,
      byId("contact-email-error")
    );

    var subjectResult = LutongValidate.applyRule(
      function () {
        var value = String(subjectField.value || "").trim();
        if (!value) {
          return { ok: false, message: "Please choose a subject." };
        }
        if (SUBJECT_OPTIONS.indexOf(value) === -1) {
          return { ok: false, message: "Please choose a subject from the list." };
        }
        return { ok: true, value: value };
      },
      subjectField,
      byId("contact-subject-error")
    );

    var messageResult = LutongValidate.applyRule(
      function () { return LutongValidate.message(messageField.value, "Message", 10); },
      messageField,
      byId("contact-message-error")
    );

    var results = [nameResult, emailResult, subjectResult, messageResult];
    var allOk = true;

    for (var i = 0; i < results.length; i += 1) {
      if (!results[i].ok) {
        allOk = false;
      }
    }

    if (!allOk && showAll) {
      // Move focus to the first field that failed so keyboard and screen
      // reader users know where to look.
      for (var j = 0; j < results.length; j += 1) {
        if (!results[j].ok) {
          var fields = [nameField, emailField, subjectField, messageField];
          if (fields[j]) {
            fields[j].focus();
          }
          break;
        }
      }
    }

    if (!allOk) {
      return null;
    }

    return {
      name: nameResult.value,
      email: emailResult.value,
      subject: subjectResult.value,
      message: messageResult.value
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    submittedOnce = true;

    var values = validateForm(true);

    if (!values) {
      LutongUI.setStatus(
        statusBox,
        "Your message was not sent. Please fix the highlighted fields and try again.",
        "error"
      );
      return;
    }

    var messages = lutongGetMessages();
    messages.unshift({
      id: "msg_" + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      name: values.name,
      email: values.email,
      subject: values.subject,
      message: values.message
    });
    lutongSaveMessages(messages);

    form.reset();
    LutongUI.setStatus(
      statusBox,
      "Thanks, " + values.name + ". Your message passed validation and was stored on this device only. " +
        "This prototype does not send real emails and no one received your message.",
      "success"
    );
    byId("contact-name").focus();
  }

  function setupLiveValidation() {
    if (!form) {
      return;
    }

    var watched = [
      { field: byId("contact-name"), rule: function () { return LutongValidate.fullName(this.value); } },
      { field: byId("contact-email"), rule: function () { return LutongValidate.email(this.value); } },
      { field: byId("contact-message"), rule: function () { return LutongValidate.message(this.value, "Message", 10); } }
    ];

    for (var i = 0; i < watched.length; i += 1) {
      (function (entry) {
        if (!entry.field) {
          return;
        }
        entry.field.addEventListener("blur", function () {
          if (submittedOnce) {
            var errorId = entry.field.id + "-error";
            LutongValidate.applyRule(
              function () { return entry.rule.call(entry.field); },
              entry.field,
              byId(errorId)
            );
          }
        });
      })(watched[i]);
    }
  }

  function init() {
    form = byId("contact-form");
    statusBox = byId("contact-status");

    if (!form) {
      return;
    }

    form.addEventListener("submit", handleSubmit);
    setupLiveValidation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
