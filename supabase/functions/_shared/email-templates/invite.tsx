/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você foi convidado</Heading>
        <Text style={text}>
          Você recebeu um convite para acessar o{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Clique no botão abaixo para aceitar o convite e criar sua conta.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Aceitar convite
        </Button>
        <Text style={footer}>
          Se você não esperava este convite, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0B1120', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 25px' }
const link = { color: '#0891B2', textDecoration: 'underline' }
const button = {
  backgroundColor: '#48CAE4',
  color: '#0B1120',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '12px 22px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94A3B8', margin: '30px 0 0' }
