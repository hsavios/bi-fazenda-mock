/**
 * Sub-aba Apontamentos — fallback até view transacional dedicada.
 */
export function renderOperacoesApontamentos(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="field-apontamentos-fallback">
            <div class="field-apontamentos-icon" aria-hidden="true">📋</div>
            <h3>Apontamentos analíticos</h3>
            <p>Apontamentos detalhados por data, talhão, cultura, operação e recurso dependem de uma view transacional de operações.</p>
            <p class="field-apontamentos-note">A camada atual demonstra <strong>custos consolidados por talhão</strong>, <strong>produtividade</strong> e <strong>uso de máquinas</strong> nas sub-abas Talhões e Máquinas.</p>
            <ul class="field-apontamentos-list">
                <li>Data da operação</li>
                <li>Talhão e cultura</li>
                <li>Operação agrícola</li>
                <li>Recurso (máquina / equipe)</li>
                <li>Quantidade e unidade</li>
                <li>Custo alocado</li>
            </ul>
            <p class="field-apontamentos-future">Estrutura preparada para integração futura com ordens de serviço e execuções operacionais.</p>
        </div>
    `;
}
