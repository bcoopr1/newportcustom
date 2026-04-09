/**
 * animations.js
 * GSAP + ScrollTrigger + Lenis smooth scroll setup.
 * All animations respect prefers-reduced-motion.
 */

(function () {
  'use strict';

  // ── Reduced-motion guard ──────────────────────────────────────────────────
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Lenis smooth scrolling ────────────────────────────────────────────────
  let lenis = null;

  function initLenis() {
    if (prefersReducedMotion) return;

    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo ease-out
      smoothWheel: true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.8,
      infinite: false,
    });

    // Hook Lenis into GSAP ticker for frame-perfect sync
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Keep ScrollTrigger in sync with Lenis scroll position
    lenis.on('scroll', ScrollTrigger.update);
  }

  // ── GSAP + ScrollTrigger registration ────────────────────────────────────
  function initGSAP() {
    gsap.registerPlugin(ScrollTrigger);

    // Tell ScrollTrigger to use Lenis scroll position when active
    if (!prefersReducedMotion && lenis) {
      ScrollTrigger.scrollerProxy(document.body, {
        scrollTop(value) {
          if (arguments.length) {
            lenis.scrollTo(value);
          }
          return lenis.animatedScroll;
        },
        getBoundingClientRect() {
          return {
            top: 0, left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
        },
        pinType: document.body.style.transform ? 'transform' : 'fixed',
      });
    }
  }

  // ── Hero entrance animation ───────────────────────────────────────────────
  function initHeroAnimation() {
    if (prefersReducedMotion) return;

    const heroEls = document.querySelectorAll('[data-hero-el]');
    if (!heroEls.length) return;

    gsap.set(heroEls, { opacity: 0, y: 28 });

    gsap.to(heroEls, {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: 'power3.out',
      stagger: 0.15,
      delay: 0.2,
    });
  }

  // ── Hero parallax ─────────────────────────────────────────────────────────
  function initHeroParallax() {
    if (prefersReducedMotion) return;

    const heroImg = document.getElementById('hero-parallax-img');
    if (!heroImg) return;

    gsap.to(heroImg, {
      yPercent: 22,   // moves 22% of its height as user scrolls — subtle
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  }

  // ── Editorial section parallax ────────────────────────────────────────────
  function initEditorialParallax() {
    if (prefersReducedMotion) return;

    const editorialImages = [
      { id: 'editorial-parallax-1', yPercent: 16 },
      { id: 'editorial-parallax-2', yPercent: 16 },
      { id: 'feature-parallax-img', yPercent: 14 },
    ];

    editorialImages.forEach(({ id, yPercent }) => {
      const el = document.getElementById(id);
      if (!el) return;

      gsap.fromTo(
        el,
        { yPercent: -yPercent / 2 },
        {
          yPercent: yPercent / 2,
          ease: 'none',
          scrollTrigger: {
            trigger: el.closest('section') || el.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      );
    });
  }

  // ── Scroll-triggered reveal (IntersectionObserver for CSS-only fallback) ──
  function initScrollReveals() {
    // We use IntersectionObserver for the CSS [data-reveal] approach.
    // GSAP's ScrollTrigger handles the parallax; IO is lighter for fade-ins.
    const revealEls   = document.querySelectorAll('[data-reveal]');
    const staggerEls  = document.querySelectorAll('[data-reveal-stagger]');

    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything immediately
      [...revealEls, ...staggerEls].forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // once only
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -60px 0px',
      }
    );

    revealEls.forEach((el) => observer.observe(el));
    staggerEls.forEach((el) => observer.observe(el));
  }

  // ── Nav scroll behaviour ──────────────────────────────────────────────────
  function initNavScroll() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    let lastScroll = 0;

    function onScroll() {
      const scrollY = lenis ? lenis.animatedScroll : window.scrollY;
      nav.classList.toggle('nav--scrolled', scrollY > 40);
      lastScroll = scrollY;
    }

    if (lenis) {
      lenis.on('scroll', onScroll);
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Run once on init in case page loads mid-scroll
    onScroll();
  }

  // ── Mobile hamburger menu ─────────────────────────────────────────────────
  function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobile-nav');
    if (!hamburger || !mobileNav) return;

    let isOpen = false;

    function toggle() {
      isOpen = !isOpen;
      hamburger.setAttribute('aria-expanded', isOpen);
      mobileNav.setAttribute('aria-hidden', !isOpen);
      mobileNav.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      document.body.style.overflow = isOpen ? 'hidden' : '';

      // Animate hamburger → X
      const bars = hamburger.querySelectorAll('span');
      if (!prefersReducedMotion) {
        if (isOpen) {
          gsap.to(bars[0], { rotate: 45, y: 6.5, duration: 0.35, ease: 'power2.out' });
          gsap.to(bars[1], { opacity: 0,  duration: 0.2 });
          gsap.to(bars[2], { rotate: -45, y: -6.5, duration: 0.35, ease: 'power2.out' });
        } else {
          gsap.to(bars[0], { rotate: 0, y: 0, duration: 0.35, ease: 'power2.out' });
          gsap.to(bars[1], { opacity: 1, duration: 0.2, delay: 0.1 });
          gsap.to(bars[2], { rotate: 0, y: 0, duration: 0.35, ease: 'power2.out' });
        }
      }
    }

    hamburger.addEventListener('click', toggle);

    // Close on mobile link click
    mobileNav.querySelectorAll('.nav__mobile-link').forEach((link) => {
      link.addEventListener('click', () => { if (isOpen) toggle(); });
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) toggle();
    });
  }

  // ── GSAP ScrollTrigger refresh on Lenis scroll ────────────────────────────
  function refreshScrollTrigger() {
    window.addEventListener('resize', () => {
      ScrollTrigger.refresh();
    });
  }

  // ── Init all ──────────────────────────────────────────────────────────────
  function init() {
    initLenis();
    initGSAP();
    initHeroAnimation();
    initHeroParallax();
    initEditorialParallax();
    initScrollReveals();
    initNavScroll();
    initMobileMenu();
    refreshScrollTrigger();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
