# Chrona v2.4.0

## Language-neutral baseline model

- Replaces the English-only source assumption with a workbook-defined `baseline_language`.
- The language selector is built from `available_languages` and marks the baseline language.
- Saved translations are treated as language-specific overrides of baseline text.
- Missing text can be translated on the fly from the baseline language into the selected language when the browser Translator API supports that pair.
- Dictionary protections now apply to the selected target language rather than assuming Traditional Chinese.
- Translation cache keys and workbook export support every configured non-baseline language.
- `default_language` remains accepted for compatibility, but exports now write `baseline_language`.
- The sample workbook uses `Timeline Data` and documents `baseline_language` in Dataset Settings.
