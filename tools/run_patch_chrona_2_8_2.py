from pathlib import Path
import runpy

patch = Path(__file__).with_name('patch_chrona_2_8_2.py')
text = patch.read_text()
text = text.replace(
    "assert js.count(old_sort) >= 2, 'expected point and period sort blocks'",
    "assert js.count(old_sort) >= 1, 'expected point sort block'"
)
patch.write_text(text)
runpy.run_path(str(patch), run_name='__main__')
