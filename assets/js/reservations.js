/* ==========================================================================
   THE UNKNOWN COFFEE — shared browser-local seat reservations.
   The inventory and booking duration are configured together below.
   ========================================================================== */

var LUTONG_RESERVATION_CONFIG = {
  durationMinutes: 90,
  areas: [
    {
      id: "window",
      name: "Window Seating",
      description: "A bright spot by the window.",
      visual: "window",
      tables: [
        { id: "WIN-01", number: 1, capacity: 2 },
        { id: "WIN-02", number: 2, capacity: 2 },
        { id: "WIN-03", number: 3, capacity: 4 },
        { id: "WIN-04", number: 4, capacity: 4 }
      ]
    },
    {
      id: "indoor",
      name: "Indoor Seating",
      description: "Settle in for a cozy coffee break.",
      visual: "indoor",
      tables: [
        { id: "IND-01", number: 1, capacity: 2 },
        { id: "IND-02", number: 2, capacity: 2 },
        { id: "IND-03", number: 3, capacity: 2 },
        { id: "IND-04", number: 4, capacity: 4 },
        { id: "IND-05", number: 5, capacity: 4 },
        { id: "IND-06", number: 6, capacity: 6 }
      ]
    },
    {
      id: "outdoor",
      name: "Outdoor Seating",
      description: "Enjoy your drink in the open air.",
      visual: "outdoor",
      tables: [
        { id: "OUT-01", number: 1, capacity: 2 },
        { id: "OUT-02", number: 2, capacity: 2 },
        { id: "OUT-03", number: 3, capacity: 4 },
        { id: "OUT-04", number: 4, capacity: 4 }
      ]
    },
    {
      id: "regular",
      name: "Regular Seating",
      description: "A relaxed seat for everyday visits.",
      visual: "regular",
      tables: [
        { id: "REG-01", number: 1, capacity: 2 },
        { id: "REG-02", number: 2, capacity: 2 },
        { id: "REG-03", number: 3, capacity: 4 },
        { id: "REG-04", number: 4, capacity: 4 },
        { id: "REG-05", number: 5, capacity: 4 },
        { id: "REG-06", number: 6, capacity: 6 }
      ]
    }
  ]
};

