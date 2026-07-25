import { initRouter } from './router.js';

window.navigate = function(hash) {
  window.location.hash = hash;
};

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
});