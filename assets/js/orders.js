/* ==========================================================================
   Lutong Lokal — assets/js/orders.js
   Shared helpers for demo orders.

   Used by:
   - cart.js     (creates an order when a pickup order is submitted)
   - dashboard.js (lists the orders for the signed-in customer)
   - admin.js    (lists every demo order and changes the status)

   Everything here is DEMO data stored in this browser only.
   ========================================================================== */

var LutongOrders = (function () {
  "use strict";

  /* Builds a unique demo order id such as LL-20261022-K3F9.
     The random part is checked against the orders that already exist so
     two orders can never share an id. */
  function generateOrderId(existingIds) {
    var taken = existingIds || [];
    var today = new Date();

    function pad(number) {
      return number < 10 ? "0" + number : String(number);
    }

    var datePart =
      today.getFullYear() +
      pad(today.getMonth() + 1) +
      pad(today.getDate());

    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (var attempt = 0; attempt < 50; attempt += 1) {
      var suffix = "";
      for (var i = 0; i < 4; i += 1) {
        suffix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      }

      var candidate = "LL-" + datePart + "-" + suffix;
      if (taken.indexOf(candidate) === -1) {
        return candidate;
      }
    }

    // Extremely unlikely fallback: add a timestamp so the id is still unique.
    return "LL-" + datePart + "-" + Date.now().toString(36).toUpperCase();
  }

  /* Builds an order record from the cart lines and the pickup details. */
  function buildOrder(lines, details, ownerUsername) {
    var orders = lutongGetOrders();
    var existingIds = [];
    for (var i = 0; i < orders.length; i += 1) {
      existingIds.push(orders[i].id);
    }

    var items = [];
    var itemCount = 0;

    for (var j = 0; j < lines.length; j += 1) {
      var line = lines[j];
      var lineTotal = Math.round(line.price * 100) * line.quantity / 100;

      items.push({
        name: line.name,
        price: line.price,
        quantity: line.quantity,
        lineTotal: lineTotal
      });

      itemCount += line.quantity;
    }

    var subtotal = lutongSumMoney(items);

    return {
      id: generateOrderId(existingIds),
      createdAt: new Date().toISOString(),
      ownerUsername: ownerUsername || "",
      customerName: details.customerName,
      contactEmail: details.contactEmail,
      phone: details.phone,
      pickupTime: details.pickupTime,
      pickupNote: details.pickupNote,
      items: items,
      subtotal: subtotal,
      itemCount: itemCount,
      total: subtotal,
      status: "Pending"
    };
  }

  /* Saves one order, newest first. */
  function saveOrder(order) {
    var orders = lutongGetOrders();
    orders.unshift(order);
    lutongSaveOrders(orders);
    return order;
  }

  /* All demo orders, newest first. */
  function getAll() {
    var orders = lutongGetOrders();
    orders.sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    return orders;
  }

  /* Orders that belong to a signed-in customer, plus any order placed on
     this device (tracked separately so guest orders are not lost). */
  function getForCustomer(username) {
    var all = getAll();
    var deviceIds = lutongGetMyOrderIds();
    var result = [];

    for (var i = 0; i < all.length; i += 1) {
      var order = all[i];
      var ownedByUser = username && order.ownerUsername === username;
      var placedOnDevice = deviceIds.indexOf(order.id) !== -1;

      if (ownedByUser || placedOnDevice) {
        result.push(order);
      }
    }

    return result;
  }

  /* Changes the status of one order. Returns true when it worked. */
  function setStatus(orderId, status) {
    if (!lutongIsValidStatus(status)) {
      return false;
    }

    var orders = lutongGetOrders();
    var found = false;

    for (var i = 0; i < orders.length; i += 1) {
      if (orders[i].id === orderId) {
        orders[i].status = status;
        found = true;
      }
    }

    if (found) {
      lutongSaveOrders(orders);
    }

    return found;
  }

  /* Looks up one order by id. */
  function findById(orderId) {
    var orders = lutongGetOrders();
    for (var i = 0; i < orders.length; i += 1) {
      if (orders[i].id === orderId) {
        return orders[i];
      }
    }
    return null;
  }

  /* The CSS class used for the status pill. */
  function statusClass(status) {
    switch (status) {
      case "Pending": return "status status-pending";
      case "Preparing": return "status status-preparing";
      case "Ready for Pickup": return "status status-ready";
      case "Completed": return "status status-completed";
      case "Cancelled": return "status status-cancelled";
      default: return "status";
    }
  }

  return {
    generateOrderId: generateOrderId,
    buildOrder: buildOrder,
    saveOrder: saveOrder,
    getAll: getAll,
    getForCustomer: getForCustomer,
    setStatus: setStatus,
    findById: findById,
    statusClass: statusClass
  };
})();
