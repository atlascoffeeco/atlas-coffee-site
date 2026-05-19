(function(){
  const mobileToggle = document.querySelector('[data-mobile-toggle]');
  const mobilePanel = document.querySelector('[data-mobile-panel]');

  if (mobileToggle && mobilePanel) {
    mobileToggle.addEventListener('click', () => {
      const open = mobilePanel.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(open));
    });
  }

  const observer = new IntersectionObserver(
    entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    }),
    { threshold: 0.14 }
  );

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();