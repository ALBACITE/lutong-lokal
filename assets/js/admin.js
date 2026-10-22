/* ==========================================================================
   Lutong Lokal — assets/js/admin.js
   The demo admin area: manage menu items and their availability, view the
   demo orders and change their status.

   IMPORTANT
   ---------
   The check below happens in the browser, so it is NOT a security boundary.
   Anybody can open this page, or edit localStorage by hand, to get past it.
   A real system would enforce the admin role on a trusted server. The page
   says this on screen.
   ========================================================================== */

(function () {
  "use strict";

  var deniedBox = null;
  var contentBox = null;
  var menuTable = null;
  var ordersTable = null;
  var messagesBox = null;
  var statusBox = null;
  var form = null;
  var editingId = null;

  function byId(id) {
    return document.getElementById(id);
  }

  /* ------------------------------------------------------------------
     Menu table
     ------------------------------------------------------------------ */
  function buildMenuRow(item) {
    var row = document.createElement("tr");
    row.setAttribute("data-menu-row", item.id);

    var nameCell = document.createElement("td");
    var nameNode = document.createElement("strong");
    nameNode.textContent = item.name;
    nameCell.appendChild(nameNode);

    var categoryCell = document.createElement("td");
    categoryCell.textContent = LutongUI.categoryName(item.category);

    var priceCell = document.createElement("td");
    priceCell.textContent = LutongUI.formatMoney(item.price);

    var availableCell = document.createElement("td");
    var availableBadge = document.createElement("span");
    availableBadge.className = item.available ? "badge badge-available" : "badge badge-soldout";
    availableBadge.setAttribute("data-availability", item.id);
    availableBadge.textContent = item.available ? "Available" : "Sold out";
    availableCell.appendChild(availableBadge);

    var actionsCell = document.createElement("td");
    var actions = document.createElement("div");
    actions.className = "button-row";
    actions.style.marginBottom = "0";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn btn-outline btn-sm";
    toggle.setAttribute("data-toggle-availability", item.id);
    toggle.textContent = item.available ? "Mark sold out" : "Mark available";
    toggle.setAttribute("aria-label", (item.available ? "Mark " : "Make ") + item.name + (item.available ? " sold out" : " available again"));

    var edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-outline btn-sm";
    edit.setAttribute("data-edit-item", item.id);
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", "Edit " + item.name);

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-danger btn-sm";
    remove.setAttribute("data-delete-item", item.id);
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", "Delete " + item.name);

    actions.appendChild(toggle);
    actions.appendChild(edit);
    actions.appendChild(remove);
    actionsCell.appendChild(actions);

    row.appendChild(nameCell);
    row.appendChild(categoryCell);
    row.appendChild(priceCell);
    row.appendChild(availableCell);
    row.appendChild(actionsCell);

    return row;
  }

  function renderMenu() {
    if (!menuTable) {
      return;
    }

    var menu = lutongGetMenu();
    var body = menuTable.tBodies[0];
    body.innerHTML = "";

    for (var i = 0; i < menu.length; i += 1) {
      body.appendChild(buildMenuRow(menu[i]));
    }

    var countNode = byId("menu-item-count");
    if (countNode) {
      countNode.textContent = String(menu.length);
    }
  }

  /* ------------------------------------------------------------------
     Orders table
     ------------------------------------------------------------------ */
  function buildOrderRow(order) {
    var row = document.createElement("tr");
    row.setAttribute("data-order-row", order.id);

    var idCell = document.createElement("td");
    var idNode = document.createElement("span");
    idNode.className = "mono";
    idNode.textContent = order.id;
    idCell.appendChild(idNode);

    var whenCell = document.createElement("td");
    whenCell.textContent = LutongUI.formatDateTime(order.createdAt);

    var whoCell = document.createElement("td");
    whoCell.textContent = order.customerName;

    var itemsCell = document.createElement("td");
    var parts = [];
    for (var i = 0; i < order.items.length; i += 1) {
      parts.push(order.items[i].quantity + " x " + order.items[i].name);
    }
    itemsCell.textContent = parts.join(", ");

    var totalCell = document.createElement("td");
    totalCell.textContent = LutongUI.formatMoney(order.total);

    var statusCell = document.createElement("td");

    var select = document.createElement("select");
    select.setAttribute("data-order-status-select", order.id);
    select.setAttribute("aria-label", "Status of order " + order.id);

    for (var s = 0; s < LUTONG_ORDER_STATUSES.length; s += 1) {
      var option = document.createElement("option");
      option.value = LUTONG_ORDER_STATUSES[s].id;
      option.textContent = LUTONG_ORDER_STATUSES[s].label;
      if (LUTONG_ORDER_STATUSES[s].id === order.status) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    statusCell.appendChild(select);
    statusCell.appendChild(document.createElement("br"));

    var pill = document.createElement("span");
    pill.className = LutongOrders.statusClass(order.status);
    pill.setAttribute("data-order-status", order.id);
    pill.textContent = order.status;
    statusCell.appendChild(pill);

    row.appendChild(idCell);
    row.appendChild(whenCell);
    row.appendChild(whoCell);
    row.appendChild(itemsCell);
    row.appendChild(totalCell);
    row.appendChild(statusCell);

    return row;
  }

  function renderOrders() {
    if (!ordersTable) {
      return;
    }

    var orders = LutongOrders.getAll();
    var body = ordersTable.tBodies[0];

    body.innerHTML = "";

    if (orders.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.className = "text-muted";
      emptyCell.textContent = "No demo orders yet. Place a pickup order from the cart page to see it here.";
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);

      var countNode = byId("order-count");
      if (countNode) {
        countNode.textContent = "0";
      }
      return;
    }

    for (var i = 0; i < orders.length; i += 1) {
      body.appendChild(buildOrderRow(orders[i]));
    }

    var countNode2 = byId("order-count");
    if (countNode2) {
      countNode2.textContent = String(orders.length);
    }
  }

  /* ------------------------------------------------------------------
     Contact messages
     ------------------------------------------------------------------ */
  function renderMessages() {
    if (!messagesBox) {
      return;
    }

    var messages = lutongGetMessages();
    messagesBox.innerHTML = "";

    if (messages.length === 0) {
      var empty = document.createElement("p");
      empty.className = "text-muted";
      empty.textContent = "No messages have been sent from the contact page yet.";
      messagesBox.appendChild(empty);
      return;
    }

    for (var i = 0; i < messages.length; i += 1) {
      var message = messages[i];
      var box = document.createElement("div");
      box.className = "card";
      box.style.marginBottom = "1rem";

      var body = document.createElement("div");
      body.className = "card-body";

      var title = document.createElement("h3");
      title.className = "card-title";
      title.textContent = message.subject;

      var from = document.createElement("p");
      from.className = "text-muted";
      from.style.marginBottom = "0.5rem";
      from.textContent = message.name + " (" + message.email + ") — " + LutongUI.formatDateTime(message.createdAt);

      var text = document.createElement("p");
      text.style.marginBottom = "0";
      text.textContent = message.message;

      body.appendChild(title);
      body.appendChild(from);
      body.appendChild(text);
      box.appendChild(body);
      messagesBox.appendChild(box);
    }
  }

  /* Makes sure the category dropdown lists every real category from
     data.js. The "All Items" entry is a filter, not a dish category, so it is
     left out. */
  function syncCategoryOptions() {
    var select = byId("menu-item-category");
    if (!select) {
      return;
    }

    var existing = {};
    var options = select.options;
    for (var i = 0; i < options.length; i += 1) {
      existing[options[i].value] = true;
    }

    for (var c = 0; c < LUTONG_CATEGORIES.length; c += 1) {
      var category = LUTONG_CATEGORIES[c];
      if (category.id === "all" || existing[category.id]) {
        continue;
      }

      var option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    }
  }

  /* ------------------------------------------------------------------
     Add / edit a menu item
     ------------------------------------------------------------------ */
  function resetForm() {
    editingId = null;
    if (form) {
      form.reset();
    }

    var title = byId("menu-form-title");
    var submit = byId("menu-form-submit");
    var cancel = byId("menu-form-cancel");

    if (title) {
      title.textContent = "Add a menu item";
    }
    if (submit) {
      submit.textContent = "Add item";
    }
    if (cancel) {
      cancel.hidden = true;
    }
  }

  function startEdit(itemId) {
    var menu = lutongGetMenu();
    var item = null;

    for (var i = 0; i < menu.length; i += 1) {
      if (menu[i].id === itemId) {
        item = menu[i];
        break;
      }
    }

    if (!item) {
      LutongUI.setStatus(statusBox, "That menu item no longer exists.", "error");
      return;
    }

    editingId = item.id;

    byId("menu-item-name").value = item.name;
    byId("menu-item-description").value = item.description;
    byId("menu-item-price").value = String(item.price);
    byId("menu-item-category").value = item.category;
    byId("menu-item-image").value = item.image;
    byId("menu-item-available").checked = item.available;

    var title = byId("menu-form-title");
    var submit = byId("menu-form-submit");
    var cancel = byId("menu-form-cancel");

    if (title) {
      title.textContent = "Edit \"" + item.name + "\"";
    }
    if (submit) {
      submit.textContent = "Save changes";
    }
    if (cancel) {
      cancel.hidden = false;
    }

    clearFormErrors();
    byId("menu-item-name").focus();
    byId("menu-item-name").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearFormErrors() {
    var ids = ["menu-item-name", "menu-item-description", "menu-item-price", "menu-item-category", "menu-item-image"];
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

  function showFormError(fieldId, message) {
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

  function handleMenuSubmit(event) {
    event.preventDefault();
    clearFormErrors();

    var nameField = byId("menu-item-name");
    var descriptionField = byId("menu-item-description");
    var priceField = byId("menu-item-price");
    var categoryField = byId("menu-item-category");
    var imageField = byId("menu-item-image");
    var availableField = byId("menu-item-available");

    var nameCheck = LutongValidate.required(nameField.value, "Dish name");
    if (nameCheck.ok && (nameCheck.value.length < 2 || nameCheck.value.length > 80)) {
      nameCheck = { ok: false, message: "Dish name must be between 2 and 80 characters." };
    }

    var descriptionCheck = LutongValidate.required(descriptionField.value, "Description");
    if (descriptionCheck.ok && (descriptionCheck.value.length < 5 || descriptionCheck.value.length > 400)) {
      descriptionCheck = { ok: false, message: "Description must be between 5 and 400 characters." };
    }

    var priceCheck = LutongValidate.price(priceField.value);

    var categoryValue = String(categoryField.value || "");
    var categoryCheck = { ok: true, value: categoryValue };
    var allowed = false;
    for (var c = 0; c < LUTONG_CATEGORIES.length; c += 1) {
      if (LUTONG_CATEGORIES[c].id === categoryValue && categoryValue !== "all") {
        allowed = true;
      }
    }
    if (!categoryValue) {
      categoryCheck = { ok: false, message: "Please choose a category." };
    } else if (!allowed) {
      categoryCheck = { ok: false, message: "Please choose a category from the list." };
    }

    var imageValue = String(imageField.value || "").trim();
    var imageCheck = { ok: true, value: imageValue };
    if (!imageValue) {
      imageCheck = { ok: false, message: "Please enter an image URL." };
    } else if (imageValue.length > 500) {
      imageCheck = { ok: false, message: "Image URL must be 500 characters or fewer." };
    } else if (imageValue.indexOf("http://") !== 0 && imageValue.indexOf("https://") !== 0) {
      imageCheck = { ok: false, message: "Image URL must start with http:// or https://." };
    }

    var checks = [
      { id: "menu-item-name", result: nameCheck },
      { id: "menu-item-description", result: descriptionCheck },
      { id: "menu-item-price", result: priceCheck },
      { id: "menu-item-category", result: categoryCheck },
      { id: "menu-item-image", result: imageCheck }
    ];

    for (var i = 0; i < checks.length; i += 1) {
      if (!checks[i].result.ok) {
        showFormError(checks[i].id, checks[i].result.message);
      }
    }

    var firstBad = null;
    for (var j = 0; j < checks.length; j += 1) {
      if (!checks[j].result.ok) {
        firstBad = checks[j];
        break;
      }
    }

    if (firstBad) {
      var badField = byId(firstBad.id);
      if (badField) {
        badField.focus();
      }
      LutongUI.setStatus(statusBox, "The menu item was not saved. Please fix the highlighted fields.", "error");
      return;
    }

    var menu = lutongGetMenu();
    var available = availableField.checked;

    if (editingId) {
      var edited = false;
      for (var m = 0; m < menu.length; m += 1) {
        if (menu[m].id === editingId) {
          menu[m].name = nameCheck.value;
          menu[m].description = descriptionCheck.value;
          menu[m].price = priceCheck.value;
          menu[m].category = categoryValue;
          menu[m].image = imageValue;
          menu[m].available = available;
          edited = true;
          break;
        }
      }

      if (!edited) {
        LutongUI.setStatus(statusBox, "That menu item no longer exists, so nothing was changed.", "error");
        resetForm();
        return;
      }

      lutongSaveMenu(menu);
      LutongUI.setStatus(statusBox, "\"" + nameCheck.value + "\" was updated.", "success");
    } else {
      var newId = "m_" + Date.now().toString(36);
      menu.push({
        id: newId,
        name: nameCheck.value,
        description: descriptionCheck.value,
        price: priceCheck.value,
        category: categoryValue,
        image: imageValue,
        available: available,
        featured: false,
        createdAt: new Date().toISOString()
      });
      lutongSaveMenu(menu);
      LutongUI.setStatus(statusBox, "\"" + nameCheck.value + "\" was added to the demo menu.", "success");
    }

    resetForm();
    renderMenu();
  }

  function toggleAvailability(itemId) {
    var menu = lutongGetMenu();
    var changed = null;

    for (var i = 0; i < menu.length; i += 1) {
      if (menu[i].id === itemId) {
        menu[i].available = !menu[i].available;
        changed = menu[i];
        break;
      }
    }

    if (!changed) {
      LutongUI.setStatus(statusBox, "That menu item no longer exists.", "error");
      return;
    }

    lutongSaveMenu(menu);
    renderMenu();
    LutongUI.setStatus(
      statusBox,
      changed.name + " is now marked as " + (changed.available ? "available" : "sold out") + ".",
      "success"
    );
  }

  function deleteItem(itemId) {
    var menu = lutongGetMenu();
    var kept = [];
    var removed = null;

    for (var i = 0; i < menu.length; i += 1) {
      if (menu[i].id === itemId && !removed) {
        removed = menu[i];
      } else {
        kept.push(menu[i]);
      }
    }

    if (!removed) {
      LutongUI.setStatus(statusBox, "That menu item no longer exists.", "error");
      return;
    }

    lutongSaveMenu(kept);

    // If the item was in somebody's cart, remove that line too.
    var lines = lutongGetCart();
    var keptLines = [];
    for (var j = 0; j < lines.length; j += 1) {
      if (lines[j].itemId !== itemId) {
        keptLines.push(lines[j]);
      }
    }
    lutongSaveCart(keptLines);
    LutongUI.refreshCartBadge();

    renderMenu();
    LutongUI.setStatus(statusBox, "\"" + removed.name + "\" was deleted from the demo menu.", "success");
  }

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */
  function handleMenuClick(event) {
    var target = event.target;
    if (!target || !target.closest) {
      return;
    }

    var editButton = target.closest("[data-edit-item]");
    if (editButton) {
      startEdit(editButton.getAttribute("data-edit-item"));
      return;
    }

    var toggleButton = target.closest("[data-toggle-availability]");
    if (toggleButton) {
      toggleAvailability(toggleButton.getAttribute("data-toggle-availability"));
      return;
    }

    var deleteButton = target.closest("[data-delete-item]");
    if (deleteButton) {
      // A confirmation step before anything is deleted.
      var itemId = deleteButton.getAttribute("data-delete-item");
      var actions = deleteButton.parentNode;
      var menu = lutongGetMenu();
      var name = "this item";
      for (var i = 0; i < menu.length; i += 1) {
        if (menu[i].id === itemId) {
          name = menu[i].name;
        }
      }

      actions.innerHTML = "";

      var confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "btn btn-danger btn-sm";
      confirm.setAttribute("data-confirm-delete", itemId);
      confirm.textContent = "Really delete " + name;

      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-outline btn-sm";
      cancel.setAttribute("data-cancel-delete", itemId);
      cancel.textContent = "Keep it";

      actions.appendChild(confirm);
      actions.appendChild(cancel);

      confirm.addEventListener("click", function () {
        deleteItem(itemId);
      });
      cancel.addEventListener("click", function () {
        renderMenu();
      });
    }
  }

  function handleStatusChange(event) {
    var target = event.target;
    if (!target || !target.getAttribute) {
      return;
    }

    var orderId = target.getAttribute("data-order-status-select");
    if (!orderId) {
      return;
    }

    var newStatus = target.value;
    var changed = LutongOrders.setStatus(orderId, newStatus);

    if (!changed) {
      LutongUI.setStatus(statusBox, "That order status could not be saved.", "error");
      return;
    }

    renderOrders();
    LutongUI.setStatus(statusBox, "Order " + orderId + " is now \"" + newStatus + "\".", "success");
  }

  function init() {
    deniedBox = byId("admin-denied");
    contentBox = byId("admin-content");
    menuTable = byId("admin-menu-table");
    ordersTable = byId("admin-orders-table");
    messagesBox = byId("admin-messages");
    statusBox = byId("admin-status");
    form = byId("menu-form");

    var session = LutongAuth.getSession();

    if (!session || !LutongAuth.isAdmin(session)) {
      if (deniedBox) {
        deniedBox.hidden = false;
      }
      if (contentBox) {
        contentBox.hidden = true;
      }
      return;
    }

    if (deniedBox) {
      deniedBox.hidden = true;
    }
    if (contentBox) {
      contentBox.hidden = false;
    }

    syncCategoryOptions();
    renderMenu();
    renderOrders();
    renderMessages();

    if (form) {
      form.addEventListener("submit", handleMenuSubmit);
    }

    var cancelButton = byId("menu-form-cancel");
    if (cancelButton) {
      cancelButton.addEventListener("click", resetForm);
    }

    if (menuTable) {
      menuTable.addEventListener("click", handleMenuClick);
    }

    if (ordersTable) {
      ordersTable.addEventListener("change", handleStatusChange);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
