import type { Meta, StoryObj } from '@storybook/react';
import { FiltersBar } from '@/components/ui/filters-bar';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof FiltersBar> = {
  title: 'UI/FiltersBar',
  component: FiltersBar,
  args: {
    title: 'Filtros ativos'
  }
};

export default meta;

type Story = StoryObj<typeof FiltersBar>;

export const Basic: Story = {
  render: (args) => (
    <FiltersBar
      {...args}
      onReset={() => {
        // noop for Storybook demo
      }}
      actions={<Button size="sm">Salvar favoritos</Button>}
    >
      <span>Status: aprovado</span>
      <span>Período: últimos 30 dias</span>
    </FiltersBar>
  )
};
