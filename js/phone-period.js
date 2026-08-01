const SVG_NS = 'http://www.w3.org/2000/svg';

function pathGeometry(continuesBefore, continuesAfter) {
  if (continuesBefore && continuesAfter) {
    return 'M 1.5 0 V 100 M 98.5 0 V 100';
  }
  if (continuesBefore) {
    return 'M 1.5 0 V 92 Q 1.5 98.5 8 98.5 H 92 Q 98.5 98.5 98.5 92 V 0';
  }
  if (continuesAfter) {
    return 'M 1.5 100 V 1.5 H 98.5 V 100';
  }
  return 'M 1.5 92 V 1.5 H 98.5 V 92 Q 98.5 98.5 92 98.5 H 8 Q 1.5 98.5 1.5 92';
}

function makeGradient(svg, id) {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const gradient = document.createElementNS(SVG_NS, 'linearGradient');
  gradient.id = id;
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y2', '100');
  gradient.setAttribute('gradientUnits', 'userSpaceOnUse');

  for (const [offset, color] of [['0%', '#168cff'], ['48%', '#6f63ff'], ['100%', '#ff3d9a']]) {
    const stop = document.createElementNS(SVG_NS, 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    gradient.appendChild(stop);
  }
  defs.appendChild(gradient);
  svg.appendChild(defs);
}

function createPhonePeriodRail({
  event,
  left,
  top,
  width,
  height,
  selected,
  continuesBefore,
  continuesAfter,
  onClick
}) {
  const rail = document.createElement('button');
  rail.type = 'button';
  rail.className = [
    'event-label',
    'mobile-period-rail',
    selected ? 'is-selected' : '',
    continuesBefore ? 'continues-before' : '',
    continuesAfter ? 'continues-after' : ''
  ].filter(Boolean).join(' ');
  rail.dataset.eventId = event.id;
  rail.style.left = `${left}px`;
  rail.style.top = `${top}px`;
  rail.style.width = `${width}px`;
  rail.style.height = `${height}px`;
  rail.style.setProperty('--event-color', event.color);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('mobile-period-frame');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const gradientId = `mobile-period-gradient-${String(event.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  makeGradient(svg, gradientId);

  const path = document.createElementNS(SVG_NS, 'path');
  path.classList.add('mobile-period-frame-path');
  path.setAttribute('d', pathGeometry(continuesBefore, continuesAfter));
  path.setAttribute('stroke', `url(#${gradientId})`);
  svg.appendChild(path);

  const text = document.createElement('span');
  text.className = 'event-label-text mobile-period-text';
  text.title = event.headline;
  text.textContent = height < 24 ? '…' : event.headline;

  rail.append(svg, text);
  rail.addEventListener('click', onClick);
  return rail;
}

window.ChronaPhonePeriod = Object.freeze({ createPhonePeriodRail });
