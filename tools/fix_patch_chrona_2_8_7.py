from pathlib import Path

p = Path(__file__).with_name('patch_chrona_2_8_7.py')
s = p.read_text()
start = s.index("assert '<div class=")
end = s.index("\n\n# ---------------------------------------------------------------------------\n# 5.", start)
replacement = '''assert '<div class="list-view-date">${listDateMarkup(event)}</div>' in js
js = js.replace(
    '<div class="list-view-date">${listDateMarkup(event)}</div>',
    '<div class="list-view-date">${listDateMarkup(event, showListYear)}</div>',
    1
)'''
s = s[:start] + replacement + s[end:]
p.write_text(s)
print('fixed Chrona 2.8.7 patch quoting')
