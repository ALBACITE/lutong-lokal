/* ==========================================================================
   THE UNKNOWN COFFEE — assets/js/menu.js
   The Coffee Menu page: renders the menu from stored data, filters it by
   category and by a search term, and adds drinks to the cart.

   The menu is always re-read from storage, so a change made in the admin
   area shows up here as soon as the page is loaded or refreshed.
   ========================================================================== */

(function () {
  "use strict";

  var searchTerm = "";
  var activeCategory = "all";

  var grid = null;
  var filterBox = null;
  var searchInput = null;
  var countBox = null;
  var statusBox = null;

  function byId(id) {
    return document.getElementById(id);
  }

  /* ------------------------------------------------------------------
     Filtering
     ------------------------------------------------------------------ */
  function matchesSearch(item, term) {
    if (!term) {
      return true;
    }
    var name = String(item.name).toLowerCase();
    var description = String(item.description).toLowerCase();
    return name.indexOf(term) !== -1 || description.indexOf(term) !== -1;
  }

  function getVisibleItems() {
    var menu = lutongGetMenu();
    var term = searchTerm.toLowerCase();
    var visible = [];

    for (var i = 0; i < menu.length; i += 1) {
      var item = menu[i];
      var categoryOk = activeCategory === "all" || item.category === activeCategory;
      if (categoryOk && matchesSearch(item, term)) {
        visible.push(item);
      }
    }

    return visible;
  }

  /* ------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------ */
  function buildCard(item) {
    var card = document.createElement("article");
    card.className = "card";
    card.id = "item-" + item.id;

    var media = document.createElement("div");
    media.className = "card-media";

    var img = document.createElement("img");
    img.className = "card-img";
    img.src = item.image;
    img.alt = item.name + " drink";
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
    meta.style.marginBottom = "0.5rem";

    var categoryBadge = document.createElement("span");
    categoryBadge.className = "badge badge-category";
    categoryBadge.textContent = LutongUI.categoryName(item.category);
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

    var purchase = document.createElement("div");
    purchase.className = "drink-purchase";

    var sizeSelect = document.createElement("select");
    sizeSelect.setAttribute("data-size-select", item.id);
    sizeSelect.setAttribute("aria-label", "Choose a size for " + item.name);
    var mediumOption = document.createElement("option");
    mediumOption.value = "medium";
    mediumOption.textContent = "Medium — " + LutongUI.formatMoney(item.priceMedium);
    var largeOption = document.createElement("option");
    largeOption.value = "large";
    largeOption.textContent = "Large — " + LutongUI.formatMoney(item.priceLarge);
    sizeSelect.appendChild(mediumOption);
    sizeSelect.appendChild(largeOption);

    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary btn-sm add-to-cart-btn";
    button.setAttribute("data-add-item", item.id);

    if (item.available) {
      button.textContent = "Add to cart";
      button.setAttribute("aria-label", "Add " + item.name + " to your cart");
    } else {
      button.textContent = "Sold out";
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.setAttribute("aria-label", item.name + " is sold out and cannot be ordered");
    }

    purchase.appendChild(sizeSelect);
    footer.appendChild(purchase);
    footer.appendChild(button);

    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(footer);

    card.appendChild(media);
    card.appendChild(body);

    return card;
  }

  function renderFilters() {
    if (!filterBox) {
      return;
    }

    var menu = lutongGetMenu();
    filterBox.innerHTML = "";

    for (var i = 0; i < LUTONG_CATEGORIES.length; i += 1) {
      var category = LUTONG_CATEGORIES[i];

      var count = 0;
      for (var j = 0; j < menu.length; j += 1) {
        if (category.id === "all" || menu[j].category === category.id) {
          count += 1;
        }
      }

      var button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.setAttribute("data-category", category.id);
      button.setAttribute("aria-pressed", category.id === activeCategory ? "true" : "false");

      var label = document.createElement("span");
      label.textContent = category.name;
      button.appendChild(label);

      var badge = document.createElement("span");
      badge.className = "chip-count";
      badge.textContent = "(" + count + ")";
      button.appendChild(badge);

      filterBox.appendChild(button);
    }
  }

  function renderEmptyState() {
    var wrapper = document.createElement("div");
    wrapper.className = "empty-state";

    var heading = document.createElement("h3");
    heading.textContent = "No drinks match your search";

    var text = document.createElement("p");
    text.textContent = searchTerm
      ? "Nothing on the menu matches \"" + searchTerm + "\". Try a different word, or pick another category."
      : "There are no drinks in this category right now. Try another category or clear the search.";

    var actions = document.createElement("div");
    actions.className = "button-row";

    var clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "btn btn-primary";
    clearButton.id = "clear-filters";
    clearButton.textContent = "Clear search and filters";
    actions.appendChild(clearButton);

    var menuLink = document.createElement("a");
    menuLink.className = "btn btn-outline";
    menuLink.href = "menu.html";
    menuLink.textContent = "Back to the full menu";
    actions.appendChild(menuLink);

    wrapper.appendChild(heading);
    wrapper.appendChild(text);
    wrapper.appendChild(actions);

    return wrapper;
  }

  function render() {
    if (!grid) {
      return;
    }

    var visible = getVisibleItems();

    grid.innerHTML = "";

    var categoryIds = activeCategory === "all" ? ["coffee", "non-coffee"] : [activeCategory];

    for (var c = 0; c < categoryIds.length; c += 1) {
      var categoryId = categoryIds[c];
      var categoryItems = [];
      for (var i = 0; i < visible.length; i += 1) {
        if (visible[i].category === categoryId) {
          categoryItems.push(visible[i]);
        }
      }
      if (categoryItems.length === 0) {
        continue;
      }

      var categorySection = document.createElement("section");
      categorySection.className = "menu-category";
      var categoryHeading = document.createElement("h2");
      categoryHeading.textContent = LutongUI.categoryName(categoryId);
      var categoryGrid = document.createElement("div");
      categoryGrid.className = "grid";
      for (var j = 0; j < categoryItems.length; j += 1) {
        categoryGrid.appendChild(buildCard(categoryItems[j]));
      }
      categorySection.appendChild(categoryHeading);
      categorySection.appendChild(categoryGrid);
      grid.appendChild(categorySection);
    }

    if (visible.length === 0) {
      grid.appendChild(renderEmptyState());
    }

    LutongUI.applyImageFallbacks(grid);
    renderFilters();
    renderCount(visible.length);

    if (window.location.hash.indexOf("#item-") === 0) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: "start" });
      }
    }
  }

  function renderCount(visibleCount) {
    if (!countBox) {
      return;
    }

    var total = lutongGetMenu().length;
    countBox.innerHTML = "";

    var strong = document.createElement("strong");
    strong.textContent = String(visibleCount);
    countBox.appendChild(strong);

    countBox.appendChild(
      document.createTextNode(
        visibleCount === 1 ? " drink shown" : " drinks shown"
      )
    );

    if (visibleCount !== total) {
      countBox.appendChild(document.createTextNode(" out of " + total + " on the menu."));
    } else {
      countBox.appendChild(document.createTextNode(" on the menu."));
    }
  }

  /* ------------------------------------------------------------------
     Cart
     ------------------------------------------------------------------ */
  function addToCart(itemId, size) {
    var menu = lutongGetMenu();
    var item = null;

    for (var i = 0; i < menu.length; i += 1) {
      if (menu[i].id === itemId) {
        item = menu[i];
        break;
      }
    }

    if (!item) {
      LutongUI.setStatus(statusBox, "That drink is no longer on the menu.", "error");
      return;
    }

    if (!item.available) {
      LutongUI.setStatus(statusBox, item.name + " is sold out and cannot be ordered.", "error");
      return;
    }

    var selectedSize = size === "large" ? "large" : "medium";
    var price = selectedSize === "large" ? item.priceLarge : item.priceMedium;
    var lines = lutongGetCart();
    var found = false;

    for (var j = 0; j < lines.length; j += 1) {
      if (lines[j].itemId === item.id && lines[j].size === selectedSize) {
        if (lines[j].quantity >= 99) {
          LutongUI.setStatus(statusBox, "The maximum quantity for " + item.name + " is 99.", "error");
          return;
        }
        lines[j].quantity += 1;
        found = true;
        break;
      }
    }

    if (!found) {
      lines.push({
        itemId: item.id,
        name: item.name,
        price: price,
        size: selectedSize,
        quantity: 1,
        image: item.image
      });
    }

    lutongSaveCart(lines);
    LutongUI.refreshCartBadge();
    LutongUI.setStatus(statusBox, item.name + " (" + (selectedSize === "large" ? "Large" : "Medium") + ") was added to your cart.", "success");
  }

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */
  function handleGridClick(event) {
    var target = event.target;
    if (!target || !target.getAttribute) {
      return;
    }

    var addButton = target.closest ? target.closest("[data-add-item]") : null;
    if (addButton) {
      var card = addButton.closest(".card");
      var sizeSelect = card ? card.querySelector("[data-size-select]") : null;
      var size = sizeSelect ? sizeSelect.value : "medium";
      addToCart(addButton.getAttribute("data-add-item"), size);
      return;
    }

    var clearButton = target.closest ? target.closest("#clear-filters") : null;
    if (clearButton) {
      searchTerm = "";
      activeCategory = "all";
      if (searchInput) {
        searchInput.value = "";
      }
      render();
    }
  }

  function handleFilterClick(event) {
    var target = event.target;
    if (!target || !target.closest) {
      return;
    }

    var chip = target.closest("[data-category]");
    if (!chip) {
      return;
    }

    activeCategory = chip.getAttribute("data-category");
    render();
  }

  function handleSearch(event) {
    var target = event.target;
    if (!target || !target.getAttribute) {
      return;
    }
    if (target.id !== "menu-search") {
      return;
    }

    searchTerm = String(target.value || "").trim();
    render();
  }

  function init() {
    grid = byId("menu-grid");
    filterBox = byId("category-filters");
    searchInput = byId("menu-search");
    countBox = byId("menu-result-count");
    statusBox = byId("menu-status");

    if (!grid) {
      return;
    }

    // One listener per element, attached once.
    grid.addEventListener("click", handleGridClick);

    if (filterBox) {
      filterBox.addEventListener("click", handleFilterClick);
    }

    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    }

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
