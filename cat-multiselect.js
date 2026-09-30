/* Category filter that takes more than one value.

   The visible control is a text input showing the summary; the real <select>
   is hidden and carries the chosen ids as its selected options, so the code
   that reads el.value keeps working. The reader is a helper because a multiple
   select's .value comes back empty unless exactly one option is selected -
   that trap is what this replaces. */
(function () {
  'use strict';

  function selectedOf(sel) {
    if (!sel) return [];
    return Array.prototype.filter.call(sel.options, function (o) { return o.selected && o.value; });
  }

  // null means "no box is ticked", i.e. show everything.
  window.__msSelected = selectedOf;
  window.__msMatches = function (sel) {
    var chosen = selectedOf(sel);
    if (!chosen.length) return null;
    var set = new Set(chosen.map(function (o) { return o.value; }));
    return function (i) { return set.has(i.categoryId); };
  };

  /* Regroup rows so each ticked category forms one block, in the order the
     boxes were ticked. Done as a stable decorate/sort/undecorate pass, so the
     order the table was already sorted in survives inside each block. Rows
     whose category was not ticked go last. Returns the list untouched when
     fewer than two categories are ticked - grouping by a single category would
     only add a sort step without changing anything on screen. */
  window.__msGrouped = function (rows, sel, catIdOf) {
    var chosen = selectedOf(sel);
    if (chosen.length < 2) return rows;
    var rank = new Map();
    chosen.forEach(function (o, i) { rank.set(o.value, i); });
    return rows
      .map(function (r, i) {
        var id = catIdOf(r);
        return { r: r, i: i, g: rank.has(id) ? rank.get(id) : Number.MAX_SAFE_INTEGER };
      })
      .sort(function (a, b) { return (a.g - b.g) || (a.i - b.i); })
      .map(function (x) { return x.r; });
  };

  /* cfg lets one control stand in for another kind of list - the category
     pickers say "Any Category", the status picker says "Any Status". The
     defaults are the category wording, so the existing callers are unchanged. */
  window.bindMultiCombobox = function (inputId, menuId, selId, onChange, cfg) {
    cfg = cfg || {};
    var ANY = cfg.anyLabel || 'Any Category';
    var ALL = cfg.allLabel || 'All Categories';
    var EMPTY = cfg.emptyLabel || 'No categories';
    var BTN_ALL = cfg.selectAllLabel || 'Select All';
    var BTN_NONE = cfg.clearLabel || 'Clear';
    var input = document.getElementById(inputId);
    var menu = document.getElementById(menuId);
    var sel = document.getElementById(selId);
    if (!input || !menu || !sel) return;

    function label() {
      var chosen = selectedOf(sel);
      if (!chosen.length) {
        input.value = ANY;
        input.classList.remove('cb-has-value');
        return;
      }
      input.classList.add('cb-has-value');
      if (chosen.length === 1) { input.value = chosen[0].text; return; }
      if (chosen.length === 2) { input.value = chosen[0].text + ', ' + chosen[1].text; return; }
      input.value = ALL + ' (' + chosen.length + ')';
    }

    function fire() { if (typeof onChange === 'function') onChange(); }

    function render() {
      var opts = Array.prototype.slice.call(sel.options).filter(function (o) { return o.value; });
      if (!opts.length) { menu.innerHTML = '<div class="cb-ms-empty">' + esc(EMPTY) + '</div>'; return; }
      var head = '<div class="cb-ms-head">'
        + '<button type="button" class="cb-ms-all">' + esc(BTN_ALL) + '</button>'
        + '<button type="button" class="cb-ms-clear">' + esc(BTN_NONE) + '</button>'
        + '</div>';
      var rows = '<div class="cb-ms-list">' + opts.map(function (o) {
        return '<label class="cb-ms-opt"><input type="checkbox" value="' + esc(o.value) + '"'
          + (o.selected ? ' checked' : '') + '><span>' + esc(o.text) + '</span></label>';
      }).join('') + '</div>';
      // No Done button: every tick filters immediately, so the panel only has to
      // close. Outside click, Escape or clicking the input again all do that.
      menu.innerHTML = head + rows;

      Array.prototype.forEach.call(menu.querySelectorAll('.cb-ms-opt input'), function (box) {
        box.addEventListener('change', function () {
          var opt = Array.prototype.find.call(sel.options, function (o) { return o.value === box.value; });
          if (opt) opt.selected = box.checked;
          label();
          fire();
        });
      });
      var clear = menu.querySelector('.cb-ms-clear');
      if (clear) clear.addEventListener('click', function () {
        Array.prototype.forEach.call(sel.options, function (o) { if (o.value) o.selected = false; });
        render();
        label();
        fire();
      });
      var all = menu.querySelector('.cb-ms-all');
      if (all) all.addEventListener('click', function () {
        Array.prototype.forEach.call(sel.options, function (o) { if (o.value) o.selected = true; });
        render();
        label();
        fire();
      });
    }

    function show() { render(); menu.classList.remove('hidden'); input.classList.add('cb-open'); }
    function hide() { menu.classList.add('hidden'); input.classList.remove('cb-open'); }

    input.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (menu.classList.contains('hidden')) show(); else hide();
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { hide(); return; }
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); ev.stopPropagation();
        if (menu.classList.contains('hidden')) show(); else hide();
      }
    });
    menu.addEventListener('click', function (ev) { ev.stopPropagation(); });
    document.addEventListener('click', function () {
      if (input.classList.contains('cb-open')) hide();
    });

    label();
    return { refresh: function () { render(); label(); } };
  };
})();
