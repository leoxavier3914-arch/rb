import type { Meta, StoryObj } from '@storybook/react';
import { Sidebar } from '@/components/shell/Sidebar';
import { MockRouterProvider } from './StoryRouter';

const meta: Meta<typeof Sidebar> = {
  title: 'Shell/Sidebar',
  component: Sidebar
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  render: () => (
    <MockRouterProvider pathname="/sales">
      <Sidebar open={false} onClose={() => {}} />
    </MockRouterProvider>
  )
};

export const MobileOpen: Story = {
  render: () => (
    <MockRouterProvider pathname="/dashboard">
      <Sidebar open onClose={() => {}} />
    </MockRouterProvider>
  )
};
