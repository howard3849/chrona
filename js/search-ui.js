function setSearchExpanded({ shell, control, header, toggle, expanded }) {
  shell?.classList.toggle('is-open', expanded);
  control.classList.toggle('is-open', expanded);
  header?.classList.toggle('search-is-open', expanded);
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-label', expanded ? 'Close search' : 'Open search');
}

function setSearchNavigation({ container, count, previous, next, current, total, queryActive }) {
  count.textContent = total > 0 ? `${current}/${total}` : '0/0';
  container.hidden = !queryActive;
  previous.disabled = total === 0;
  next.disabled = total === 0;
}

window.ChronaSearchUI = Object.freeze({ setSearchExpanded, setSearchNavigation });