var LutongReservations = (function () {
  "use strict";

  function getArea(areaId) {
    for (var i = 0; i < LUTONG_RESERVATION_CONFIG.areas.length; i += 1) {
      if (LUTONG_RESERVATION_CONFIG.areas[i].id === areaId) {
        return LUTONG_RESERVATION_CONFIG.areas[i];
      }
    }
    return null;
  }

  function getTable(areaId, tableId) {
    var area = getArea(areaId);
    if (!area) {
      return null;
    }
    for (var i = 0; i < area.tables.length; i += 1) {
      if (area.tables[i].id === tableId) {
        return area.tables[i];
      }
    }
    return null;
  }

  function getAll() {
    var stored = lutongGetReservations();
    var clean = [];
    for (var i = 0; i < stored.length; i += 1) {
      var table = getTable(stored[i].areaId, stored[i].tableId);
      if (!table || stored[i].guestCount > table.capacity) {
        continue;
      }
      stored[i].capacity = table.capacity;
      stored[i].tableNumber = String(table.number);
      clean.push(stored[i]);
    }
    return clean.sort(function (a, b) {
      var dateCompare = (a.reservationDate + "T" + a.reservationTime)
        .localeCompare(b.reservationDate + "T" + b.reservationTime);
      return dateCompare || String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function getForCustomer(username) {
    var all = getAll();
    var localIds = username ? [] : lutongGetMyReservationIds();
    var result = [];
    for (var i = 0; i < all.length; i += 1) {
      if ((username && all[i].ownerUsername === username) ||
          (!username && !all[i].ownerUsername && localIds.indexOf(all[i].id) !== -1)) {
        result.push(all[i]);
      }
    }
    return result;
  }

  function localDateTime(dateText, timeText) {
    var parts = dateText.split("-");
    var time = timeText.split(":");
    return new Date(
      Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
      Number(time[0]), Number(time[1]), 0, 0
    );
  }

  function isFutureDateTime(dateText, timeText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeText)) {
      return false;
    }
    var date = localDateTime(dateText, timeText);
    var parts = dateText.split("-");
    return date.getFullYear() === Number(parts[0]) &&
      date.getMonth() === Number(parts[1]) - 1 &&
      date.getDate() === Number(parts[2]) &&
      date.getTime() > Date.now();
  }

  function overlaps(startA, startB) {
    var duration = LUTONG_RESERVATION_CONFIG.durationMinutes * 60 * 1000;
    var endA = startA + duration;
    var endB = startB + duration;
    return startA < endB && startB < endA;
  }

  function isTableAvailable(areaId, tableId, dateText, timeText, reservations) {
    var requestedTable = getTable(areaId, tableId);
    if (!requestedTable || !isFutureDateTime(dateText, timeText)) {
      return false;
    }
    var requestedStart = localDateTime(dateText, timeText).getTime();
    var records = reservations || getAll();
    for (var i = 0; i < records.length; i += 1) {
      var record = records[i];
      if (record.areaId !== areaId || record.tableId !== tableId ||
          (record.status !== "Pending" && record.status !== "Approved") ||
          record.reservationDate !== dateText) {
        continue;
      }
      var existingStart = localDateTime(record.reservationDate, record.reservationTime).getTime();
      if (overlaps(requestedStart, existingStart)) {
        return false;
      }
    }
    return true;
  }

  function create(details) {
    var customerName = String(details.customerName || "").trim();
    var guestCount = Math.floor(Number(details.guestCount));
    var area = getArea(details.areaId);
    var table = getTable(details.areaId, details.tableId);
    var dateText = String(details.reservationDate || "");
    var timeText = String(details.reservationTime || "");

    if (customerName.length < 2 || customerName.length > 80) {
      return { ok: false, field: "reservation-name", message: "Enter your full name (2 to 80 characters)." };
    }
    if (!isFinite(guestCount) || guestCount < 1 || guestCount > 20) {
      return { ok: false, field: "reservation-guests", message: "Choose a valid number of guests." };
    }
    if (!area) {
      return { ok: false, field: "reservation-area", message: "Choose a seating area." };
    }
    if (!table) {
      return { ok: false, field: "reservation-tables", message: "Choose an available table." };
    }
    if (guestCount > table.capacity) {
      return { ok: false, field: "reservation-guests", message: "Table " + table.number + " seats up to " + table.capacity + " guests." };
    }
    if (!isFutureDateTime(dateText, timeText)) {
      return { ok: false, field: "reservation-date", message: "Choose a future date and time." };
    }

    var reservations = getAll();
    if (!isTableAvailable(area.id, table.id, dateText, timeText, reservations)) {
      return { ok: false, field: "reservation-tables", message: "That table is no longer available for this time. Please choose another table or time." };
    }

    var ids = [];
    for (var i = 0; i < reservations.length; i += 1) {
      ids.push(reservations[i].id);
    }
    var idPrefix = "RSV-" + Date.now().toString(36).toUpperCase();
    var candidate = idPrefix + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    var attempt = 0;
    while (ids.indexOf(candidate) !== -1) {
      attempt += 1;
      candidate = idPrefix + "-" + attempt.toString(36).toUpperCase();
    }

    var session = typeof LutongAuth !== "undefined" ? LutongAuth.getSession() : null;
    var reservation = {
      id: candidate,
      createdAt: new Date().toISOString(),
      ownerUsername: session && session.role === "user" ? session.username : "",
      customerName: customerName,
      areaId: area.id,
      tableId: table.id,
      tableNumber: String(table.number),
      capacity: table.capacity,
      guestCount: guestCount,
      reservationDate: dateText,
      reservationTime: timeText,
      specialRequests: String(details.specialRequests || "").trim(),
      status: "Pending"
    };

    reservations.unshift(reservation);
    if (!lutongSaveReservations(reservations)) {
      return { ok: false, field: "reservation-submit", message: "The reservation could not be saved in this browser. Check storage availability and try again." };
    }
    if (!reservation.ownerUsername) {
      lutongAddMyReservationId(reservation.id);
    }
    return { ok: true, reservation: reservation };
  }

  function setAdminStatus(id, status) {
    if (status !== "Approved" && status !== "Rejected") {
      return false;
    }
    var reservations = getAll();
    var found = null;
    for (var i = 0; i < reservations.length; i += 1) {
      if (reservations[i].id === id && reservations[i].status === "Pending") {
        reservations[i].status = status;
        found = reservations[i];
        break;
      }
    }
    return !!found && lutongSaveReservations(reservations);
  }

  function cancel(id, username) {
    var reservations = getAll();
    var localIds = username ? [] : lutongGetMyReservationIds();
    var found = null;
    for (var i = 0; i < reservations.length; i += 1) {
      var owned = username
        ? reservations[i].ownerUsername === username
        : !reservations[i].ownerUsername && localIds.indexOf(id) !== -1;
      if (reservations[i].id === id && owned &&
          (reservations[i].status === "Pending" || reservations[i].status === "Approved")) {
        reservations[i].status = "Cancelled";
        found = reservations[i];
        break;
      }
    }
    return !!found && lutongSaveReservations(reservations);
  }

  function areaName(areaId) {
    var area = getArea(areaId);
    return area ? area.name : "Unknown area";
  }

  function statusClass(status) {
    switch (status) {
      case "Pending": return "status status-pending";
      case "Approved": return "status reservation-status-approved";
      case "Rejected": return "status status-cancelled";
      case "Cancelled": return "status status-cancelled";
      default: return "status";
    }
  }

  function localToday() {
    var today = new Date();
    function pad(value) { return value < 10 ? "0" + value : String(value); }
    return today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());
  }

  return {
    config: LUTONG_RESERVATION_CONFIG,
    getAll: getAll,
    getForCustomer: getForCustomer,
    getArea: getArea,
    areaName: areaName,
    isTableAvailable: isTableAvailable,
    create: create,
    setAdminStatus: setAdminStatus,
    cancel: cancel,
    statusClass: statusClass,
    localToday: localToday,
    isFutureDateTime: isFutureDateTime
  };
})();

