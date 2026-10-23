/* ==========================================================================
   THE UNKNOWN COFFEE — assets/js/cart.js
   The Cart page: shows the cart lines, lets you change quantities, remove
   items, and submit a demo pickup order.

   The order is stored in this browser only. No payment is taken and no
   email is sent.
   ========================================================================== */

(function () {
  "use strict";

  var MAX_QUANTITY = 99;

  var linesBox = null;
  var emptyBox = null;
  var checkoutBox = null;
  var summaryBox = null;
  var form = null;
  var statusBox = null;
  var successBox = null;

  function byId(id) {
    return document.getElementById(id);
  }

  /* ------------------------------------------------------------------
     Availability
     A drink can be sold out (or removed by the admin) while it sits in the
     cart, so the menu is checked again before an order is submitted.
     ------------------------------------------------------------------ */
  function findUnavailableLine(lines) {
    var menu = lutongGetMenu();

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var item = null;

      for (var j = 0; j < menu.length; j += 1) {
        if (menu[j].id === line.itemId) {
          item = menu[j];
          break;
        }
      }

      if (!item) {
        return { line: line, reason: "is no longer on the menu" };
      }
      if (!item.available) {
        return { line: line, reason: "has just sold out" };
      }
    }

    return null;
  }

  /* ------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------ */
  function buildLine(line) {
    var row = document.createElement("div");
    row.className = "cart-line";

    var media = document.createElement("div");
    media.className = "cart-line-media";

    var img = document.createElement("img");
    img.src = line.image;
    img.alt = line.name + " drink";
    img.width = 84;
    img.height = 84;
    img.loading = "lazy";
    img.decoding = "async";
    img.setAttribute("data-fallback-text", line.name);

    var fallback = document.createElement("div");
    fallback.className = "card-fallback";
    fallback.hidden = true;
    var fallbackLabel = document.createElement("span");
    fallbackLabel.setAttribute("data-fallback-label", "");
    fallbackLabel.textContent = line.name;
    fallback.appendChild(fallbackLabel);

    media.appendChild(img);
    media.appendChild(fallback);

    var body = document.createElement("div");
    body.className = "cart-line-body";

    var name = document.createElement("p");
    name.className = "cart-line-name";
    var sizeLabel = line.size === "large" ? "Large" : "Medium";
    name.textContent = line.name + " — " + sizeLabel;

    var price = document.createElement("p");
    price.className = "cart-line-price";
    price.textContent = LutongUI.formatMoney(line.price) + " each";

    var actions = document.createElement("div");
    actions.className = "cart-line-actions";

    var qty = document.createElement("div");
    qty.className = "qty-control";

    var minus = document.createElement("button");
    minus.type = "button";
    minus.className = "qty-btn";
    minus.setAttribute("data-qty-action", "decrease");
    minus.setAttribute("data-item-id", line.itemId);
    minus.setAttribute("data-item-size", line.size);
    minus.setAttribute("aria-label", "Decrease the quantity of " + line.name);
    minus.textContent = "−";
    if (line.quantity <= 1) {
      minus.disabled = true;
    }

    var input = document.createElement("input");
    input.type = "number";
    input.className = "qty-input";
    input.value = String(line.quantity);
    input.min = "1";
    input.max = String(MAX_QUANTITY);
    input.setAttribute("data-qty-input", line.itemId);
    input.setAttribute("data-qty-size", line.size);
    input.setAttribute("aria-label", "Quantity of " + line.name);

    var plus = document.createElement("button");
    plus.type = "button";
    plus.className = "qty-btn";
    plus.setAttribute("data-qty-action", "increase");
    plus.setAttribute("data-item-id", line.itemId);
    plus.setAttribute("data-item-size", line.size);
    plus.setAttribute("aria-label", "Increase the quantity of " + line.name);
    plus.textContent = "+";
    if (line.quantity >= MAX_QUANTITY) {
      plus.disabled = true;
    }

    qty.appendChild(minus);
    qty.appendChild(input);
    qty.appendChild(plus);

    var lineTotal = document.createElement("span");
    lineTotal.className = "price";
    lineTotal.setAttribute("data-line-total", line.itemId + "-" + line.size);
    lineTotal.textContent = LutongUI.formatMoney(line.price * line.quantity);

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-button";
    remove.setAttribute("data-remove-item", line.itemId);
    remove.setAttribute("data-item-size", line.size);
    remove.setAttribute("aria-label", "Remove " + line.name + " from your cart");
    remove.textContent = "Remove";

    actions.appendChild(qty);
    actions.appendChild(lineTotal);
    actions.appendChild(remove);

    body.appendChild(name);
    body.appendChild(price);
    body.appendChild(actions);

    row.appendChild(media);
    row.appendChild(body);

    return row;
  }

  function renderSummary(lines) {
    if (!summaryBox) {
      return;
    }

    var subtotal = lutongSumMoney(lines);
    var itemCount = 0;

    for (var i = 0; i < lines.length; i += 1) {
      itemCount += lines[i].quantity;
    }

    summaryBox.innerHTML = "";

    function addRow(label, value, className) {
      var row = document.createElement("div");
      row.className = className || "summary-row";

      var labelNode = document.createElement("span");
      labelNode.textContent = label;

      var valueNode = document.createElement("span");
      valueNode.textContent = value;

      row.appendChild(labelNode);
      row.appendChild(valueNode);
      summaryBox.appendChild(row);
    }

    addRow("Items", String(itemCount));
    addRow("Subtotal", LutongUI.formatMoney(subtotal));
    addRow("Total to pay at the counter", LutongUI.formatMoney(subtotal), "summary-row total");
  }

  function render() {
    if (!linesBox) {
      return;
    }

    var lines = lutongGetCart();

    linesBox.innerHTML = "";

    if (lines.length === 0) {
      if (emptyBox) {
        emptyBox.hidden = false;
      }
      if (checkoutBox) {
        checkoutBox.hidden = true;
      }
      if (summaryBox) {
        summaryBox.hidden = true;
      }
      return;
    }

    if (emptyBox) {
      emptyBox.hidden = true;
    }
    if (checkoutBox) {
      checkoutBox.hidden = false;
    }
    if (summaryBox) {
      summaryBox.hidden = false;
    }

    for (var i = 0; i < lines.length; i += 1) {
      linesBox.appendChild(buildLine(lines[i]));
    }

    LutongUI.applyImageFallbacks(linesBox);
    renderSummary(lines);
  }

  /* ------------------------------------------------------------------
     Cart actions
     ------------------------------------------------------------------ */
  function changeQuantity(itemId, size, nextQuantity) {
    var lines = lutongGetCart();
    var changed = false;

    for (var i = 0; i < lines.length; i += 1) {
      if (lines[i].itemId === itemId && lines[i].size === size) {
        if (nextQuantity < 1) {
          lines.splice(i, 1);
        } else {
          lines[i].quantity = Math.min(nextQuantity, MAX_QUANTITY);
        }
        changed = true;
        break;
      }
    }

    if (!changed) {
      return;
    }

    lutongSaveCart(lines);
    LutongUI.refreshCartBadge();
    render();
  }

  function removeLine(itemId, size) {
    var lines = lutongGetCart();
    var removed = null;
    var kept = [];

    for (var i = 0; i < lines.length; i += 1) {
      if (lines[i].itemId === itemId && lines[i].size === size && !removed) {
        removed = lines[i];
      } else {
        kept.push(lines[i]);
      }
    }

    if (!removed) {
      return;
    }

    lutongSaveCart(kept);
    LutongUI.refreshCartBadge();
    render();
    LutongUI.setStatus(statusBox, removed.name + " was removed from your cart.", "info");
  }

  function clearCart() {
    lutongSaveCart([]);
    LutongUI.refreshCartBadge();
    render();
    LutongUI.setStatus(statusBox, "Your cart was emptied.", "info");
  }

  /* ------------------------------------------------------------------
     Pickup order form
     ------------------------------------------------------------------ */
  function validateOrderForm(showErrors) {
    var nameField = byId("order-name");
    var emailField = byId("order-email");
    var phoneField = byId("order-phone");
    var timeField = byId("order-pickup-time");
    var noteField = byId("order-note");

    var nameResult = LutongValidate.applyRule(
      function () { return LutongValidate.fullName(nameField.value); },
      nameField,
      byId("order-name-error")
    );

    var emailResult = LutongValidate.applyRule(
      function () { return LutongValidate.email(emailField.value); },
      emailField,
      byId("order-email-error")
    );

    var phoneResult = LutongValidate.applyRule(
      function () { return LutongValidate.phone(phoneField.value, "Phone number"); },
      phoneField,
      byId("order-phone-error")
    );

    var timeResult = LutongValidate.applyRule(
      function () {
        var value = String(timeField.value || "").trim();
        if (!value) {
          return { ok: false, message: "Please choose a pickup time." };
        }
        if (value.length > 60) {
          return { ok: false, message: "Pickup time is too long." };
        }
        return { ok: true, value: value };
      },
      timeField,
      byId("order-time-error")
    );

    var noteResult = LutongValidate.applyRule(
      function () {
        var value = String(noteField.value || "").trim();
        if (value.length > 400) {
          return { ok: false, message: "Note must be 400 characters or fewer." };
        }
        return { ok: true, value: value };
      },
      noteField,
      byId("order-note-error")
    );

    var results = [nameResult, emailResult, phoneResult, timeResult, noteResult];
    var allOk = true;

    for (var i = 0; i < results.length; i += 1) {
      if (!results[i].ok) {
        allOk = false;
      }
    }

    if (!allOk && showErrors) {
      var fields = [nameField, emailField, phoneField, timeField, noteField];
      for (var j = 0; j < results.length; j += 1) {
        if (!results[j].ok) {
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
      customerName: nameResult.value,
      contactEmail: emailResult.value,
      phone: phoneResult.value,
      pickupTime: timeResult.value,
      pickupNote: noteResult.value
    };
  }

  function showSuccess(order) {
    if (!successBox) {
      return;
    }

    successBox.innerHTML = "";

    var heading = document.createElement("h2");
    heading.textContent = "Your pickup order is placed";

    var paragraph = document.createElement("p");
    paragraph.textContent =
      "Thanks, " + order.customerName + ". Your order is saved in this browser as ";

    var idNode = document.createElement("span");
    idNode.className = "order-id";
    idNode.textContent = order.id;

    var totalText = document.createElement("p");
    totalText.textContent =
      "You asked for " + order.itemCount + " item(s) totalling " +
      LutongUI.formatMoney(order.total) + ". Pick up at the counter at " +
      order.pickupTime.toLowerCase() + ".";

    successBox.appendChild(totalText);

    var note = document.createElement("p");

    note.textContent =
      "No payment was taken and no email was sent. " +
      "You can follow the order status on your dashboard.";

    var pickupDetails = document.createElement("p");
    pickupDetails.textContent =
      "Pickup for " + order.pickupTime.toLowerCase() +
      (order.phone ? " — contact: " + order.phone : "") +
      (order.pickupNote ? " — drink request: " + order.pickupNote : "");

    var actions = document.createElement("div");
    actions.className = "button-row";

    var dashboardLink = document.createElement("a");
    dashboardLink.className = "btn btn-primary";
    dashboardLink.href = "dashboard.html";
    dashboardLink.textContent = "View my orders";

    var menuLink = document.createElement("a");
    menuLink.className = "btn btn-outline";
    menuLink.href = "menu.html";
    menuLink.textContent = "Order something else";

    actions.appendChild(dashboardLink);
    actions.appendChild(menuLink);

    successBox.appendChild(heading);
    successBox.appendChild(paragraph);
    successBox.appendChild(idNode);
    successBox.appendChild(totalText);
    successBox.appendChild(pickupDetails);
    successBox.appendChild(note);
    successBox.appendChild(actions);
    successBox.hidden = false;

    if (statusBox) {
      LutongUI.clearStatus(statusBox);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    var details = validateOrderForm(true);

    if (!details) {
      LutongUI.setStatus(
        statusBox,
        "Your pickup order was not submitted. Please fix the highlighted fields and try again.",
        "error"
      );
      return;
    }

    var lines = lutongGetCart();

    if (lines.length === 0) {
      LutongUI.setStatus(statusBox, "Your cart is empty, so there is nothing to order.", "error");
      return;
    }

    // Stop a sold-out drink from being ordered.
    var problem = findUnavailableLine(lines);
    if (problem) {
      LutongUI.setStatus(
        statusBox,
        problem.line.name + " " + problem.reason + ". Please remove it from your cart and try again.",
        "error"
      );
      return;
    }

    var session = lutongGetSession();
    var order = LutongOrders.buildOrder(lines, details, session ? session.username : "");

    LutongOrders.saveOrder(order);
    lutongAddMyOrderId(order.id);

    // The order is saved, so the cart is emptied.
    lutongSaveCart([]);
    LutongUI.refreshCartBadge();

    form.reset();
    render();
    showSuccess(order);

    successBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */
  function handleLinesClick(event) {
    var target = event.target;
    if (!target || !target.getAttribute) {
      return;
    }

    var actionButton = target.closest ? target.closest("[data-qty-action]") : null;
    if (actionButton) {
      var itemId = actionButton.getAttribute("data-item-id");
      var size = actionButton.getAttribute("data-item-size");
      var lines = lutongGetCart();
      var current = 0;

      for (var i = 0; i < lines.length; i += 1) {
        if (lines[i].itemId === itemId && lines[i].size === size) {
          current = lines[i].quantity;
          break;
        }
      }

      if (actionButton.getAttribute("data-qty-action") === "increase") {
        changeQuantity(itemId, size, current + 1);
      } else {
        changeQuantity(itemId, size, current - 1);
      }
      return;
    }

    var removeButton = target.closest ? target.closest("[data-remove-item]") : null;
    if (removeButton) {
      removeLine(
        removeButton.getAttribute("data-remove-item"),
        removeButton.getAttribute("data-item-size")
      );
    }
  }

  function handleQtyInput(event) {
    var target = event.target;
    if (!target || !target.getAttribute) {
      return;
    }

    var itemId = target.getAttribute("data-qty-input");
    var size = target.getAttribute("data-qty-size");
    if (!itemId) {
      return;
    }

    var result = LutongValidate.quantity(target.value, MAX_QUANTITY);
    if (!result.ok) {
      // Keep the field usable but show why it will not be accepted.
      target.setAttribute("aria-invalid", "true");
      LutongUI.setStatus(statusBox, result.message, "error");
      return;
    }

    target.removeAttribute("aria-invalid");
    changeQuantity(itemId, size, result.value);
  }

  function init() {
    linesBox = byId("cart-lines");
    emptyBox = byId("cart-empty");
    checkoutBox = byId("cart-checkout");
    summaryBox = byId("cart-summary");
    form = byId("order-form");
    statusBox = byId("cart-status");
    successBox = byId("order-success");

    if (!linesBox) {
      return;
    }

    linesBox.addEventListener("click", handleLinesClick);
    linesBox.addEventListener("change", handleQtyInput);

    if (form) {
      form.addEventListener("submit", handleSubmit);
    }

    var clearButton = byId("clear-cart");
    if (clearButton) {
      clearButton.addEventListener("click", clearCart);
    }

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
