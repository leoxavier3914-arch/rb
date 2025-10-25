import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Drawer> = {
  title: 'UI/Drawer',
  component: Drawer
};

export default meta;

type Story = StoryObj<typeof Drawer>;

export const Basic: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="h-64">
        <Button onClick={() => setOpen(true)}>Abrir detalhe</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Detalhes da venda"
          description="Dados recuperados da replicação local."
          footer={<Button onClick={() => setOpen(false)}>Fechar</Button>}
        >
          <p>
            Utilize este componente para apresentar timelines, notas internas ou diffs de versões dentro de uma
            experiência lateral.
          </p>
        </Drawer>
      </div>
    );
  }
};
