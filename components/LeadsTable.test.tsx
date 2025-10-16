import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LeadsTable from './LeadsTable';
import type { LeadRecord } from '../lib/leads';
import type { AbandonedCartSnapshot, AbandonedCartUpdate } from '../lib/types';

const buildSnapshot = (overrides: Partial<AbandonedCartSnapshot> = {}): AbandonedCartSnapshot => ({
  id: overrides.id ?? 'snapshot-1',
  checkout_id: overrides.checkout_id ?? 'chk-1',
  customer_email: overrides.customer_email ?? 'lead@example.com',
  customer_name: overrides.customer_name ?? 'Lead Example',
  customer_phone: overrides.customer_phone ?? null,
  product_name: overrides.product_name ?? 'Produto de teste',
  product_id: overrides.product_id ?? 'prod-1',
  status: overrides.status ?? 'pending',
  paid: overrides.paid ?? false,
  paid_at: overrides.paid_at ?? null,
  discount_code: overrides.discount_code ?? null,
  expires_at: overrides.expires_at ?? null,
  last_event: overrides.last_event ?? null,
  created_at: overrides.created_at ?? '2024-01-01T12:00:00Z',
  updated_at: overrides.updated_at ?? overrides.created_at ?? '2024-01-01T12:00:00Z',
  checkout_url: overrides.checkout_url ?? null,
  traffic_source: overrides.traffic_source ?? null,
});

const buildUpdate = (overrides: Partial<AbandonedCartUpdate> = {}): AbandonedCartUpdate => ({
  id: overrides.id ?? 'update-1',
  timestamp: overrides.timestamp ?? '2024-01-02T12:00:00Z',
  status: overrides.status ?? 'pending',
  event: overrides.event ?? null,
  source: overrides.source ?? null,
  snapshot:
    overrides.snapshot ??
    buildSnapshot({
      id: `snapshot-${overrides.id ?? '1'}`,
      status: overrides.status ?? 'pending',
      updated_at: overrides.timestamp ?? '2024-01-02T12:00:00Z',
      paid: overrides.snapshot?.paid ?? (overrides.status === 'approved'),
    }),
});

describe('LeadsTable', () => {
  it('filters the history summary and updates by status', async () => {
    const lead: LeadRecord = {
      key: 'lead-1',
      email: 'lead@example.com',
      name: 'Lead Example',
      phone: null,
      productName: 'Produto de teste',
      latestStatus: 'approved',
      createdAt: '2024-01-01T08:00:00Z',
      updatedAt: '2024-01-04T12:00:00Z',
      checkoutUrl: null,
      activeCartKey: 'cart-1',
      latestUpdate: null,
      history: [
        {
          cartKey: 'cart-1',
          snapshot: buildSnapshot({
            id: 'snapshot-cart-1',
            checkout_id: 'chk-1',
            status: 'pending',
            updated_at: '2024-01-01T09:00:00Z',
          }),
          updates: [
            buildUpdate({
              id: 'update-1',
              status: 'pending',
              timestamp: '2024-01-02T09:00:00Z',
              snapshot: buildSnapshot({
                id: 'snapshot-cart-1',
                checkout_id: 'chk-1',
                status: 'pending',
                updated_at: '2024-01-02T09:00:00Z',
              }),
            }),
            buildUpdate({
              id: 'update-2',
              status: 'approved',
              timestamp: '2024-01-03T10:00:00Z',
              snapshot: buildSnapshot({
                id: 'snapshot-cart-1',
                checkout_id: 'chk-1',
                status: 'approved',
                updated_at: '2024-01-03T10:00:00Z',
                paid: true,
              }),
            }),
          ],
        },
        {
          cartKey: 'cart-2',
          snapshot: buildSnapshot({
            id: 'snapshot-cart-2',
            checkout_id: 'chk-2',
            status: 'pending',
            updated_at: '2024-01-01T07:00:00Z',
          }),
          updates: [
            buildUpdate({
              id: 'update-3',
              status: 'pending',
              timestamp: '2024-01-01T07:30:00Z',
              snapshot: buildSnapshot({
                id: 'snapshot-cart-2',
                checkout_id: 'chk-2',
                status: 'pending',
                updated_at: '2024-01-01T07:30:00Z',
              }),
            }),
          ],
        },
      ],
    };

    const user = userEvent.setup();
    render(<LeadsTable leads={[lead]} />);

    await user.click(screen.getByRole('button', { name: /ver histórico/i }));
    const dialog = await screen.findByRole('dialog');

    const summaryTable = within(dialog).getByRole('table');
    const summaryBody = summaryTable.querySelector('tbody');
    expect(summaryBody).not.toBeNull();
    const initialSummaryRows = within(summaryBody as HTMLElement).getAllByRole('row');
    expect(initialSummaryRows).toHaveLength(2);
    expect(initialSummaryRows[0]).toHaveTextContent(/Checkout chk-1/i);

    const updatesHeading = within(dialog).getByRole('heading', {
      name: /Histórico do checkout selecionado/i,
    });
    const updatesSection = updatesHeading.closest('section');
    expect(updatesSection).not.toBeNull();
    let updateButtons = within(updatesSection as HTMLElement).getAllByRole('button');
    expect(updateButtons).toHaveLength(2);

    const statusSelects = within(dialog).getAllByLabelText(/Filtrar status/i);
    await user.selectOptions(statusSelects[0], 'approved');

    await waitFor(() => {
      const rows = within(summaryBody as HTMLElement).getAllByRole('row');
      expect(rows).toHaveLength(1);
    });

    const filteredSummaryRows = within(summaryBody as HTMLElement).getAllByRole('row');
    expect(filteredSummaryRows[0]).toHaveTextContent(/Checkout chk-1/i);

    await waitFor(() => {
      expect(within(updatesSection as HTMLElement).getAllByRole('button')).toHaveLength(1);
    });

    updateButtons = within(updatesSection as HTMLElement).getAllByRole('button');
    expect(updateButtons[0]).toHaveTextContent(/aprovado/i);
  });
});
