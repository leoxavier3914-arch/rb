import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AppProviders } from '@/components/providers/AppProviders';
import { CommandMenu } from '@/components/shell/CommandMenu';
import { MockRouterProvider } from './StoryRouter';

const meta: Meta<typeof CommandMenu> = {
  title: 'Shell/CommandMenu',
  component: CommandMenu
};

export default meta;

type Story = StoryObj<typeof CommandMenu>;

export const Default: Story = {
  render: () => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(true);

      useEffect(() => {
        const original = window.fetch;
        window.fetch = async () => ({
          ok: true,
          json: async () => ({ results: [] })
        }) as unknown as Response;
        return () => {
          window.fetch = original;
        };
      }, []);

      return <CommandMenu open={open} onOpenChange={setOpen} />;
    };

    return (
      <MockRouterProvider pathname="/dashboard">
        <AppProviders>
          <Demo />
        </AppProviders>
      </MockRouterProvider>
    );
  }
};
