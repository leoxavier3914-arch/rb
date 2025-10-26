import type { Meta, StoryObj } from '@storybook/react';
import { AppProviders } from '@/components/providers/AppProviders';
import { Topbar } from '@/components/shell/Topbar';
import { MockRouterProvider } from './StoryRouter';

const meta: Meta<typeof Topbar> = {
  title: 'Shell/Topbar',
  component: Topbar
};

export default meta;

type Story = StoryObj<typeof Topbar>;

export const Default: Story = {
  render: () => (
    <MockRouterProvider pathname="/dashboard">
      <AppProviders>
        <Topbar onToggleSidebar={() => {}} onOpenCommandMenu={() => {}} />
      </AppProviders>
    </MockRouterProvider>
  )
};
