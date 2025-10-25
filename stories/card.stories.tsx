import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Basic: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Exemplo de card</CardTitle>
        <CardDescription>Descrição resumida do conteúdo apresentado.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          Este é um card simples com título, descrição e ações. Utilize-o como base para blocos informativos no RB
          Sigma Hub.
        </p>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="secondary">Ação</Button>
      </CardFooter>
    </Card>
  )
};
