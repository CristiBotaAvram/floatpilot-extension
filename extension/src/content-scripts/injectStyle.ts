(function () {
    const style = document.createElement('style');
    style.textContent = `
    .floatpilot-push-down {
  position: absolute !important;
  top: 99999px !important;
  left: -99999px !important;
  opacity: 0.2 !important;
  pointer-events: none !important;
}

  `;
    document.head.appendChild(style);
})();
