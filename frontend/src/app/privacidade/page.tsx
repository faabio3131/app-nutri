import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Política de Privacidade • NutriSnap IA' };

const h2 = 'text-base font-bold text-white pt-2';

export default function Privacidade() {
  return (
    <LegalPage title="Política de Privacidade" version="2026-10-30">
      <p>Esta Política explica como a FM Tecnologia IA LTDA (CNPJ 07.109.248/0001-57) (&quot;controladora&quot;) trata dados pessoais no NutriSnap IA, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).</p>

      <h2 className={h2}>1. Dados que tratamos</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Conta:</strong> nome, e-mail e senha (guardada apenas em formato criptografado irreversível).</li>
        <li><strong>Saúde e hábitos (dados sensíveis):</strong> peso atual e objetivo, altura, idade, sexo biológico, nível de atividade, metas calculadas, refeições e valores nutricionais estimados, consumo de água e rotina de treinos que você registrar.</li>
        <li><strong>Fotos de pratos:</strong> enviadas apenas para análise. <strong>Nós não armazenamos as fotos</strong>; guardamos somente o resultado (nome do prato, calorias, macros e itens).</li>
        <li><strong>Assinatura:</strong> recebemos da Cakto seu e-mail, o plano contratado, o identificador do pedido e o status do pagamento. Não recebemos nem guardamos dados de cartão.</li>
        <li><strong>Técnicos (registros de acesso):</strong> endereço IP, data e hora, rota acessada, resultado da requisição, identificador da sua conta (quando logado) e tipo de navegador. Não guardamos o conteúdo das suas refeições nesses registros.</li>
      </ul>

      <h2 className={h2}>2. Para que usamos e base legal</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Criar sua conta, entregar o Serviço e aplicar o limite do seu plano — execução de contrato (art. 7º, V).</li>
        <li>Tratar seus dados de saúde e alimentação para calcular metas e gerar estimativas — <strong>consentimento específico e destacado</strong> (art. 11, I), dado no cadastro e revogável a qualquer momento ao excluir a conta.</li>
        <li>Liberar e cancelar o acesso conforme pagamentos — execução de contrato.</li>
        <li>Segurança, prevenção a abuso e cumprimento de obrigações legais, como guarda de registros de acesso — legítimo interesse e obrigação legal (art. 7º, II e IX).</li>
      </ul>
      <p>Não vendemos seus dados nem os usamos para publicidade de terceiros.</p>

      <h2 className={h2}>3. Com quem compartilhamos</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Google (API Gemini):</strong> a foto do prato é enviada para análise por IA. Isso envolve transferência internacional de dados (art. 33 da LGPD), com base no seu consentimento e na execução do contrato. Usamos a API em modalidade que, pelos termos do Google para serviços pagos, não usa o conteúdo enviado para treinar modelos.</li>
        <li><strong>Cakto:</strong> processa pagamentos e assinaturas, com política própria de privacidade.</li>
        <li><strong>Hospedagem:</strong> os dados ficam em servidor contratado pela FM Tecnologia IA (Contabo), com acesso restrito.</li>
        <li>Autoridades, quando exigido por lei.</li>
      </ul>

      <h2 className={h2}>4. Por quanto tempo guardamos</h2>
      <p>Enquanto sua conta existir. Ao excluir a conta, apagamos seus dados pessoais, refeições, metas e sessões. Mantemos apenas o que a lei exigir (por exemplo, os registros de acesso, veja abaixo) e, se houver assinatura ainda vigente, o mínimo necessário para honrá-la até o fim do período pago. Cópias de segurança são rotacionadas e deixam de conter os dados em até 14 dias.</p>
      <p><strong>Registros de acesso:</strong> conforme o art. 15 do Marco Civil da Internet (Lei 12.965/2014), guardamos os registros de acesso à aplicação, em ambiente controlado e em sigilo, por no mínimo 6 meses (mantemos por até 200 dias, depois apagamos automaticamente). Eles só são entregues a autoridades mediante ordem judicial ou quando a lei exigir, e permanecem mesmo que você exclua a conta, pois essa guarda é obrigação legal.</p>

      <h2 className={h2}>5. Seus direitos (art. 18 da LGPD)</h2>
      <p>Você pode: confirmar que tratamos seus dados, acessá-los, corrigi-los, pedir anonimização, bloqueio ou eliminação, solicitar portabilidade, saber com quem compartilhamos, ser informado sobre consequências de não consentir e revogar o consentimento. No aplicativo, aba <strong>Planos → Minha conta</strong>, você baixa todos os seus dados em arquivo e exclui a conta com sua senha. Para os demais pedidos, escreva para o canal abaixo; respondemos em até 15 dias.</p>

      <h2 className={h2}>6. Segurança</h2>
      <p>Usamos conexão criptografada (HTTPS), senhas com hash, sessões revogáveis, limites contra abuso, segregação de acessos e cópias de segurança. Nenhum sistema é 100% seguro; em caso de incidente com risco relevante, comunicaremos você e a ANPD, conforme a lei.</p>

      <h2 className={h2}>7. Crianças e adolescentes</h2>
      <p>O Serviço é destinado a maiores de 18 anos e não coleta intencionalmente dados de menores.</p>

      <h2 className={h2}>8. Cookies e armazenamento local</h2>
      <p>Não usamos cookies de publicidade. Guardamos no seu navegador apenas o token de sessão necessário para você continuar conectado.</p>

      <h2 className={h2}>9. Encarregado e contato</h2>
      <p>Controladora: FM Tecnologia IA LTDA (CNPJ 07.109.248/0001-57). Canal do Encarregado de dados e de titulares: contato@fmtecnologiaia.com.br. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2 className={h2}>10. Alterações</h2>
      <p>Podemos atualizar esta Política; mudanças relevantes serão avisadas no aplicativo ou por e-mail, e a versão vigente fica sempre nesta página.</p>
    </LegalPage>
  );
}
