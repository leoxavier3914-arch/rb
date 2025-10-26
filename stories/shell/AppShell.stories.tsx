import type { Meta, StoryObj } from '@storybook/react';
import { AppShell } from '@/components/shell/AppShell';
import { AppProviders } from '@/components/providers/AppProviders';
import { MockRouterProvider } from './StoryRouter';

const meta: Meta<typeof AppShell> = {
  title: 'Shell/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;

type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
  render: () => (
    <MockRouterProvider pathname="/dashboard">
      <AppProviders>
        <AppShell>
          <div className="space-y-4 p-6">
            <h1 className="text-2xl font-semibold text-slate-900">Área principal</h1>
            <p className="text-sm text-slate-600">
              O AppShell combina sidebar, topbar e provedores globais para oferecer navegação consistente entre as páginas do
              hub.
            </p>
          </div>
        </AppShell>
      </AppProviders>
    </MockRouterProvider>
  )
};
