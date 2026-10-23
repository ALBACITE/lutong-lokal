/* ==========================================================================
   THE UNKNOWN COFFEE — assets/js/home.js
   Fills the Popular Drinks row on the home page from the menu data,
   so the home page always matches what the menu (and the admin) says.
   ========================================================================== */

(function () {
  "use strict";

  function renderFeaturedDrinks() {
    var grid = document.getElementById("featured-grid");
    if (!grid) {
      return;
    }

    var menu = lutongGetMenu();
    var featured = [];

    for (var i = 0; i < menu.length; i += 1) {
      if (menu[i].featured && menu[i].available) {
        featured.push(menu[i]);
      }
    }

    // If an admin unmarks every drink, show the first available ones so the
    // home page is never empty.
    if (featured.length === 0) {
      for (var j = 0; j < menu.length && featured.length < 4; j += 1) {
        if (menu[j].available) {
          featured.push(menu[j]);
        }
      }
    }

    grid.innerHTML = "";

    for (var k = 0; k < featured.length && k < 4; k += 1) {
      grid.appendChild(LutongUI.buildMenuCard(featured[k]));
    }

    LutongUI.applyImageFallbacks(grid);
  }

  function init() {
    renderFeaturedDrinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
