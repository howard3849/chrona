from pathlib import Path
from openpyxl import load_workbook
from openpyxl.worksheet.datavalidation import DataValidation

path = Path('chrona-sample-timeline.xlsx')
wb = load_workbook(path)
ws = wb['Timeline Data']

headers = {cell.value: cell.column for cell in ws[1] if cell.value}
col = headers.get('Importance')
if not col:
    raise SystemExit('Importance column not found in Timeline Data')

allowed = {'major': 'Major', 'normal': 'Normal', 'minor': 'Minor', 'medium': 'Normal', '': ''}
changed = 0
for row in range(2, ws.max_row + 1):
    cell = ws.cell(row=row, column=col)
    raw = '' if cell.value is None else str(cell.value).strip()
    canonical = allowed.get(raw.lower(), 'Normal')
    if canonical != raw:
        cell.value = canonical or None
        changed += 1

# Replace prior validations on this column with one compact three-level rule.
for validation in list(ws.data_validations.dataValidation):
    ranges = str(validation.sqref)
    if any(part.startswith('S') for part in ranges.split()):
        ws.data_validations.dataValidation.remove(validation)

dv = DataValidation(type='list', formula1='"Major,Normal,Minor"', allow_blank=True)
dv.error = 'Use Major, Normal, Minor, or leave the cell blank.'
dv.errorTitle = 'Chrona Importance'
dv.prompt = 'Major, Normal, Minor; blank is treated as Normal.'
dv.promptTitle = 'Importance'
dv.showErrorMessage = True
dv.showInputMessage = True
ws.add_data_validation(dv)
dv.add(f'S2:S{max(ws.max_row, 500)}')

wb.save(path)
print(f'Updated {changed} Importance cells in {path}')
