import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  args: {
    children: 'Clique aqui'
  }
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    variant: 'default'
  }
};

export const Ghost: Story = {
  args: {
    variant: 'ghost'
  }
};

export const Outline: Story = {
  args: {
    variant: 'outline'
  }
};
