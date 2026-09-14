import { styled } from '@linaria/react'
import { AdminCollectionCreateForm } from '../components/AdminCollectionCreateForm'
import { AdminCustomerCard } from '../components/AdminCustomerCard'
import { AdminOrderCard } from '../components/AdminOrderCard'
import { AdminProductCard } from '../components/AdminProductCard'
import { AdminProductCreateForm } from '../components/AdminProductCreateForm'
import { Kicker, Section, SectionHeader, SectionTitle } from '../components/primitives'
import { RowSkeleton } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { useAccount } from '../lib/use-account'
import { useTranslation } from '../lib/use-translation'
import { useGetAdminCustomersQuery, useGetAdminOrdersQuery, useGetAdminProductsQuery } from '../store/catalog-api'

const CardList = styled.div`
  display: grid;
  gap: 1.5rem;
`

const ADMIN_SKELETON_ROWS = 3

export function AdminPage() {
  const { t } = useTranslation()
  const { account, isLoading: isLoadingAccount } = useAccount()
  const isAdmin = account?.role === 'admin'
  const { data: products, isLoading: isLoadingProducts } = useGetAdminProductsQuery(undefined, { skip: !isAdmin })
  const { data: orders, isLoading: isLoadingOrders } = useGetAdminOrdersQuery(undefined, { skip: !isAdmin })
  const { data: customers, isLoading: isLoadingCustomers } = useGetAdminCustomersQuery(undefined, { skip: !isAdmin })

  if (isLoadingAccount) return <Section><StateMessage kind="loading">{t('admin.loading')}</StateMessage></Section>
  if (!isAdmin) return <Section><StateMessage kind="error">{t('admin.forbidden')}</StateMessage></Section>

  return (
    <>
      <Section>
        <SectionHeader>
          <div>
            <Kicker>{t('admin.title')}</Kicker>
            <SectionTitle>{t('admin.productsTitle')}</SectionTitle>
          </div>
        </SectionHeader>
        <CardList>
          <AdminProductCreateForm />
          <AdminCollectionCreateForm />
          {isLoadingProducts && Array.from({ length: ADMIN_SKELETON_ROWS }, (_, index) => <RowSkeleton key={index} height="3.5rem" />)}
          {products?.length === 0 && <StateMessage kind="empty">{t('admin.noProducts')}</StateMessage>}
          {products?.map((product) => <AdminProductCard key={product.id} product={product} />)}
        </CardList>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>{t('admin.ordersTitle')}</SectionTitle>
        </SectionHeader>
        <CardList>
          {isLoadingOrders && Array.from({ length: ADMIN_SKELETON_ROWS }, (_, index) => <RowSkeleton key={index} height="6rem" />)}
          {orders?.length === 0 && <StateMessage kind="empty">{t('admin.noOrders')}</StateMessage>}
          {orders?.map((order) => <AdminOrderCard key={order.id} order={order} />)}
        </CardList>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>{t('admin.customersTitle')}</SectionTitle>
        </SectionHeader>
        <CardList>
          {isLoadingCustomers && Array.from({ length: ADMIN_SKELETON_ROWS }, (_, index) => <RowSkeleton key={index} height="3.5rem" />)}
          {customers?.length === 0 && <StateMessage kind="empty">{t('admin.noCustomers')}</StateMessage>}
          {customers?.map((customer) => <AdminCustomerCard key={customer.id} customer={customer} />)}
        </CardList>
      </Section>
    </>
  )
}
