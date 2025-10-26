import type { Meta, StoryObj } from '@storybook/react';
import { CompactToggle } from '@/components/shell/CompactToggle';
import { AppProviders } from '@/components/providers/AppProviders';

const meta: Meta<typeof CompactToggle> = {
  title: 'Shell/CompactToggle',
  component: CompactToggle
};

export default meta;

type Story = StoryObj<typeof CompactToggle>;

export const Default: Story = {
  render: () => (
    <AppProviders>
      <div className="p-6">
        <CompactToggle />
      </div>
    </AppProviders>
  )
};
