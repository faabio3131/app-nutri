import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Termos de Uso • NutriSnap IA' };

const h2 = 'text-base font-bold text-white pt-2';

export default function Termos() {
  return (
    <LegalPage title="Termos de Uso" version="2026-10-30">
      <p>Estes Termos regem o uso do NutriSnap IA (&quot;Serviço&quot;), oferecido pela FM Tecnologia IA LTDA (&quot;nós&quot;). Ao criar uma conta você declara que leu e aceita estes Termos e a Política de Privacidade.</p>

      <h2 className={h2}>1. O que é o Serviço</h2>
      <p>O NutriSnap IA estima calorias e macronutrientes de refeições a partir de fotos, mantém um diário alimentar, calcula metas de calorias, macros e água e oferece lembretes e agenda de treinos.</p>

      <h2 className={h2}>2. Não é aconselhamento médico ou nutricional</h2>
      <p>Todos os valores são <strong>estimativas</strong> geradas por inteligência artificial e fórmulas gerais, e podem conter erros. O Serviço não diagnostica, trata nem substitui nutricionista, médico ou outro profissional de saúde. Consulte um profissional antes de mudar sua alimentação, principalmente se tiver doença, estiver grávida, amamentando ou tiver histórico de transtorno alimentar. Não use o Serviço para tomar decisões de saúde sem orientação profissional.</p>

      <h2 className={h2}>3. Quem pode usar</h2>
      <p>O Serviço é destinado a pessoas com 18 anos ou mais. Você é responsável por manter sua senha em sigilo e pelas atividades da sua conta, e deve nos avisar se suspeitar de uso indevido.</p>

      <h2 className={h2}>4. Teste grátis e planos</h2>
      <p>Cada conta recebe 3 análises de foto gratuitas, uma única vez. Os planos pagos são assinaturas mensais: Essencial (R$ 25,90, 60 fotos por mês), Pro (R$ 49,90, 150 fotos por mês, até 5 por dia) e Power (R$ 79,90, 300 fotos por mês, até 10 por dia). Os limites são contados por mês-calendário (fuso de São Paulo) e, quando houver, por dia. Fotos que falham na análise não são descontadas. Valores e limites podem mudar para novas contratações, com aviso prévio.</p>

      <h2 className={h2}>5. Pagamento, cancelamento e reembolso</h2>
      <p>Os pagamentos são processados pela Cakto, que cobra a assinatura recorrentemente. O acesso é liberado após a confirmação do pagamento e vale para o e-mail usado na compra; use o mesmo e-mail da sua conta. Você pode cancelar a qualquer momento pela Cakto e continua com acesso até o fim do período já pago. Conforme o Código de Defesa do Consumidor (art. 49), você pode desistir da compra em até 7 dias corridos após a contratação, com reembolso integral. Reembolsos e chargebacks encerram o acesso imediatamente.</p>

      <h2 className={h2}>6. Uso adequado</h2>
      <p>É proibido: enviar conteúdo ilegal ou que não seja foto de alimentos/bebidas, tentar burlar limites de uso ou criar várias contas para obter testes grátis, usar robôs ou automações, tentar acessar dados de outras pessoas, sobrecarregar ou atacar o Serviço, ou revender o acesso. Podemos suspender contas que violem estas regras.</p>

      <h2 className={h2}>7. Disponibilidade</h2>
      <p>Trabalhamos para manter o Serviço disponível, mas ele depende de provedores externos (como a IA do Google e a hospedagem) e pode ter interrupções, manutenções ou mudanças. Não garantimos funcionamento ininterrupto nem a precisão das estimativas.</p>

      <h2 className={h2}>8. Responsabilidade</h2>
      <p>Na máxima extensão permitida em lei, não respondemos por decisões tomadas com base nas estimativas do Serviço nem por danos indiretos. Nada nestes Termos exclui direitos que a lei assegura ao consumidor.</p>

      <h2 className={h2}>9. Seus dados</h2>
      <p>O tratamento de dados pessoais segue a Política de Privacidade. Você pode baixar seus dados e excluir sua conta a qualquer momento dentro do aplicativo, na aba Planos.</p>

      <h2 className={h2}>10. Alterações e lei aplicável</h2>
      <p>Podemos atualizar estes Termos; mudanças relevantes serão avisadas no aplicativo ou por e-mail. Estes Termos são regidos pelas leis do Brasil, e fica eleito o foro do domicílio do consumidor.</p>
    </LegalPage>
  );
}
