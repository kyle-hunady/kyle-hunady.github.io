/* Nav highlighting.
 *
 * Jedi's version sets the active pill on click, so it goes stale the moment
 * you scroll instead of clicking. The obvious replacement -- an
 * IntersectionObserver keyed on thresholds -- has its own staleness bug: it
 * only fires when a threshold is CROSSED, so a fast scroll can skip the
 * callback that would have zeroed a section, and the pill sticks on whatever
 * was last reported. That is exactly what happened here: scrolling from
 * #contact back to the top left the pill on "about".
 *
 * So this measures instead of remembering. On each frame that the page has
 * actually scrolled, ask every section how many pixels of it are on screen
 * right now and light the largest. No retained state to go stale.
 */
(function () {
  var links = {};
  document.querySelectorAll('nav a[data-nav]').forEach(function (a) {
    links[a.dataset.nav] = a;
  });

  var targets = [
    { id: 'top', el: document.querySelector('header') },
    { id: 'about', el: document.getElementById('about') },
    { id: 'research', el: document.getElementById('research') },
    { id: 'outreach', el: document.getElementById('outreach') },
    { id: 'projects', el: document.getElementById('projects') },
    { id: 'contact', el: document.getElementById('contact') }
  ].filter(function (t) { return t.el; });

  if (!targets.length) return;

  var current = null;

  function setActive(id) {
    if (id === current) return;
    current = id;
    Object.keys(links).forEach(function (k) {
      links[k].classList.toggle('active', k === id);
    });
  }

  /* Which section is the reader AT?
   *
   * This used to vote by visible pixel area, and that broke when the About
   * section shrank to two sentences: at 217px it can never out-cover its 930px
   * neighbour, so its pill could never light no matter where you scrolled.
   *
   * So instead: the reader is at the last section whose top edge has crossed an
   * anchor line near the top of the viewport. Section height drops out of it
   * entirely. `targets` is in document order, so a forward scan finds the last
   * one crossed. Still measured fresh on every call, so there is no retained
   * state to go stale -- which was the whole point of the original rewrite.
   */
  function update() {
    // Bottom of the page: the last section wins even if it is short enough that
    // its top never crosses the line.
    var doc = document.documentElement;
    var anchor = window.innerHeight * 0.35;
    var maxScroll = doc.scrollHeight - window.innerHeight;

    // The last section can be too short to ever reach the anchor line: the page
    // runs out of scroll first, so clicking Contact left the pill on Projects.
    // Once we are within one anchor-length of the bottom, the last section is
    // substantially on screen and is the answer.
    if (window.scrollY >= maxScroll - anchor) {
      setActive(targets[targets.length - 1].id);
      return;
    }
    var best = targets[0].id;
    targets.forEach(function (t) {
      if (t.el.getBoundingClientRect().top <= anchor) { best = t.id; }
    });
    setActive(best);
  }

  /* Two independent triggers, because neither is reliable alone.
   *
   * The scroll listener is the normal one. It is deliberately NOT rAF-throttled:
   * the obvious "queued = true; rAF(...)" guard deadlocks if rAF is ever
   * suspended -- a background or non-compositing tab never runs the callback,
   * so `queued` stays true and the handler is dead for the rest of the page's
   * life. update() is five getBoundingClientRect calls against a fixed list;
   * throttling costs more than it saves.
   *
   * The IntersectionObserver is the backstop. Some environments (a hidden or
   * non-compositing tab -- which is how this page was verified) move the scroll
   * position without ever dispatching a scroll event; IO still fires there.
   * It carries no state of its own: it only says "something moved, re-measure",
   * so it cannot go stale the way a threshold-ratio spy does. */
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(update, {
      threshold: [0, 0.02, 0.1, 0.25, 0.5, 0.75, 0.98, 1]
    });
    targets.forEach(function (t) { io.observe(t.el); });
  }

  update();

  // #top has no element of its own; send it to the actual top.
  if (links.top) {
    links.top.addEventListener('click', function (ev) {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();

/* Copy-to-clipboard for the email address.
 *
 * navigator.clipboard needs a secure context (https, or localhost) and is not
 * there on older Safari, so fall back to a hidden textarea + execCommand.
 * Either way the button says "copied" for a moment, because a copy with no
 * feedback reads as a dead button. */
(function () {
  var buttons = document.querySelectorAll('.js-copy');
  if (!buttons.length) return;

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function flash(btn) {
    btn.classList.add('copied');
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function () { btn.classList.remove('copied'); }, 1600);
  }

  // Both copy paths can be refused (unfocused document, insecure context, a
  // locked-down browser). Rather than look dead, select the address so the
  // visitor can copy it by hand, and say that is what happened.
  function manual(btn) {
    try {
      var range = document.createRange();
      range.selectNodeContents(btn);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* selection is a nicety, not the point */ }
    btn.classList.add('copy-manual');
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function () { btn.classList.remove('copy-manual'); }, 2400);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.dataset.copy;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () { flash(btn); },
          function () { if (legacyCopy(text)) { flash(btn); } else { manual(btn); } }
        );
      } else if (legacyCopy(text)) {
        flash(btn);
      } else {
        manual(btn);
      }
    });
  });
})();
