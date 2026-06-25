/* Scroll reveal */
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
  );
  els.forEach((el) => io.observe(el));
})();

/* Mobile nav toggle */
(function () {
  const btn = document.getElementById('nav-hamburger');
  const drawer = document.getElementById('nav-drawer');
  if (!btn || !drawer) return;
  btn.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '✕' : '≡';
  });
  drawer.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      drawer.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '≡';
    });
  });
  document.addEventListener('click', (e) => {
    if (!drawer.contains(e.target) && e.target !== btn) {
      drawer.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '≡';
    }
  });
})();
