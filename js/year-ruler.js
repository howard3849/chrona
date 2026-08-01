function showPhoneYearRuler({ ruler, label, relative, y, yearText, relativeText }) {
  ruler.style.top = `${y}px`;
  ruler.style.left = '0px';
  ruler.style.right = '0px';
  ruler.style.bottom = 'auto';
  ruler.style.width = 'auto';
  ruler.style.height = '0px';
  label.textContent = yearText;
  relative.textContent = relativeText;
  ruler.hidden = false;
}

function showDesktopYearRuler({ ruler, label, relative, x, yearText, relativeText }) {
  ruler.style.top = '0px';
  ruler.style.bottom = '0px';
  ruler.style.right = 'auto';
  ruler.style.height = 'auto';
  ruler.style.width = '0px';
  ruler.style.left = `${x}px`;
  label.textContent = yearText;
  relative.textContent = relativeText;
  ruler.hidden = false;
}

window.ChronaYearRuler = Object.freeze({ showDesktopYearRuler, showPhoneYearRuler });
