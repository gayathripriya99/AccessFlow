import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        aria-label={t('nav.language')}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}