(function () {
  "use strict";

  var areaGrid;
  var tableGrid;
  var tableHelp;
  var form;
  var statusBox;
  var confirmation;
  var selectedAreaId = "";
  var selectedTableId = "";

  function byId(id) { return document.getElementById(id); }

  function renderAreas() {
    if (!areaGrid) { return; }
    areaGrid.innerHTML = "";
    var areas = LutongReservations.config.areas;
    for (var i = 0; i < areas.length; i += 1) {
      var area = areas[i];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "reservation-area-card" +
        (selectedAreaId === area.id ? " is-selected" : "");
      button.setAttribute("data-reservation-area", area.id);
      button.setAttribute("aria-pressed", selectedAreaId === area.id ? "true" : "false");

      var visual = document.createElement("span");
      visual.className = "reservation-area-visual reservation-visual-" + area.visual;
      visual.setAttribute("aria-hidden", "true");
      for (var shape = 0; shape < 3; shape += 1) {
        var piece = document.createElement("span");
        piece.className = "reservation-visual-piece reservation-visual-piece-" + shape;
        visual.appendChild(piece);
      }

      var title = document.createElement("strong");
      title.textContent = area.name;
      var description = document.createElement("span");
      description.textContent = area.description;
      var count = document.createElement("span");
      count.className = "reservation-area-count";
      count.textContent = area.tables.length + (area.tables.length === 1 ? " table" : " tables");

      button.appendChild(visual);
      button.appendChild(title);
      button.appendChild(description);
      button.appendChild(count);
      areaGrid.appendChild(button);
    }
  }

  function renderTables() {
    if (!tableGrid) { return; }
    tableGrid.innerHTML = "";
    if (!selectedAreaId) {
      tableHelp.textContent = "Choose a seating area to see its tables.";
      return;
    }

    var area = LutongReservations.getArea(selectedAreaId);
    var dateField = byId("reservation-date");
    var timeField = byId("reservation-time");
    var hasSchedule = dateField.value && timeField.value;
    var isValidSchedule = hasSchedule &&
      LutongReservations.isFutureDateTime(dateField.value, timeField.value);
    tableHelp.textContent = !hasSchedule
      ? "Choose a reservation date and time to check live availability."
      : !isValidSchedule
        ? "Choose a future date and time to check table availability."
        : "Select one available table. Capacity is shown on each table.";

    for (var i = 0; i < area.tables.length; i += 1) {
      var table = area.tables[i];
      var available = isValidSchedule && LutongReservations.isTableAvailable(
        selectedAreaId, table.id, dateField.value, timeField.value
      );
      if (selectedTableId === table.id && !available) {
        selectedTableId = "";
      }
      var selected = selectedTableId === table.id && available;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "reservation-table" +
        (selected ? " is-selected" : "") +
        (isValidSchedule && !available ? " is-reserved" : "");
      button.setAttribute("data-reservation-table", table.id);
      button.disabled = !available;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.setAttribute("aria-label", "Table " + table.number + ", seats " +
        table.capacity + ", " + (selected ? "selected" : available ? "available" : "reserved"));

      var icon = document.createElement("span");
      icon.className = "reservation-table-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "◉";
      var label = document.createElement("strong");
      label.textContent = "Table " + table.number;
      var capacity = document.createElement("span");
      capacity.textContent = "Up to " + table.capacity + " guests";
      var state = document.createElement("span");
      state.className = "reservation-table-state";
      state.textContent = !hasSchedule ? "Choose date & time" :
        !isValidSchedule ? "Choose future time" :
          selected ? "Selected" : available ? "Available" : "Reserved";

      button.appendChild(icon);
      button.appendChild(label);
      button.appendChild(capacity);
      button.appendChild(state);
      tableGrid.appendChild(button);
    }
  }

  function showConfirmation(reservation) {
    byId("reservation-confirmation-id").textContent = reservation.id;
    byId("reservation-confirmation-name").textContent = reservation.customerName;
    byId("reservation-confirmation-area").textContent =
      LutongReservations.areaName(reservation.areaId) + " · Table " + reservation.tableNumber;
    byId("reservation-confirmation-schedule").textContent =
      reservation.reservationDate + " at " + reservation.reservationTime;
    byId("reservation-confirmation-guests").textContent =
      reservation.guestCount + (reservation.guestCount === 1 ? " guest" : " guests");
    byId("reservation-confirmation-status").textContent = reservation.status;
    confirmation.hidden = false;
    confirmation.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleAreaClick(event) {
    var button = event.target.closest("[data-reservation-area]");
    if (!button) { return; }
    selectedAreaId = button.getAttribute("data-reservation-area");
    selectedTableId = "";
    byId("reservation-guests").max = "20";
    renderAreas();
    renderTables();
    byId("reservation-tables-heading").focus();
  }

  function handleTableClick(event) {
    var button = event.target.closest("[data-reservation-table]");
    if (!button || button.disabled) { return; }
    selectedTableId = button.getAttribute("data-reservation-table");
    renderTables();
    renderAreas();
    var guestField = byId("reservation-guests");
    var table = LutongReservations.getArea(selectedAreaId).tables.filter(function (item) {
      return item.id === selectedTableId;
    })[0];
    guestField.max = String(table.capacity);
    if (Number(guestField.value) > table.capacity) {
      guestField.value = String(table.capacity);
    }
  }

  function handleScheduleChange() {
    selectedTableId = "";
    byId("reservation-guests").max = "20";
    renderTables();
  }

  function handleSubmit(event) {
    event.preventDefault();
    LutongUI.clearStatus(statusBox);
    var result = LutongReservations.create({
      customerName: byId("reservation-name").value,
      guestCount: byId("reservation-guests").value,
      reservationDate: byId("reservation-date").value,
      reservationTime: byId("reservation-time").value,
      specialRequests: byId("reservation-requests").value,
      areaId: selectedAreaId,
      tableId: selectedTableId
    });
    if (!result.ok) {
      LutongUI.setStatus(statusBox, result.message, "error");
      if (result.field === "reservation-tables") {
        selectedTableId = "";
        renderTables();
      }
      if (result.field && byId(result.field)) {
        byId(result.field).focus();
      } else if (result.field === "reservation-area") {
        var firstArea = areaGrid.querySelector("button");
        if (firstArea) {
          firstArea.focus();
        }
      }
      return;
    }
    showConfirmation(result.reservation);
    selectedTableId = "";
    renderTables();
  }

  function init() {
    areaGrid = byId("reservation-area-grid");
    tableGrid = byId("reservation-table-grid");
    if (!areaGrid || !tableGrid) { return; }
    tableHelp = byId("reservation-table-help");
    form = byId("reservation-form");
    statusBox = byId("reservation-status");
    confirmation = byId("reservation-confirmation");

    var session = LutongAuth.getSession();
    if (session && session.role === "user") {
      byId("reservation-name").value = session.displayName;
    }
    byId("reservation-date").min = LutongReservations.localToday();
    areaGrid.addEventListener("click", handleAreaClick);
    tableGrid.addEventListener("click", handleTableClick);
    form.addEventListener("submit", handleSubmit);
    byId("reservation-date").addEventListener("change", handleScheduleChange);
    byId("reservation-time").addEventListener("change", handleScheduleChange);
    renderAreas();
    renderTables();
    window.addEventListener("storage", function (event) {
      if (event.key === "lutonglokal.reservations.v1") {
        renderTables();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
