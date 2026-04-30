import { describe, expect, it } from 'bun:test'
import { i18n, setupI18n } from '../setupI18n'

setupI18n()

describe('Agent Workbench brand localization', () => {
  it('exposes English and Russian brand summary labels', () => {
    i18n.changeLanguage('en')
    expect(i18n.t('workbench.brand.section')).toBe('Application')
    expect(i18n.t('workbench.brand.product')).toBe('Product')
    expect(i18n.t('workbench.brand.legalName')).toBe('Legal entity')
    expect(i18n.t('workbench.brand.support')).toBe('Support')
    expect(i18n.t('workbench.brand.documentation')).toBe('Documentation')

    i18n.changeLanguage('ru')
    expect(i18n.t('workbench.brand.section')).toBe('Приложение')
    expect(i18n.t('workbench.brand.product')).toBe('Продукт')
    expect(i18n.t('workbench.brand.legalName')).toBe('Юридическое лицо')
    expect(i18n.t('workbench.brand.support')).toBe('Поддержка')
    expect(i18n.t('workbench.brand.documentation')).toBe('Документация')
  })

  it('interpolates the localized brand product description', () => {
    i18n.changeLanguage('en')
    expect(
      i18n.t('workbench.brand.productDescription', {
        productName: 'Agent Workbench Suite',
        tagline: 'Local and cloud agent workbench',
      }),
    ).toBe('Agent Workbench Suite / Local and cloud agent workbench')
  })

  it('falls back safely for missing workbench keys', () => {
    i18n.changeLanguage('en')
    expect(i18n.t('workbench.brand.missingKey')).toBe('workbench.brand.missingKey')
  })
})
