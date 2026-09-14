import { css } from '@linaria/core'
import { styled } from '@linaria/react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { accountDisplayName } from '../lib/account'
import { useAccount } from '../lib/use-account'
import { useTranslation } from '../lib/use-translation'
import { useGetCartQuery, useGetNotificationsQuery } from '../store/catalog-api'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { selectSessionId } from '../store/cart-slice'
import { selectLanguage, setLanguage } from '../store/ui-slice'
import { globalTheme } from './theme'

const Page = styled.div`
  display: flex;
  flex-direction: column;
  font-family: var(--font-body);
  min-height: 100vh;
`
/**
 * Takes the leftover height so the footer stays pinned to the bottom of the viewport on pages
 * shorter than the screen (404, empty cart, sign in, notifications), instead of ending halfway
 * down with blank background under it. Also the page's `main` landmark, which was missing.
 */
const Main = styled.main`
  flex: 1;
`
const Notice = styled.p`
  background: var(--color-ink);
  color: var(--color-background);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0;
  padding: 0.6rem 1.25rem;
  text-align: center;
`
const Header = styled.header`
  align-items: center;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  /* With the account and admin links the row no longer fits on a phone, so it wraps instead of colliding. */
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  justify-content: space-between;
  padding: 1.25rem clamp(1.25rem, 4vw, 4rem);
  position: sticky;
  top: 0;
  z-index: 2;
`
const Brand = styled(Link)`
  color: inherit;
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 5vw, 1.75rem);
  font-weight: var(--font-display-weight);
  letter-spacing: var(--font-display-tracking);
  text-transform: uppercase;
  text-decoration: none;
`
const Nav = styled.nav`
  display: flex;
  gap: clamp(0.8rem, 3vw, 2.25rem);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`
const navItem = css`
  color: inherit;
  text-decoration: none;

  &.active {
    color: var(--color-accent);
  }
`
const HeaderActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
`
const HeaderLink = styled(Link)`
  color: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-decoration: none;
  text-transform: uppercase;
`
const Avatar = styled.img`
  border-radius: 50%;
  height: 1.5rem;
  margin-right: 0.4rem;
  object-fit: cover;
  vertical-align: middle;
  width: 1.5rem;
`
const Footer = styled.footer`
  background: var(--color-ink);
  color: var(--color-background);
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr auto;
  padding: 2rem clamp(1.25rem, 4vw, 4rem);

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`
const FooterTitle = styled.h2`
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: var(--font-display-weight);
  letter-spacing: var(--font-display-tracking);
  margin: 0;
`
const FooterAction = styled.a`
  background: var(--color-background);
  border: 1px solid var(--color-background);
  color: var(--color-ink);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 1rem 1.35rem;
  text-decoration: none;
  text-transform: uppercase;
`
const cartCount = css`
  display: inline-block;

  @keyframes cartCountPulse {
    0% {
      transform: scale(1);
    }
    35% {
      transform: scale(1.3);
    }
    100% {
      transform: scale(1);
    }
  }
`
const cartCountPulsing = css`
  animation: cartCountPulse 320ms ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
const LanguageToggle = styled.button`
  background: transparent;
  border: 1px solid var(--color-ink);
  color: inherit;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.4rem 0.65rem;
`

export function Layout() {
  const dispatch = useAppDispatch()
  const sessionId = useAppSelector(selectSessionId)
  const language = useAppSelector(selectLanguage)
  const { data: cart } = useGetCartQuery({ sessionId, lang: language })
  const { account } = useAccount()
  const { data: notifications } = useGetNotificationsQuery(undefined, { skip: !account })
  const unreadCount = notifications?.filter((notification) => !notification.readAt).length ?? 0
  const { t } = useTranslation()

  return (
    <Page className={globalTheme}>
      <Notice>{t('notice.default')}</Notice>
      <Header>
        <Brand to="/">Cordillera</Brand>
        <Nav aria-label={t('nav.primaryLabel')}>
          <NavLink to="/shop" className={({ isActive }) => (isActive ? `${navItem} active` : navItem)}>
            {t('nav.shop')}
          </NavLink>
        </Nav>
        <HeaderActions>
          {account?.role === 'admin' && <HeaderLink to="/admin">{t('admin.nav')}</HeaderLink>}
          {account?.role === 'artist' && <HeaderLink to="/artist">{t('artist.nav')}</HeaderLink>}
          {account && (
            <HeaderLink to="/notifications">
              {unreadCount > 0 ? `${t('notifications.nav')} (${unreadCount})` : t('notifications.nav')}
            </HeaderLink>
          )}
          <HeaderLink to="/account">
            {account?.avatar && <Avatar src={account.avatar} alt="" />}
            {account ? accountDisplayName(account) : t('account.navGuest')}
          </HeaderLink>
          <HeaderLink to="/cart" aria-label={t('nav.cartLabel')}>
            <span key={cart?.itemCount ?? 0} className={cart?.itemCount ? `${cartCount} ${cartCountPulsing}` : cartCount}>
              {t('nav.bag', { count: cart?.itemCount ?? 0 })}
            </span>
          </HeaderLink>
          <LanguageToggle type="button" onClick={() => dispatch(setLanguage(language === 'es' ? 'en' : 'es'))}>
            {t('language.toggleLabel')}
          </LanguageToggle>
        </HeaderActions>
      </Header>
      <Main>
        <Outlet />
      </Main>
      <Footer>
        <div>
          <FooterTitle>{t('footer.title')}</FooterTitle>
        </div>
        <FooterAction href="mailto:hello@cordillera.local">{t('footer.action')}</FooterAction>
      </Footer>
    </Page>
  )
}
