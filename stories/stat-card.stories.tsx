import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from '@/components/ui/stat-card';

const meta: Meta<typeof StatCard> = {
  title: 'UI/StatCard',
  component: StatCard,
  args: {
    label: 'Receita bruta',
    value: 'R$ 52.430,00',
    previousValue: 'R$ 48.120,00',
    deltaPercent: 8.9
  }
};

export default meta;

type Story = StoryObj<typeof StatCard>;

export const Positive: Story = {};

export const Negative: Story = {
  args: {
    deltaPercent: -4.2
  }
};

export const Neutral: Story = {
  args: {
    deltaPercent: 0
  }
};
