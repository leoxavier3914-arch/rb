import type { Meta, StoryObj } from '@storybook/react';
import { PeriodPicker } from '@/components/shell/PeriodPicker';
import { AppProviders } from '@/components/providers/AppProviders';

const meta: Meta<typeof PeriodPicker> = {
  title: 'Shell/PeriodPicker',
  component: PeriodPicker
};

export default meta;

type Story = StoryObj<typeof PeriodPicker>;

export const Default: Story = {
  render: () => (
    <AppProviders>
      <div className="p-6">
        <PeriodPicker />
      </div>
    </AppProviders>
  )
};
