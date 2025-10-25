import type { Meta, StoryObj } from '@storybook/react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const meta: Meta<typeof Table> = {
  title: 'UI/Table',
  component: Table
};

export default meta;

type Story = StoryObj<typeof Table>;

const rows = [
  { id: 'sale_01', customer: 'Ana Silva', status: 'approved', total: 'R$ 297,00' },
  { id: 'sale_02', customer: 'João Souza', status: 'pending', total: 'R$ 147,00' }
];

export const Basic: Story = {
  render: () => (
    <Table>
      <TableCaption>Pedidos recentes sincronizados do ambiente Kiwify.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.id}</TableCell>
            <TableCell>{row.customer}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
};
