// Planos (conferem com a página de vendas) e links de checkout da Cakto.
// Os links são públicos (não são segredo). Preencha após criar cada produto na Cakto.
export const PLANS = [
  { id: 'essencial', name: 'Essencial', price: 'R$ 25,90', photos: 60, daily: 0, link: 'https://pay.cakto.com.br/3fica83_1261115' },
  { id: 'pro', name: 'Pro', price: 'R$ 49,90', photos: 150, daily: 5, link: 'https://pay.cakto.com.br/r75ja8m_1261139' },
  { id: 'power', name: 'Power', price: 'R$ 79,90', photos: 300, daily: 10, link: 'https://pay.cakto.com.br/ojyx53q_1261149' },
] as const;

export const APP_URL = 'https://app.nutrisnapia.com.br/';
export const SUPPORT_EMAIL = 'contato@fmtecnologiaia.com.br';
export const SUPPORT_WHATSAPP = '(11) 97835-0851';
