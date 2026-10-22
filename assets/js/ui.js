/* ==========================================================================
   Lutong Lokal — assets/js/ui.js
   Shared user-interface helpers used by every page.

   This file only deals with presentation: navigation state, the cart badge,
   image fallbacks, money formatting and status messages. Data work lives in
   storage.js and the feature files.
   ========================================================================== */

var LutongUI = (function () {
  "use strict";

  /* Format a peso amount, e.g. 185 -> "P185.00" */
  function formatMoney(amount) {
    var value = Number(amount);
    if (!isFinite(value)) {
      value = 0;
    }
    return "₱" + value.toFixed(2);
  }

  /* Format an ISO date string for display; returns the raw text if it is
     not a valid date. */
  function formatDateTime(isoText) {
    if (!isoText) {
      return "—";
    }
    var date = new Date(isoText);
    if (isNaN(date.getTime())) {
      return String(isoText);
    }
    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  /* Escape text before it is placed inside an HTML string.
     Prefer textContent where possible; this helper is the safety net for
     the few places that build markup as a string. */
  function escapeText(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ------------------------------------------------------------------
     Image fallback
     Every photo on the site sits inside a wrapper that also contains a
     .card-fallback element. If the photo fails to load we hide the broken
     image and reveal the fallback panel instead of showing a broken icon.
     ------------------------------------------------------------------ */
  function applyImageFallbacks(root) {
    var scope = root || document;
    var images = scope.querySelectorAll("img[data-fallback-text]");

    for (var i = 0; i < images.length; i += 1) {
      var img = images[i];
      if (img.dataset.fallbackBound === "true") {
        continue;
      }
      img.dataset.fallbackBound = "true";

      var showFallback = function () {
        var wrapper = img.parentNode;
        if (!wrapper) {
          return;
        }
        var panel = wrapper.querySelector(".card-fallback");
        if (panel) {
          var label = panel.querySelector("[data-fallback-label]");
          var text = img.getAttribute("data-fallback-text");
          if (label && text) {
            label.textContent = text;
          }
          panel.hidden = false;
        }
        img.hidden = true;
      };

      img.addEventListener("error", showFallback);

      // A cached image may already be broken before this code runs.
      if (img.complete && img.naturalWidth === 0) {
        showFallback();
      }
    }
  }

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  function markCurrentPage() {
    var pageName = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (pageName === "") {
      pageName = "index.html";
    }

    var links = document.querySelectorAll(".primary-nav a[href]");
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      var href = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
      var extraPages = (link.getAttribute("data-nav-pages") || "").toLowerCase().split(/\s+/);
      var matches = href === pageName || extraPages.indexOf(pageName) !== -1;

      if (matches) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  function setupNavToggle() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("primary-nav");

    if (!toggle || !nav) {
      return;
    }

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      var label = toggle.querySelector(".nav-toggle-label");
      if (label) {
        label.textContent = isOpen ? "Close main menu" : "Open main menu";
      }
    });

    // Close the panel when a link is used, so the page does not stay open.
    nav.addEventListener("click", function (event) {
      if (event.target && event.target.tagName === "A" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ------------------------------------------------------------------
     Cart badge + account link
     ------------------------------------------------------------------ */
  function refreshCartBadge() {
    var badges = document.querySelectorAll("[data-cart-count]");
    var count = 0;
    var lines = lutongGetCart();

    for (var i = 0; i < lines.length; i += 1) {
      count += lines[i].quantity;
    }

    for (var j = 0; j < badges.length; j += 1) {
      badges[j].textContent = String(count);
      badges[j].setAttribute(
        "aria-label",
        count === 1 ? "1 item in your cart" : count + " items in your cart"
      );
    }
  }

  function refreshAccountLink() {
    var session = lutongGetSession();
    var link = document.querySelector("[data-account-link]");
    var signOut = document.querySelector("[data-sign-out]");

    if (link) {
      if (!session) {
        link.setAttribute("href", "login.html");
        link.textContent = "Sign in";
      } else if (session.role === "admin") {
        link.setAttribute("href", "admin.html");
        link.textContent = session.displayName + " (Admin)";
      } else {
        link.setAttribute("href", "dashboard.html");
        link.textContent = session.displayName;
      }
    }

    if (signOut) {
      if (session) {
        signOut.hidden = false;
        signOut.addEventListener("click", function () {
          lutongClearSession();
          window.location.href = "index.html";
        });
      } else {
        signOut.hidden = true;
      }
    }
  }

  /* ------------------------------------------------------------------
     Status messages
     ------------------------------------------------------------------ */
  function setStatus(element, message, kind) {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = "alert alert-" + (kind || "info");
    element.hidden = false;
  }

  function clearStatus(element) {
    if (!element) {
      return;
    }
    element.textContent = "";
    element.hidden = true;
  }

  /* ------------------------------------------------------------------
     Misc
     ------------------------------------------------------------------ */
  function stampFooterYear() {
    var year = String(new Date().getFullYear());
    var nodes = document.querySelectorAll("[data-current-year]");
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].textContent = year;
    }
  }

  function init() {
    // The account link changes its target depending on the session, so it
    // must be updated BEFORE the current page is marked.
    refreshAccountLink();
    markCurrentPage();
    setupNavToggle();
    refreshCartBadge();
    stampFooterYear();
    applyImageFallbacks(document);
  }

  /* ------------------------------------------------------------------
     Menu card builder
     Used by the home page and the menu page so both show the same
     card. The card is built with DOM calls (createElement / textContent)
     instead of HTML strings, so any text coming from stored data is
     inserted safely.
     ------------------------------------------------------------------ */
  function buildMenuCard(item) {
    var card = document.createElement("article");
    card.className = "card";
    card.id = "item-" + item.id;

    var media = document.createElement("div");
    media.className = "card-media";

    var img = document.createElement("img");
    img.className = "card-img";
    img.src = item.image;
    img.alt = item.name + " — sample photo of the dish used in the demo menu";
    img.width = 500;
    img.height = 375;
    img.loading = "lazy";
    img.decoding = "async";
    img.setAttribute("data-fallback-text", item.name);

    var fallback = document.createElement("div");
    fallback.className = "card-fallback";
    fallback.hidden = true;
    var fallbackLabel = document.createElement("span");
    fallbackLabel.setAttribute("data-fallback-label", "");
    fallbackLabel.textContent = item.name;
    fallback.appendChild(fallbackLabel);

    media.appendChild(img);
    media.appendChild(fallback);

    var body = document.createElement("div");
    body.className = "card-body";

    var meta = document.createElement("p");
    meta.className = "stack-sm";
    meta.style.marginBottom = "0.5rem";

    var categoryBadge = document.createElement("span");
    categoryBadge.className = "badge badge-category";
    categoryBadge.textContent = lutongCategoryName(item.category);
    meta.appendChild(categoryBadge);

    if (!item.available) {
      var soldOut = document.createElement("span");
      soldOut.className = "badge badge-soldout";
      soldOut.style.marginLeft = "0.35rem";
      soldOut.textContent = "Sold out";
      meta.appendChild(soldOut);
    }

    var title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = item.name;

    var description = document.createElement("p");
    description.className = "card-text";
    description.textContent = item.description;

    var footer = document.createElement("div");
    footer.className = "card-footer";

    var price = document.createElement("span");
    price.className = "price";
    price.textContent = formatMoney(item.price);

    var link = document.createElement("a");
    link.className = "btn btn-outline btn-sm";
    link.href = "menu.html#item-" + item.id;
    link.textContent = "View in menu";

    footer.appendChild(price);
    footer.appendChild(link);

    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(footer);

    card.appendChild(media);
    card.appendChild(body);

    return card;
  }

  /* Human readable category label from the category id. */
  function lutongCategoryName(categoryId) {
    var list = typeof LUTONG_CATEGORIES !== "undefined" ? LUTONG_CATEGORIES : [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === categoryId) {
        return list[i].name;
      }
    }
    return "Menu Item";
  }

  return {
    init: init,
    formatMoney: formatMoney,
    formatDateTime: formatDateTime,
    escapeText: escapeText,
    applyImageFallbacks: applyImageFallbacks,
    buildMenuCard: buildMenuCard,
    categoryName: lutongCategoryName,
    refreshCartBadge: refreshCartBadge,
    refreshAccountLink: refreshAccountLink,
    setStatus: setStatus,
    clearStatus: clearStatus
  };
})();

/* Run once, as soon as the page is ready. */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", LutongUI.init);
} else {
  LutongUI.init();
}
