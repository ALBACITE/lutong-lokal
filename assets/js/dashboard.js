/* ==========================================================================
   Lutong Lokal — assets/js/dashboard.js
   The customer dashboard: shows the signed-in demo account and the demo
   orders placed on this device or under that account, with their status.

   Opening this page does NOT prove who you are. The session is a record in
   localStorage, so anybody using this browser can see it. The page says so
   on screen.
   ========================================================================== */

(function () {
  "use strict";

  var signedOutBox = null;
  var signedInBox = null;
  var ordersBox = null;

  function byId(id) {
    return document.getElementById(id);
  }

  /* Builds one order card. */
  function buildOrderCard(order) {
    var card = document.createElement("article");
    card.className = "card";
    card.setAttribute("data-order-id", order.id);

    var body = document.createElement("div");
    body.className = "card-body";

    var head = document.createElement("div");
    head.className = "order-card-head";

    var idNode = document.createElement("strong");
    idNode.className = "mono";
    idNode.textContent = order.id;

    var statusNode = document.createElement("span");
    statusNode.className = LutongOrders.statusClass(order.status);
    statusNode.setAttribute("data-order-status", order.id);
    statusNode.textContent = order.status;

    head.appendChild(idNode);
    head.appendChild(statusNode);

    var meta = document.createElement("p");
    meta.className = "text-muted";
    meta.style.marginBottom = "0.75rem";
    meta.textContent = "Placed " + LutongUI.formatDateTime(order.createdAt) + " — pick up " + order.pickupTime.toLowerCase();

    var list = document.createElement("ul");
    list.className = "order-card-items";

    for (var i = 0; i < order.items.length; i += 1) {
      var item = order.items[i];
      var row = document.createElement("li");
      row.textContent = item.quantity + " x " + item.name + " — " + LutongUI.formatMoney(item.lineTotal);
      list.appendChild(row);
    }

    var total = document.createElement("p");
    total.className = "price";
    total.style.marginBottom = "0.75rem";
    total.textContent = "Total " + LutongUI.formatMoney(order.total);

    var details = document.createElement("p");
    details.className = "text-muted";
    details.style.marginBottom = "0";
    details.textContent =
      "Collecting as " + order.customerName +
      (order.phone ? " — " + order.phone : "") +
      (order.pickupNote ? " — note: " + order.pickupNote : "");

    body.appendChild(head);
    body.appendChild(meta);
    body.appendChild(list);
    body.appendChild(total);
    body.appendChild(details);

    card.appendChild(body);
    return card;
  }

  function renderOrders() {
    if (!ordersBox) {
      return;
    }

    var session = LutongAuth.getSession();
    var orders = LutongOrders.getForCustomer(session ? session.username : "");

    ordersBox.innerHTML = "";

    if (orders.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";

      var heading = document.createElement("h3");
      heading.textContent = "No demo orders yet";

      var text = document.createElement("p");
      text.textContent =
        "You have not placed a demo pickup order on this device. Orders you place will appear here with their status.";

      var actions = document.createElement("div");
      actions.className = "button-row";

      var menuLink = document.createElement("a");
      menuLink.className = "btn btn-primary";
      menuLink.href = "menu.html";
      menuLink.textContent = "Browse the food menu";

      actions.appendChild(menuLink);
      empty.appendChild(heading);
      empty.appendChild(text);
      empty.appendChild(actions);
      ordersBox.appendChild(empty);
      return;
    }

    for (var i = 0; i < orders.length; i += 1) {
      ordersBox.appendChild(buildOrderCard(orders[i]));
    }
  }

  function renderAccount(session) {
    var nameNode = byId("account-display-name");
    var usernameNode = byId("account-username");
    var emailNode = byId("account-email");
    var sinceNode = byId("account-since");
    var welcomeBox = byId("dashboard-welcome");

    if (nameNode) {
      nameNode.textContent = session.displayName;
    }
    if (usernameNode) {
      usernameNode.textContent = session.username;
    }
    if (emailNode) {
      emailNode.textContent = session.email;
    }
    if (sinceNode) {
      sinceNode.textContent = LutongUI.formatDateTime(session.loginAt);
    }
    if (welcomeBox) {
      welcomeBox.hidden = !session.isNew;
      if (session.isNew) {
        welcomeBox.textContent =
          "Welcome, " + session.displayName + ". Your demo customer account is ready and you are signed in.";
      }
    }
  }

  function render() {
    var session = LutongAuth.getSession();

    if (!session) {
      if (signedOutBox) {
        signedOutBox.hidden = false;
      }
      if (signedInBox) {
        signedInBox.hidden = true;
      }
      return;
    }

    if (signedOutBox) {
      signedOutBox.hidden = true;
    }
    if (signedInBox) {
      signedInBox.hidden = false;
    }

    renderAccount(session);
    renderOrders();
  }

  function init() {
    signedOutBox = byId("dashboard-signed-out");
    signedInBox = byId("dashboard-signed-in");
    ordersBox = byId("dashboard-orders");

    if (!signedOutBox && !signedInBox) {
      return;
    }

    render();

    // If the admin changes an order status in another tab, this page updates
    // without a manual refresh.
    window.addEventListener("storage", function (event) {
      if (event.key === "lutonglokal.orders.v1") {
        renderOrders();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
