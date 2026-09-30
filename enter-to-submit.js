/* Pressing Enter should finish whatever the user is filling in:
   - inside a <form>, submit it - but only once every required field is filled;
   - inside a table cell of an editable grid, commit the cell and move to the
     same column one row down, so a column can be typed top to bottom.

   Anything invalid is marked and focused instead of being submitted, so the
   user is told what is still missing rather than watching a submit fail
   silently.

   This listens on the bubble phase on purpose: handlers bound directly on the
   field (a combobox picking an option, "add category" on Enter) run first, and
   anything that already called preventDefault is left alone. */
(function () {
  'use strict';

  var TYPING = { text: 1, search: 1, tel: 1, url: 1, email: 1, password: 1, number: 1, '': 1 };

  function isTypingField(el) {
    if (!el || el.nodeName !== 'INPUT') return false;
    var t = (el.getAttribute('type') || 'text').toLowerCase();
    if (t === 'hidden' || t === 'checkbox' || t === 'radio' || t === 'button') return false;
    return TYPING[t] === 1;
  }

  /* A dropdown that is currently open owns the Enter key. */
  function menuIsOpen(el) {
    var m = el.closest('.cb, .act-dd, .stat-export-dd, .manage-dd, .combo');
    if (!m) return false;
    return !!m.querySelector('.cb-menu:not(.hidden), .act-dd-menu:not(.hidden),'
      + ' .stat-export-menu:not(.hidden), .combo-list:not(.hidden), .suggest:not(.hidden)');
  }

  function fieldLabel(el) {
    var scope = el.closest('form, .modal, .card') || document;
    if (el.id) {
      var lab = scope.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]');
      if (lab && lab.textContent.trim()) return lab.textContent.trim();
    }
    var wrap = el.closest('.form-group, .field-wrap');
    if (wrap) {
      var l2 = wrap.querySelector('label');
      if (l2 && l2.textContent.trim()) return l2.textContent.trim();
    }
    return el.name || el.getAttribute('placeholder')
      || el.getAttribute('aria-label') || 'This field';
  }

  /* Where the inline message goes: the field's own group when there is one,
     otherwise the cell/div that directly holds the input. */
  function hintHost(el) {
    return el.closest('.form-group, .field-wrap') || el.parentElement || null;
  }

  /* Reuses the .input-error / .field-err pair the app already styles, adding
     the hint element on the fly so a form that never had one still reports it. */
  function markBad(el, why) {
    el.classList.add('input-error');
    el.dataset.enterErr = '1';
    el.setAttribute('aria-invalid', 'true');
    var group = hintHost(el);
    if (!group) return;
    var hint = group.querySelector('.field-err');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'field-err';
      group.appendChild(hint);
    }
    hint.classList.remove('hidden');
    hint.textContent = why || (fieldLabel(el) + ' is required.');
    hint.dataset.enterHint = '1';
  }

  function clearBad(el) {
    el.classList.remove('input-error');
    delete el.dataset.enterErr;
    el.removeAttribute('aria-invalid');
    var group = hintHost(el);
    var hint = group && group.querySelector('.field-err');
    // only hide a message this script wrote; leave hand-written ones alone
    if (hint && hint.dataset.enterHint) {
      hint.classList.add('hidden');
      hint.textContent = '';
      delete hint.dataset.enterHint;
    }
  }

  /* Is this field still a problem right now? Checks the value, not the label. */
  function stillBad(el) {
    if (el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') {
      var v = (el.value || '').trim();
      if (v === '' || (el.type === 'checkbox' && !el.checked)) return true;
    }
    if (el.type === 'number') {
      if ((el.value || '').trim() !== '' && isNaN(Number(el.value))) return true;
      if (el.min !== '' && el.value !== '' && Number(el.value) < Number(el.min)) return true;
    }
    return false;
  }

  /* The first thing still missing, or null when the form is good to send. */
  function firstProblem(form) {
    var fields = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el.disabled || el.type === 'hidden') continue;
      if (el.type === 'submit' || el.type === 'button' || el.type === 'reset') continue;
      if (el.closest('[hidden]') || el.closest('.hidden')) continue;
      if (el.offsetParent === null) continue;

      if (el.classList.contains('input-error')) {
        // An error this script raised is re-checked against the current value,
        // so a field fixed by any means stops blocking. Errors raised by the
        // app's own validation are taken at face value.
        if (el.dataset.enterErr) {
          if (stillBad(el)) return { el: el, why: null };
          clearBad(el);
        } else {
          return { el: el, why: null };
        }
      }

      if (el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') {
        var v = (el.value || '').trim();
        if (v === '' || (el.type === 'checkbox' && !el.checked)) return { el: el, why: null };
      }
      if (el.type === 'number') {
        if ((el.value || '').trim() !== '' && isNaN(Number(el.value)))
          return { el: el, why: 'Enter a valid number.' };
        if (el.min !== '' && el.value !== '' && Number(el.value) < Number(el.min))
          return { el: el, why: 'Must be ' + el.min + ' or more.' };
      }
    }
    return null;
  }

  /* ---- grid: Enter moves down a column ---- */
  function moveDownCell(el) {
    var cell = el.closest('td, th');
    var row = el.closest('tr');
    var table = row && row.closest('table');
    if (!cell || !row || !table) return false;
    var colIndex = Array.prototype.indexOf.call(row.children, cell);
    var all = Array.prototype.slice.call(table.querySelectorAll('tr'));
    var i = all.indexOf(row);
    for (var n = i + 1; n < all.length; n++) {
      var next = all[n].children[colIndex];
      if (!next) continue;
      var input = next.querySelector('input:not([type=hidden]), select, textarea');
      if (input && !input.disabled) {
        input.focus();
        if (typeof input.select === 'function') input.select();
        return true;
      }
    }
    return false;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.defaultPrevented) return;             // a field handler already dealt with it
    if (e.isComposing) return;                  // composing Hindi/other IME text
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    var el = e.target;

    if (el && el.tagName === 'TEXTAREA') return;   // a textarea always means "new line"
    if (!isTypingField(el)) return;
    if (menuIsOpen(el)) return;

    var form = el.closest('form');

    // A column in an editable grid walks down before the form is sent. Rows are
    // usually inside the form itself, so this is checked before the form branch:
    // Enter moves to the cell below and only the last row falls through to submit.
    if (el.closest('table tbody, table tfoot')) {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (moveDownCell(el)) { e.preventDefault(); return; }
      // bottom of the column: fall through so the form can be validated and sent
      if (!form) { e.preventDefault(); el.blur(); return; }
    } else if (!form) {
      return;
    }

    // Inside a form: refuse to send it while anything is still missing.
    var bad = firstProblem(form);
    if (bad) {
      e.preventDefault();
      markBad(bad.el, bad.why);
      try { bad.el.focus(); } catch (err) { /* field was detached mid-render */ }
      if (typeof window.toast === 'function') window.toast('Fill the highlighted fields to continue.', 'error');
      return;
    }
    // otherwise fall through to the browser's normal implicit submission
  }, false);

  // a highlighted field clears itself as soon as the user starts fixing it
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains('input-error')) clearBad(el);
  }, true);

  window.__enterFirstProblem = firstProblem;
})();