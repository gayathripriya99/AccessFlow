import axios from 'axios';
import type { TFunction } from 'i18next';
import type { ApiErrorBody } from './types';

export function getErrorMessage(error: unknown, t: TFunction): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return t('errors.network');
    }
    if (error.response.status === 403) {
      return t('errors.forbidden');
    }
    if (error.response.status === 404) {
      return t('errors.notFound');
    }
    return error.response.data?.error?.message ?? t('errors.generic');
  }
  return t('errors.generic');
}
