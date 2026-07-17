import { useTranslation } from 'react-i18next';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const { t } = useTranslation();
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={t('common.search')}
      className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
    />
  );
}
