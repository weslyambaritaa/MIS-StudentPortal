const initializeLoginPage = () => {
  const slides = [...document.querySelectorAll("[data-promo-slide]")];
  const icons = [...document.querySelectorAll("[data-promo-icon]")];
  let activeIndex = 0;
  let timer;

  const selectSlide = (selectedIndex) => {
    activeIndex = selectedIndex;
    slides.forEach((slide, index) => {
      const active = index === selectedIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-pressed", String(active));
    });
    icons.forEach((icon, index) => {
      const active = index === selectedIndex;
      icon.classList.toggle("is-active", active);
      icon.setAttribute("aria-hidden", String(!active));
    });
  };

  const stopTimer = () => {
    window.clearInterval(timer);
  };

  const startTimer = () => {
    stopTimer();
    if (!document.hidden && slides.length > 1) {
      timer = window.setInterval(() => selectSlide((activeIndex + 1) % slides.length), 7000);
    }
  };

  slides.forEach((slide) => {
    slide.addEventListener("click", () => {
      selectSlide(Number(slide.dataset.promoSlide));
      startTimer();
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopTimer();
    else startTimer();
  });
  startTimer();

  const password = document.getElementById("password");
  const toggle = document.querySelector("[data-password-toggle]");
  if (password && toggle) {
    toggle.addEventListener("click", () => {
      const visible = password.type === "password";
      password.type = visible ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(visible));
      toggle.setAttribute("aria-label", visible ? toggle.dataset.labelHide : toggle.dataset.labelShow);
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLoginPage, { once: true });
} else {
  initializeLoginPage();
}
