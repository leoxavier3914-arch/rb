import type { Meta, StoryObj } from '@storybook/react';
import { ChartCard, type ChartCardProps } from '@/components/ui/chart-card';

interface SamplePoint {
  readonly day: string;
  readonly valor: number;
}

const data: SamplePoint[] = [
  { day: 'Seg', valor: 1200 },
  { day: 'Ter', valor: 1840 },
  { day: 'Qua', valor: 950 },
  { day: 'Qui', valor: 2200 },
  { day: 'Sex', valor: 1970 }
];

const ChartCardStory = (props: ChartCardProps<SamplePoint>) => <ChartCard {...props} />;

const meta: Meta<typeof ChartCardStory> = {
  title: 'UI/ChartCard',
  component: ChartCardStory,
  args: {
    title: 'Receita diária',
    description: 'Valores consolidados a partir da base local.',
    data,
    dataKey: 'day',
    valueKey: 'valor'
  }
};

export default meta;

type Story = StoryObj<typeof ChartCardStory>;

export const Basic: Story = {};
