// Fill in when the event video is ready: a YouTube link or an mp4 path (e.g. "/video.mp4").
const VIDEO = "/video.mp4";

(function mountVideo() {
  if (!VIDEO) return;
  const box = document.getElementById("video");
  const yt = VIDEO.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  box.innerHTML = yt
    ? `<iframe src="https://www.youtube.com/embed/${yt[1]}?rel=0" title="ACE Pitch Day" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
    : `<video src="${VIDEO}" poster="/video-poster.jpg" controls playsinline preload="metadata"></video>`;
})();

// Keep Chinese clauses whole: only allow line breaks after punctuation.
(function phrases() {
  const cut = /[^，。、？！；：]+[，。、？！；：]*/g;
  document.querySelectorAll("main p, main h2, main h3, main small, main .v, main .tl-time").forEach(el => {
    for (const node of [...el.childNodes]) {
      if (node.nodeType !== 3 || !/[，。、？！；：]/.test(node.textContent)) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.match(cut) || []) {
        const span = document.createElement("span");
        span.className = "ph";
        span.textContent = part;
        frag.append(span);
      }
      node.replaceWith(frag);
    }
  });
})();

// Illustrations pop in as their card scrolls into view (touch devices have no hover).
(function reveal() {
  const steps = document.querySelectorAll(".step");
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("js");
  steps.forEach(el => el.style.setProperty("--d", (([...el.parentElement.children].indexOf(el)) % 3) * 0.12 + "s"));
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("seen"); io.unobserve(e.target); }
  }), { threshold: 0.35 });
  steps.forEach(el => {
    io.observe(el);
    el.addEventListener("animationend", () => el.classList.add("done"), { once: true });
  });
})();

(function timeline() {
  const tl = document.getElementById("timeline");
  if (!tl) return;
  const play = () => tl.classList.add("is-on");
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return play();
  document.documentElement.classList.add("js");
  new IntersectionObserver((entries, io) => {
    if (entries.some(e => e.isIntersecting)) { play(); io.disconnect(); }
  }, { threshold: 0.4 }).observe(tl);
})();
