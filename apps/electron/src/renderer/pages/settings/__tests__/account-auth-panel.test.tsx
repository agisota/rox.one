import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AccountAuthPanel,
  createNativeAccountAuthRequest,
  isAllowedAccountExternalUrl,
} from '../AccountAuthPanel';

describe('AccountAuthPanel', () => {
  test('renders native auth tabs without browser account navigation', () => {
    const markup = renderToStaticMarkup(<AccountAuthPanel onSubmit={() => undefined} />);

    expect(markup).toContain('Вход');
    expect(markup).toContain('Регистрация');
    expect(markup).toContain('Сброс пароля');
    expect(markup).toContain('Email');
    expect(markup).toContain('Password');
    expect(markup).not.toContain('rox.one/login');
    expect(markup).not.toContain('browser');
  });

  test('maps sign-in, registration, and reset tabs to account API requests', () => {
    expect(createNativeAccountAuthRequest('sign-in', {
      email: 'user@example.com',
      password: 'correct horse battery staple',
    })).toEqual({
      path: '/api/auth/login',
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'correct horse battery staple',
      },
    });

    expect(createNativeAccountAuthRequest('register', {
      displayName: 'ROX User',
      email: 'new@example.com',
      password: 'correct horse battery staple',
    })).toEqual({
      path: '/api/auth/register',
      method: 'POST',
      body: {
        displayName: 'ROX User',
        email: 'new@example.com',
        password: 'correct horse battery staple',
      },
    });

    expect(createNativeAccountAuthRequest('reset', {
      email: 'lost@example.com',
    })).toEqual({
      path: '/api/auth/password-reset/request',
      method: 'POST',
      body: {
        email: 'lost@example.com',
      },
    });
  });

  test('allows only DV.net checkout URLs to leave the account UI', () => {
    expect(isAllowedAccountExternalUrl('https://pay.dv.net/pay/store/store-id/client-id')).toBe(true);
    expect(isAllowedAccountExternalUrl('https://checkout.dv.net/pay/store/store-id/client-id')).toBe(true);
    expect(isAllowedAccountExternalUrl('https://rox.one/account')).toBe(false);
    expect(isAllowedAccountExternalUrl('/account')).toBe(false);
  });
});
